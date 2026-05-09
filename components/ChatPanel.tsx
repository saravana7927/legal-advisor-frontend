"use client";

import { useCallback, useRef, useState } from "react";
import {
  postDocChatStream,
  readChatSseStream,
  type ChatHistoryEntry,
} from "@/lib/api";

const SUGGESTED = [
  "Which clauses are risky for me?",
  "Is the termination clause legal in India?",
  "What should I negotiate before signing?",
  "Summarise this contract in plain English",
] as const;

const MAX_HISTORY = 6;

export interface ChatPanelProps {
  docId: string;
}

type UiMessage =
  | { role: "user"; content: string; id: string }
  | {
      role: "assistant";
      content: string;
      citations: string[];
      id: string;
      streaming?: boolean;
    };

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toHistoryPayload(messages: UiMessage[]): ChatHistoryEntry[] {
  const slice = messages.slice(-MAX_HISTORY);
  return slice.map((m) => {
    if (m.role === "user") {
      return { role: "user", content: m.content };
    }
    return {
      role: "assistant",
      content: m.content,
      citations: m.citations.length ? m.citations : undefined,
    };
  });
}

export function ChatPanel({ docId }: ChatPanelProps) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const sendQuestion = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || sending) return;

      setError(null);
      setSending(true);
      const userMsg: UiMessage = {
        role: "user",
        content: trimmed,
        id: newId(),
      };
      const assistantId = newId();
      const assistantPlaceholder: UiMessage = {
        role: "assistant",
        content: "",
        citations: [],
        id: assistantId,
        streaming: true,
      };

      setInput("");

      let priorForHistory: UiMessage[] = [];
      setMessages((prev) => {
        priorForHistory = prev;
        return [...prev, userMsg, assistantPlaceholder];
      });
      requestAnimationFrame(scrollToBottom);

      const history = toHistoryPayload(priorForHistory);

      try {
        const res = await postDocChatStream(docId, {
          question: trimmed,
          history,
        });
        const body = res.body;
        let accumulated = "";
        let citations: string[] = [];

        for await (const chunk of readChatSseStream(body)) {
          if (chunk.type === "token") {
            accumulated += chunk.text;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId && m.role === "assistant"
                  ? { ...m, content: accumulated, streaming: true }
                  : m
              )
            );
          } else if (chunk.type === "citations") {
            citations = chunk.citations;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId && m.role === "assistant"
                  ? { ...m, citations }
                  : m
              )
            );
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && m.role === "assistant"
              ? {
                  ...m,
                  content: accumulated,
                  citations,
                  streaming: false,
                }
              : m
          )
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Chat failed";
        setError(msg);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        setSending(false);
        scrollToBottom();
      }
    },
    [docId, sending, scrollToBottom]
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendQuestion(input);
  };

  const showSuggestions = messages.length === 0;

  return (
    <div className="flex flex-col h-[min(70vh,560px)] border border-gray-200 rounded-xl bg-gray-50/50 overflow-hidden shadow-sm">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {showSuggestions && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-600 mb-1">Suggested questions</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={sending}
                  onClick={() => void sendQuestion(q)}
                  className="rounded-full border border-purple-200 bg-white px-3 py-1.5 text-left text-xs text-purple-800 hover:bg-purple-50 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-xl bg-purple-600 text-white px-4 py-2.5 text-sm shadow-sm">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex justify-start">
              <div className="max-w-[90%] rounded-xl bg-white border border-gray-100 px-4 py-2.5 text-sm text-gray-800 shadow-sm">
                {m.content}
                {m.streaming && m.content.length === 0 && (
                  <TypingDots />
                )}
                {m.streaming && m.content.length > 0 && (
                  <span className="inline-block w-2 h-4 ml-0.5 bg-purple-400 animate-pulse align-middle rounded-sm" />
                )}
                {m.citations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-100">
                    {m.citations.map((c, citeIdx) => (
                      <span
                        key={`${m.id}-cite-${citeIdx}`}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="px-4 py-2 text-sm text-red-600 bg-red-50 border-t border-red-100">
          {error}
          <button
            type="button"
            className="ml-2 underline font-medium"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="border-t border-gray-200 bg-white p-3 flex gap-2 shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this document…"
          disabled={sending}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center h-5" aria-label="LexAI is typing">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" />
    </span>
  );
}
