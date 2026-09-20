"use client";

import { useEffect, useState } from "react";

export type CallStatus = "idle" | "connecting" | "connected" | "failed";

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isFinal?: boolean;
};

type DograhRealtimeEvent = Record<string, unknown>;
type RealtimeListener = (event: DograhRealtimeEvent) => void;

const realtimeListeners = new Set<RealtimeListener>();
let realtimeBridgeInstalled = false;

function installRealtimeBridge() {
  if (realtimeBridgeInstalled || typeof WebSocket === "undefined") return;

  const seenEvents = new WeakSet<object>();
  const forwardRealtimeEvent = (socket: WebSocket, event: MessageEvent) => {
    if (!socket.url.includes("/ws/public/signaling/") || seenEvents.has(event))
      return;

    try {
      const message = JSON.parse(String(event.data)) as unknown;
      const messageObject =
        message && typeof message === "object"
          ? (message as Record<string, unknown>)
          : null;
      if (
        typeof messageObject?.type === "string" &&
        messageObject.type.startsWith("rtf-")
      ) {
        seenEvents.add(event);
        realtimeListeners.forEach((listener) =>
          listener(messageObject as DograhRealtimeEvent),
        );
      }
    } catch {
      // Ignore non-JSON signaling frames.
    }
  };

  const descriptor = Object.getOwnPropertyDescriptor(
    WebSocket.prototype,
    "onmessage",
  );
  if (descriptor?.set && descriptor.get) {
    Object.defineProperty(WebSocket.prototype, "onmessage", {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set(handler: ((event: MessageEvent) => void) | null) {
        const wrappedHandler = handler
          ? (event: MessageEvent) => {
              forwardRealtimeEvent(this, event);
              handler.call(this, event);
            }
          : null;
        descriptor.set?.call(this, wrappedHandler);
      },
    });
  }

  const addEventListener = WebSocket.prototype.addEventListener;
  WebSocket.prototype.addEventListener = function (
    this: WebSocket,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (type !== "message" || !listener) {
      return addEventListener.call(
        this,
        type,
        listener as EventListenerOrEventListenerObject,
        options,
      );
    }

    const wrappedListener: EventListener = (event) => {
      if (event instanceof MessageEvent) forwardRealtimeEvent(this, event);
      if (typeof listener === "function") listener.call(this, event);
      else listener.handleEvent(event);
    };
    return addEventListener.call(this, type, wrappedListener, options);
  };
  realtimeBridgeInstalled = true;
}

function safeEventFields(value: unknown, path = "event", depth = 0) {
  if (depth > 4 || value === null || typeof value !== "object") return [];
  const fields: Array<{ path: string; type: string; length?: number }> = [];
  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    const childPath = `${path}.${key}`;
    if (typeof child === "string") {
      fields.push({ path: childPath, type: "string", length: child.length });
    } else if (child && typeof child === "object") {
      fields.push({
        path: childPath,
        type: Array.isArray(child) ? "array" : "object",
      });
      fields.push(...safeEventFields(child, childPath, depth + 1));
    } else {
      fields.push({ path: childPath, type: typeof child });
    }
  });
  return fields;
}

function extractTranscriptText(event: DograhRealtimeEvent) {
  const payload = event.payload;
  if (!payload || typeof payload !== "object") return null;

  const text = (payload as Record<string, unknown>).text;
  return typeof text === "string" && text.trim()
    ? {
        content: text.trim(),
        field: {
          path: "event.payload.text",
          type: "string",
          length: text.length,
        },
      }
    : null;
}

function isFinalTranscript(event: DograhRealtimeEvent) {
  const payload = event.payload;
  return Boolean(
    payload &&
    typeof payload === "object" &&
    (payload as Record<string, unknown>).final === true,
  );
}

type DograhStatusHandler = (
  status: CallStatus,
  text?: string,
  subtext?: string,
) => void;

type DograhWidget = {
  start: () => void;
  end: () => void;
  setContext: (context: Record<string, string>) => void;
  onStatusChange: (handler: DograhStatusHandler) => void;
  onError: (handler: (error: Error) => void) => void;
  onCallConnected?: (
    handler: (payload: {
      workflowRunId?: number | string;
      sessionId?: number | string;
    }) => void,
  ) => void;
  onCallDisconnected?: (
    handler: (payload: {
      workflowRunId?: number | string;
      sessionId?: number | string;
    }) => void,
  ) => void;
};

declare global {
  interface Window {
    DograhWidget?: DograhWidget;
  }
}

const createSessionContext = (bookId: string, bookName: string) => ({
  book_id: bookId,
  book_name: bookName,
});

const UseDograh = (bookId: string, bookName: string) => {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let transcriptTimer: ReturnType<typeof setInterval> | undefined;
    const activeRealtimeIds: Record<"user" | "assistant", string | null> = {
      user: null,
      assistant: null,
    };
    const realtimeCounters = { user: 0, assistant: 0 };

    const handleRealtimeEvent: RealtimeListener = (event) => {
      const type = typeof event.type === "string" ? event.type : "unknown";
      if (
        type !== "rtf-bot-text" &&
        type !== "rtf-user-transcription" &&
        type !== "rtf-bot-stopped-speaking"
      ) {
        return;
      }

      if (type === "rtf-bot-stopped-speaking") {
        const assistantId = activeRealtimeIds.assistant;
        if (assistantId) {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, isFinal: true }
                : message,
            ),
          );
          activeRealtimeIds.assistant = null;
        }
        return;
      }

      const role: "user" | "assistant" =
        type === "rtf-bot-text" ? "assistant" : "user";
      const extracted = extractTranscriptText(event);
      console.info("[DograhTranscriptDebug] event type:", type);
      console.info(
        "[DograhTranscriptDebug] event fields:",
        safeEventFields(event),
      );
      if (!extracted) {
        console.warn("[DograhTranscriptDebug] transcript text not found");
        return;
      }

      const final = role === "user" ? isFinalTranscript(event) : false;
      const id =
        activeRealtimeIds[role] || `${role}-${++realtimeCounters[role]}`;
      activeRealtimeIds[role] = final ? null : id;
      console.info("[DograhTranscriptDebug] extracted role:", role);
      console.info(
        "[DograhTranscriptDebug] extracted field:",
        extracted.field.path,
      );
      console.info(
        "[DograhTranscriptDebug] extracted content length:",
        extracted.content.length,
      );

      setMessages((current) => {
        const existingIndex = current.findIndex((message) => message.id === id);
        const existingMessage =
          existingIndex >= 0 ? current[existingIndex] : undefined;
        const nextMessage = {
          id,
          role,
          content:
            role === "assistant" && existingMessage && !existingMessage.isFinal
              ? `${existingMessage.content} ${extracted.content}`.trim()
              : extracted.content,
          isFinal: final,
        };
        if (existingIndex === -1) return [...current, nextMessage];
        const next = [...current];
        next[existingIndex] = nextMessage;
        return next;
      });
    };

    installRealtimeBridge();
    realtimeListeners.add(handleRealtimeEvent);

    const refreshTranscript = async (workflowRunId: number | string) => {
      try {
        const response = await fetch(
          `/api/dograh/transcript?workflowRunId=${workflowRunId}`,
          {
            cache: "no-store",
          },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          messages?: ConversationMessage[];
        };
        const messages = (payload.messages || []).filter(
          (message) => message.id && message.content.trim(),
        );
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
        if (messages.length) setMessages(messages);
      } catch {
        // The call remains usable if a transcript refresh is temporarily unavailable.
      }
    };

    const connectWidget = () => {
      const widget = window.DograhWidget;
      if (!widget || cancelled) return false;

      const sessionContext = createSessionContext(bookId, bookName);
      console.info("[Dograh] session context", sessionContext);
      widget.setContext(sessionContext);
      widget.onStatusChange((nextStatus) => {
        setStatus(nextStatus);
        console.info("[DograhDebug] connected:", nextStatus === "connected");
        if (nextStatus === "connected") {
          setError(null);
          setElapsedSeconds(0);
          timer = setInterval(
            () => setElapsedSeconds((value) => value + 1),
            1000,
          );
        } else if (nextStatus !== "connecting" && timer) {
          clearInterval(timer);
          timer = undefined;
        }
      });
      widget.onError((nextError) => {
        setError(nextError.message || "Dograh could not start the voice call.");
        setStatus("failed");
      });
      widget.onCallConnected?.(({ workflowRunId, sessionId }) => {
        console.info("[DograhDebug] runId:", workflowRunId ?? "none");
        console.info("[DograhDebug] sessionId:", sessionId ?? "none");
        console.info("[DograhDebug] connected: true");
        if (!workflowRunId) return;
        void refreshTranscript(workflowRunId);
        transcriptTimer = setInterval(() => {
          void refreshTranscript(workflowRunId);
        }, 1000);
      });
      widget.onCallDisconnected?.(({ workflowRunId, sessionId }) => {
        console.info("[DograhDebug] runId:", workflowRunId ?? "none");
        console.info("[DograhDebug] sessionId:", sessionId ?? "none");
        console.info("[DograhDebug] connected: false");
        if (!workflowRunId) return;
        if (transcriptTimer) clearInterval(transcriptTimer);
        void refreshTranscript(workflowRunId);
      });
      return true;
    };

    const loadWidget = async () => {
      if (connectWidget()) return;
      const response = await fetch("/api/dograh/widget", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.scriptUrl) {
        throw new Error(payload.error || "Unable to load Dograh.");
      }
      if (!document.querySelector(`script[src="${payload.scriptUrl}"]`)) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = payload.scriptUrl;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () =>
            reject(new Error("Dograh widget failed to load."));
          document.head.appendChild(script);
        });
      }
      connectWidget();
    };

    loadWidget().catch((loadError: unknown) => {
      if (!cancelled) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load Dograh.",
        );
        setStatus("failed");
      }
    });

    if (!window.DograhWidget) {
      const handleWidgetReady = () => connectWidget();
      window.addEventListener("dograh-widget-ready", handleWidgetReady);
      window.addEventListener("load", handleWidgetReady, { once: true });
      return () => {
        cancelled = true;
        window.removeEventListener("dograh-widget-ready", handleWidgetReady);
        window.removeEventListener("load", handleWidgetReady);
        realtimeListeners.delete(handleRealtimeEvent);
        if (timer) clearInterval(timer);
        if (transcriptTimer) clearInterval(transcriptTimer);
      };
    }

    return () => {
      cancelled = true;
      realtimeListeners.delete(handleRealtimeEvent);
      if (timer) clearInterval(timer);
      if (transcriptTimer) clearInterval(transcriptTimer);
    };
  }, [bookId, bookName]);

  const toggleCall = () => {
    const widget = window.DograhWidget;
    if (!widget) {
      setError("Voice assistant is still loading. Please try again.");
      setStatus("failed");
      return;
    }

    setError(null);
    if (status === "connected" || status === "connecting") widget.end();
    else {
      const sessionContext = createSessionContext(bookId, bookName);
      console.info("[Dograh] session context", sessionContext);
      widget.setContext(sessionContext);
      widget.start();
    }
  };

  return { status, error, elapsedSeconds, messages, toggleCall };
};

export default UseDograh;
