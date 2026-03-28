"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { ArrowUp, Bot, FileSearch, Loader2 } from "lucide-react";
import clsx from "clsx";
import MessageBubble from "./MessageBubble";
import type { ChatHistoryTurn, Inspector, Message, Source } from "@/lib/types";

interface Props {
  isIndexed: boolean;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface RawInspector {
  indexed_pdf: boolean;
  retrieval_query: string;
  history_turns: number;
  candidate_chunks: number;
  used_chunks: number;
  decision_basis: string[];
  router_decision?: string;
  source_documents: string[];
  source_pages: number[];
}

const mapInspector = (inspector?: RawInspector): Inspector | undefined => {
  if (!inspector) return undefined;

  return {
    indexedPdf: inspector.indexed_pdf,
    retrievalQuery: inspector.retrieval_query,
    historyTurns: inspector.history_turns,
    candidateChunks: inspector.candidate_chunks,
    usedChunks: inspector.used_chunks,
    decisionBasis: inspector.decision_basis,
    routerDecision: inspector.router_decision,
    sourceDocuments: inspector.source_documents,
    sourcePages: inspector.source_pages,
  };
};

type StreamEvent =
  | { type: "token"; content?: string }
  | { type: "sources"; content?: Source[] }
  | {
      type: "metadata";
      content?: {
        response_time?: number;
        route?: "pdf" | "general";
        inspector?: RawInspector;
      };
    }
  | { type: "done"; content?: undefined }
  | { type: "error"; content?: string };

export default function ChatWindow({ isIndexed }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateAssistantMessage = (
    assistantId: number,
    updater: (message: Message) => Message
  ) => {
    setMessages((prev: Message[]) =>
      prev.map((message: Message) =>
        message.id === assistantId ? updater(message) : message
      )
    );
  };

  /* Auto-scroll on new content */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* Auto-resize textarea */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");

    const history: ChatHistoryTurn[] = messages
      .filter(
        (message) =>
          message.content.trim().length > 0 &&
          !message.isStreaming &&
          !message.content.startsWith("**Error:**")
      )
      .slice(-8)
      .map((message) => ({
        role: message.role,
        content: message.content,
        route: message.role === "assistant" ? message.route : undefined,
      }));

    const userMsg: Message = { id: Date.now(), role: "user", content: text };
    const asstId = Date.now() + 1;
    const asstMsg: Message = {
      id: asstId,
      role: "assistant",
      content: "",
      sources: [],
      isStreaming: true,
    };

    setMessages((prev: Message[]) => [...prev, userMsg, asstMsg]);
    setIsStreaming(true);

    try {
      const res = await fetch(`${API}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(errData.detail ?? "Stream request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        /* SSE events are separated by double newlines */
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          for (const line of block.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;

            let event: StreamEvent;

            try {
              event = JSON.parse(raw) as StreamEvent;
            } catch {
              /* skip malformed events */
              continue;
            }

            if (event.type === "token") {
              updateAssistantMessage(asstId, (message) => ({
                ...message,
                content: message.content + (event.content as string),
              }));
            } else if (event.type === "sources") {
              updateAssistantMessage(asstId, (message) => ({
                ...message,
                sources: event.content as Source[],
              }));
            } else if (event.type === "metadata") {
              updateAssistantMessage(asstId, (message) => ({
                ...message,
                responseTime: event.content?.response_time,
                route: event.content?.route,
                inspector: mapInspector(event.content?.inspector),
              }));
            } else if (event.type === "done") {
              updateAssistantMessage(asstId, (message) => ({
                ...message,
                isStreaming: false,
              }));
            } else if (event.type === "error") {
              throw new Error(event.content as string);
            }
          }
        }
      }
    } catch (err) {
      const msg =
        err instanceof TypeError
          ? `Cannot reach backend at ${API}. Check the backend deployment and NEXT_PUBLIC_API_URL configuration.`
          : err instanceof Error
            ? err.message
            : "An unexpected error occurred.";
      updateAssistantMessage(asstId, (message) => ({
        ...message,
        content: `**Error:** ${msg}`,
        isStreaming: false,
      }));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const canSend = !isStreaming && input.trim().length > 0;

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* ── Header ───────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-slate-300">Assistant</span>
          <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-indigo-300/90">
            Inspector
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span
            className={clsx(
              "w-1.5 h-1.5 rounded-full",
              isIndexed ? "bg-emerald-500" : "bg-slate-700"
            )}
          />
          {isIndexed ? "PDF + general mode" : "General mode only"}
        </div>
      </header>

      {/* ── Messages ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {messages.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center select-none">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center">
                <FileSearch className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-300">
                  {isIndexed ? "Ready to answer" : "Ask anything, or upload a PDF"}
                </h2>
                <p className="text-sm text-slate-600 mt-1 max-w-xs mx-auto">
                  {isIndexed
                    ? "I’ll route PDF questions to retrieval, cite sources, and show you why the route was chosen."
                    : "You can ask general questions now, or drop a PDF in the sidebar to inspect grounded retrieval."}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  ...(isIndexed
                    ? [
                        "Summarise this document",
                        "What are the key points?",
                        "ما هو موضوع هذا المستند؟",
                      ]
                    : []),
                  "What is retrieval-augmented generation?",
                  "اشرح الذكاء الاصطناعي باختصار",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setInput(prompt);
                      textareaRef.current?.focus();
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-700/60 bg-slate-800/40 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-600 hover:bg-slate-800/80 transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input ────────────────────────────────────── */}
      <div className="shrink-0 px-4 pb-5 pt-3 bg-slate-950">
        <div className="max-w-3xl mx-auto">
          <div
            className={clsx(
              "flex items-end gap-3 rounded-2xl border px-4 py-3 transition-all duration-200",
              "bg-slate-900/80 border-slate-700/60 focus-within:border-indigo-500/60 focus-within:glow-indigo-sm"
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              placeholder={
                isIndexed
                  ? "Ask about your PDF or anything else… (Enter to send, Shift+Enter for newline)"
                  : "Ask a general question, or upload a PDF for retrieval…"
              }
              rows={1}
              className="flex-1 bg-transparent resize-none text-sm text-slate-200 placeholder:text-slate-600 outline-none leading-relaxed disabled:cursor-not-allowed"
              style={{ maxHeight: "160px" }}
            />
            <button
              onClick={sendMessage}
              disabled={!canSend}
              className={clsx(
                "shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200",
                canSend
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
              )}
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-700 mt-2">
            Supports Arabic & English · Groq-powered chat
          </p>
        </div>
      </div>
    </div>
  );
}
