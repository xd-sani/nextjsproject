"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { MessageCircle, Mic, MicOff, Send } from "lucide-react";

import UseDograh, { CallStatus, ConversationMessage } from "@/hooks/UseDograh";

type Props = { bookId: string; bookName: string };

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const statusLabel: Record<CallStatus, string> = {
  idle: "Ready",
  connecting: "Connecting",
  connected: "Connected",
  failed: "Connection failed",
};

export default function DograhVoiceAssistant({ bookId, bookName }: Props) {
  const [mode, setMode] = useState<"voice" | "chat">("voice");
  const [chatMessages, setChatMessages] = useState<ConversationMessage[]>([]);
  const [query, setQuery] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const {
    status,
    error: voiceError,
    elapsedSeconds,
    messages: voiceMessages,
    toggleCall,
  } = UseDograh(bookId, bookName);
  const messages = mode === "voice" ? voiceMessages : chatMessages;
  const isActive = status === "connecting" || status === "connected";
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendChatMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery || sending) {
      if (!trimmedQuery) setChatError("Ask a question about this book.");
      return;
    }

    setChatError(null);
    setQuery("");
    setChatMessages((current) => [
      ...current,
      {
        id: `chat-user-${Date.now()}`,
        role: "user",
        content: trimmedQuery,
      },
    ]);
    setSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, query: trimmedQuery }),
      });
      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Chat search failed.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      setChatMessages((current) => [
        ...current,
        {
          id: `chat-assistant-${Date.now()}`,
          role: "assistant",
          content: "",
        },
      ]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        const nextAnswer = answer;
        setChatMessages((current) => {
          const next = [...current];
          const lastMessage = next[next.length - 1];
          if (lastMessage?.role === "assistant") {
            next[next.length - 1] = { ...lastMessage, content: nextAnswer };
          }
          return next;
        });
      }
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Chat search failed.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="space-y-4" aria-label={`Assistant for ${bookName}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="assistant-mode-toggle"
          role="tablist"
          aria-label="Assistant mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "voice"}
            className={
              mode === "voice" ? "assistant-mode-active" : "assistant-mode"
            }
            onClick={() => setMode("voice")}
          >
            <Mic aria-hidden="true" size={17} /> Voice
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "chat"}
            className={
              mode === "chat" ? "assistant-mode-active" : "assistant-mode"
            }
            onClick={() => setMode("chat")}
          >
            <MessageCircle aria-hidden="true" size={17} /> Chat
          </button>
        </div>
        <span className="text-sm text-(--text-secondary)">{bookName}</span>
      </div>

      {mode === "voice" ? (
        <div className="assistant-voice-controls">
          <button
            type="button"
            className="vapi-mic-btn"
            aria-label={
              isActive ? "End voice conversation" : "Start voice conversation"
            }
            onClick={toggleCall}
          >
            {isActive ? (
              <MicOff aria-hidden="true" />
            ) : (
              <Mic aria-hidden="true" />
            )}
          </button>
          <span className="vapi-status-indicator">
            <span
              className={`vapi-status-dot vapi-status-dot-${status === "idle" ? "ready" : status}`}
            />
            <span className="vapi-status-text">{statusLabel[status]}</span>
          </span>
          <span className="vapi-status-indicator">
            <span className="vapi-status-text">
              {formatTime(elapsedSeconds)}/15:00
            </span>
          </span>
          {voiceError && (
            <p className="w-full text-sm text-red-700">{voiceError}</p>
          )}
        </div>
      ) : (
        <form className="assistant-chat-form" onSubmit={sendChatMessage}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Ask about ${bookName}`}
            aria-label="Ask a question about this book"
            disabled={sending}
          />
          <button
            type="submit"
            aria-label="Send question"
            disabled={sending || !query.trim()}
          >
            <Send aria-hidden="true" size={18} />
          </button>
          {chatError && (
            <p className="w-full text-sm text-red-700">{chatError}</p>
          )}
        </form>
      )}

      <div className="transcript-container">
        {messages.length === 0 ? (
          <div className="transcript-empty">
            <MessageCircle aria-hidden="true" />
            <p className="transcript-empty-text">No conversation yet</p>
            <p className="transcript-empty-hint">
              {mode === "voice"
                ? "Click the mic button above to start talking"
                : "Ask a question about this book"}
            </p>
          </div>
        ) : (
          <div className="transcript-messages" aria-live="polite">
            {messages.map((message) => (
              <div
                className={`transcript-message ${message.role === "user" ? "transcript-message-user" : "transcript-message-assistant"}`}
                key={message.id}
              >
                <div
                  className={`transcript-bubble ${message.role === "user" ? "transcript-bubble-user" : "transcript-bubble-assistant"}`}
                >
                  <p className="mb-1 text-xs font-bold uppercase opacity-70">
                    {message.role === "user" ? "You" : "Bookified AI"}
                  </p>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            <div ref={transcriptEndRef} aria-hidden="true" />
          </div>
        )}
      </div>
    </section>
  );
}
