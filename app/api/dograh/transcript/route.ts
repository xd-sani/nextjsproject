import { NextResponse } from "next/server";

const DOGRAH_API_BASE = "https://app.dograh.com/api/v1";
const WORKFLOW_ID = process.env.NEXT_PUBLIC_DOGRAH_WORKFLOW_ID || "11722";

type TranscriptEntry = { role?: string; text?: string; content?: string };

function normalizeTranscript(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: TranscriptEntry) => {
    const content = typeof entry.text === "string" ? entry.text : entry.content;
    if (!content?.trim()) return [];
    return [
      {
        role: entry.role?.toLowerCase().includes("user")
          ? ("user" as const)
          : ("assistant" as const),
        content: content.trim(),
      },
    ];
  });
}

function normalizeTranscriptText(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(user|assistant|agent|bot)\s*:\s*(.+)$/i);
      return {
        role:
          match?.[1].toLowerCase() === "user"
            ? ("user" as const)
            : ("assistant" as const),
        content: (match?.[2] || line).trim(),
      };
    });
}

export async function GET(request: Request) {
  const workflowRunId = new URL(request.url).searchParams.get("workflowRunId");
  const apiKey = process.env.DOGRAH_API_KEY;
  if (!apiKey || !workflowRunId || !/^\d+$/.test(workflowRunId)) {
    return NextResponse.json({ messages: [] }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${DOGRAH_API_BASE}/workflow/${WORKFLOW_ID}/runs/${workflowRunId}`,
      { headers: { "X-API-Key": apiKey }, cache: "no-store" },
    );
    if (!response.ok)
      return NextResponse.json({ messages: [] }, { status: 502 });

    const run = (await response.json()) as Record<string, unknown>;
    const inlineMessages = normalizeTranscript(run.transcript);
    if (inlineMessages.length)
      return NextResponse.json({ messages: inlineMessages });

    const transcriptUrl =
      typeof run.transcript_url === "string" ? run.transcript_url : null;
    if (!transcriptUrl) return NextResponse.json({ messages: [] });

    const transcriptResponse = await fetch(transcriptUrl, {
      headers: { "X-API-Key": apiKey },
      cache: "no-store",
    });
    if (!transcriptResponse.ok)
      return NextResponse.json({ messages: [] }, { status: 502 });
    return NextResponse.json({
      messages: normalizeTranscriptText(await transcriptResponse.text()),
    });
  } catch (error) {
    console.error("Dograh transcript error:", error);
    return NextResponse.json({ messages: [] }, { status: 502 });
  }
}
