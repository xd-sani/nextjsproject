"use client";

import { useEffect, useState } from "react";

export type CallStatus = "idle" | "connecting" | "connected" | "failed";

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

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
    handler: (payload: { workflowRunId?: number }) => void,
  ) => void;
  onCallDisconnected?: (
    handler: (payload: { workflowRunId?: number }) => void,
  ) => void;
};

declare global {
  interface Window {
    DograhWidget?: DograhWidget;
  }
}

const UseDograh = (bookId: string, bookName: string) => {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let transcriptTimer: ReturnType<typeof setInterval> | undefined;

    const refreshTranscript = async (workflowRunId: number) => {
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
        if (payload.messages?.length) setMessages(payload.messages);
      } catch {
        // The call remains usable if a transcript refresh is temporarily unavailable.
      }
    };

    const connectWidget = () => {
      const widget = window.DograhWidget;
      if (!widget || cancelled) return false;

      widget.setContext({ book_id: bookId, book_name: bookName });
      widget.onStatusChange((nextStatus) => {
        setStatus(nextStatus);
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
      widget.onCallConnected?.(({ workflowRunId }) => {
        if (!workflowRunId) return;
        void refreshTranscript(workflowRunId);
        transcriptTimer = setInterval(() => {
          void refreshTranscript(workflowRunId);
        }, 2000);
      });
      widget.onCallDisconnected?.(({ workflowRunId }) => {
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
        if (timer) clearInterval(timer);
        if (transcriptTimer) clearInterval(transcriptTimer);
      };
    }

    return () => {
      cancelled = true;
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
      widget.setContext({ book_id: bookId, book_name: bookName });
      widget.start();
    }
  };

  return { status, error, elapsedSeconds, messages, toggleCall };
};

export default UseDograh;
