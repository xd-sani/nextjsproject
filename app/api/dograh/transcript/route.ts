import { NextResponse } from "next/server";

const DOGRAH_API_BASE = "https://app.dograh.com/api/v1";
const WORKFLOW_ID = process.env.NEXT_PUBLIC_DOGRAH_WORKFLOW_ID || "11722";

type TranscriptEntry = Record<string, unknown>;

function transcriptEntries(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  const object = value as Record<string, unknown>;
  for (const key of [
    "transcript",
    "messages",
    "turns",
    "conversation",
    "data",
  ]) {
    if (object[key] !== undefined) {
      const entries = transcriptEntries(object[key]);
      if (entries.length) return entries;
    }
  }
  return [];
}

function normalizeTranscript(value: unknown, prefix = "turn") {
  return transcriptEntries(value).flatMap((value, index) => {
    if (typeof value === "string") {
      return value.trim()
        ? [
            {
              id: `${prefix}-${index}`,
              role: "assistant" as const,
              content: value.trim(),
            },
          ]
        : [];
    }
    if (!value || typeof value !== "object") return [];

    const entry = value as TranscriptEntry;
    const messages = [];
    const userMessage = entry.user_message;
    const assistantMessage = entry.assistant_message;
    if (typeof userMessage === "string" && userMessage.trim()) {
      messages.push({
        id: `${prefix}-${index}-user`,
        role: "user" as const,
        content: userMessage.trim(),
      });
    }
    if (typeof assistantMessage === "string" && assistantMessage.trim()) {
      messages.push({
        id: `${prefix}-${index}-assistant`,
        role: "assistant" as const,
        content: assistantMessage.trim(),
      });
    }
    if (messages.length) return messages;

    const speaker = [entry.role, entry.speaker, entry.type]
      .find((item) => typeof item === "string")
      ?.toString()
      .toLowerCase();
    const content = [
      entry.text,
      entry.content,
      entry.message,
      entry.transcript,
    ].find((item) => typeof item === "string" && item.trim()) as
      | string
      | undefined;
    return content?.trim()
      ? [
          {
            id: `${prefix}-${index}`,
            role:
              speaker?.includes("user") || speaker?.includes("human")
                ? ("user" as const)
                : ("assistant" as const),
            content: content.trim(),
          },
        ]
      : [];
  });
}

function normalizeRealtimeFeedbackEvents(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((event, index) => {
    if (!event || typeof event !== "object") return [];
    const record = event as Record<string, unknown>;
    const type = record.type;
    const payload = record.payload;
    if (
      (type !== "rtf-bot-text" && type !== "rtf-user-transcription") ||
      !payload ||
      typeof payload !== "object"
    ) {
      return [];
    }

    const data = payload as Record<string, unknown>;
    const text = data.text;
    if (typeof text !== "string" || !text.trim()) return [];
    if (type === "rtf-user-transcription" && data.final !== true) return [];

    return [
      {
        id: `rtf-${String(record.turn ?? index)}-${index}`,
        role:
          type === "rtf-user-transcription"
            ? ("user" as const)
            : ("assistant" as const),
        content: text.trim(),
        isFinal: type === "rtf-user-transcription" || data.final === true,
      },
    ];
  });
}

function normalizeTranscriptText(value: string) {
  try {
    const messages = normalizeTranscript(JSON.parse(value), "transcript");
    if (messages.length) return messages;
  } catch {
    // Dograh may return a plain text transcript instead of JSON.
  }

  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(/^(user|assistant|agent|bot)\s*:\s*(.+)$/i);
      return {
        id: `transcript-${index}`,
        role:
          match?.[1].toLowerCase() === "user"
            ? ("user" as const)
            : ("assistant" as const),
        content: (match?.[2] || line).trim(),
      };
    });
}

function logResponseShape(label: string, value: unknown) {
  if (Array.isArray(value)) {
    console.info(
      "[DograhTranscriptDebug]",
      label,
      "array length:",
      value.length,
    );
    return;
  }
  if (value && typeof value === "object") {
    console.info(
      "[DograhTranscriptDebug]",
      label,
      "object keys:",
      Object.keys(value),
    );
    return;
  }
  console.info("[DograhTranscriptDebug]", label, "type:", typeof value);
}

async function logFailedResponse(label: string, response: Response) {
  const body = await response.text();
  let safeBody: unknown = { bodyLength: body.length };
  try {
    const parsed = JSON.parse(body) as unknown;
    safeBody = Array.isArray(parsed)
      ? { arrayLength: parsed.length }
      : parsed && typeof parsed === "object"
        ? { objectKeys: Object.keys(parsed) }
        : { type: typeof parsed };
  } catch {
    // Do not log raw transcript or error text, which may contain user content.
  }
  console.error("[DograhTranscriptDebug]", label, {
    status: response.status,
    statusText: response.statusText,
    safeBody,
  });
}

export async function GET(request: Request) {
  const workflowRunId = new URL(request.url).searchParams.get("workflowRunId");
  const apiKey = process.env.DOGRAH_API_KEY;
  console.info("[DograhTranscriptDebug] request started", {
    runId: workflowRunId,
  });
  if (!apiKey || !workflowRunId || !/^\d+$/.test(workflowRunId)) {
    console.warn("[DograhTranscriptDebug] invalid request", {
      runId: workflowRunId,
      hasApiKey: Boolean(apiKey),
    });
    return NextResponse.json({ messages: [] }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${DOGRAH_API_BASE}/workflow/${WORKFLOW_ID}/runs/${workflowRunId}`,
      { headers: { "X-API-Key": apiKey }, cache: "no-store" },
    );
    console.info(
      "[DograhTranscriptDebug] run response status:",
      response.status,
    );
    if (!response.ok) {
      await logFailedResponse("run request failed", response);
      return NextResponse.json({ messages: [] }, { status: 502 });
    }

    const run = (await response.json()) as Record<string, unknown>;
    console.info(
      "[DograhTranscriptDebug] run response keys:",
      Object.keys(run),
    );
    logResponseShape("run.transcript", run.transcript);
    logResponseShape("run.messages", run.messages);
    logResponseShape("run.logs", run.logs);
    const logs =
      run.logs && typeof run.logs === "object"
        ? (run.logs as Record<string, unknown>)
        : null;
    const realtimeMessages = normalizeRealtimeFeedbackEvents(
      logs?.realtime_feedback_events,
    );
    const inlineMessages = realtimeMessages.length
      ? realtimeMessages
      : normalizeTranscript(run.transcript || run.messages);
    console.info(
      "[DograhTranscriptDebug] normalized message count:",
      inlineMessages.length,
    );
    if (inlineMessages.length) {
      inlineMessages.forEach((message) =>
        console.info("[DograhTranscriptDebug] message", {
          role: message.role,
          id: message.id,
          contentLength: message.content.length,
        }),
      );
      return NextResponse.json({ messages: inlineMessages });
    }

    const transcriptUrl =
      typeof run.transcript_url === "string"
        ? run.transcript_url
        : typeof run.transcript_public_url === "string"
          ? run.transcript_public_url
          : null;
    console.info(
      "[DograhTranscriptDebug] transcript URL available:",
      Boolean(transcriptUrl),
    );
    if (!transcriptUrl) return NextResponse.json({ messages: [] });

    const transcriptResponse = await fetch(transcriptUrl, {
      headers: { "X-API-Key": apiKey },
      cache: "no-store",
    });
    console.info(
      "[DograhTranscriptDebug] transcript response status:",
      transcriptResponse.status,
    );
    if (!transcriptResponse.ok) {
      await logFailedResponse("transcript request failed", transcriptResponse);
      return NextResponse.json({ messages: [] }, { status: 502 });
    }
    const transcriptBody = await transcriptResponse.text();
    console.info(
      "[DograhTranscriptDebug] transcript body length:",
      transcriptBody.length,
    );
    const messages = normalizeTranscriptText(transcriptBody);
    console.info(
      "[DograhTranscriptDebug] normalized message count:",
      messages.length,
    );
    messages.forEach((message) =>
      console.info("[DograhTranscriptDebug] message", {
        role: message.role,
        id: message.id,
        contentLength: message.content.length,
      }),
    );
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[DograhTranscriptDebug] request exception", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ messages: [] }, { status: 502 });
  }
}
