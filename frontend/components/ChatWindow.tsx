"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { ArrowUp, Bot, FileSearch, Github, Linkedin, Loader2 } from "lucide-react";
import clsx from "clsx";
import MessageBubble from "./MessageBubble";
import type { ChatHistoryTurn, Inspector, Message, Source } from "@/lib/types";

interface Props {
  isIndexed: boolean;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const ARABIC_TEXT_PATTERN = /[\u0600-\u06FF]/;

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
  const inputLooksArabic = ARABIC_TEXT_PATTERN.test(input);

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
    <div className="flex h-full flex-col bg-transparent">
      <header className="shrink-0 border-b border-slate-800/60 bg-slate-950/45 px-6 py-4 backdrop-blur-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/25 to-violet-500/20 ring-1 ring-indigo-400/20">
              <Bot className="h-5 w-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-semibold text-slate-100">Explainable AI Assistant</h1>
                <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-indigo-300/90">
                  Inspector
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
                Ask in Arabic or English. The system routes each question, retrieves evidence when needed, and exposes the grounding details behind every answer.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-slate-500">Built by Ahmed Geeter</span>
                <a
                  href="https://github.com/ahmedgeeter"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800/70 bg-slate-950/70 px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:border-slate-700 hover:text-white"
                >
                  <Github className="h-3.5 w-3.5" />
                  <span>GitHub</span>
                </a>
                <a
                  href="https://www.linkedin.com/in/ahmed-ai-dev/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800/70 bg-slate-950/70 px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:border-slate-700 hover:text-white"
                >
                  <Linkedin className="h-3.5 w-3.5" />
                  <span>LinkedIn</span>
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/70 px-3 py-2 text-slate-400">
              Multilingual retrieval
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/70 px-3 py-2 text-slate-400">
              Source citations
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-950/70 px-3 py-2 text-slate-400">
              <span
                className={clsx(
                  "h-1.5 w-1.5 rounded-full",
                  isIndexed ? "bg-emerald-500" : "bg-slate-600"
                )}
              />
              {isIndexed ? "PDF + general mode" : "General mode only"}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
          {messages.length === 0 ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[28px] border border-indigo-500/20 bg-gradient-to-br from-indigo-500/15 to-violet-500/10 shadow-[0_20px_60px_rgba(99,102,241,0.15)]">
                <FileSearch className="h-8 w-8 text-indigo-300" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-100">
                  {isIndexed ? "Analyze documents with transparent reasoning" : "A polished RAG workspace for technical documents"}
                </h2>
                <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                  {isIndexed
                    ? "Use follow-up questions, ask for evidence, and inspect the retrieval path for each answer."
                    : "Upload a PDF to activate grounded retrieval, citations, and routing explainability. You can still ask general questions right now."}
                </p>
              </div>

              <div className="grid w-full max-w-3xl gap-3 md:grid-cols-3">
                <div className="rounded-[24px] border border-slate-800/70 bg-slate-950/50 p-4 text-left">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-indigo-300/80">Routing</p>
                  <p className="mt-2 text-sm text-slate-300">Each question is routed between PDF-grounded retrieval and general knowledge.</p>
                </div>
                <div className="rounded-[24px] border border-slate-800/70 bg-slate-950/50 p-4 text-left">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-violet-300/80">Evidence</p>
                  <p className="mt-2 text-sm text-slate-300">Responses expose source snippets, pages, and the retrieval query behind the answer.</p>
                </div>
                <div className="rounded-[24px] border border-slate-800/70 bg-slate-950/50 p-4 text-left">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-300/80">Arabic-ready</p>
                  <p className="mt-2 text-sm text-slate-300">The interface supports readable Arabic and English interactions inside the same workspace.</p>
                </div>
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
                    className="rounded-2xl border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-xs text-slate-400 transition-all hover:border-slate-600 hover:bg-slate-800/80 hover:text-slate-200"
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

      <div className="shrink-0 bg-slate-950/35 px-4 pb-5 pt-3 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl">
          <div
            className={clsx(
              "flex items-end gap-3 rounded-[26px] border px-4 py-3 transition-all duration-200",
              "bg-slate-900/80 border-slate-700/60 shadow-[0_12px_32px_rgba(2,6,23,0.25)] focus-within:border-indigo-500/60 focus-within:glow-indigo-sm"
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
              dir={inputLooksArabic ? "rtl" : "ltr"}
              className={clsx(
                "flex-1 resize-none bg-transparent text-sm leading-relaxed text-slate-200 outline-none placeholder:text-slate-600 disabled:cursor-not-allowed",
                inputLooksArabic ? "message-direction-rtl" : "message-direction-ltr"
              )}
              style={{ maxHeight: "160px" }}
            />
            <button
              onClick={sendMessage}
              disabled={!canSend}
              className={clsx(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-all duration-200",
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
          <div className="mt-2 flex flex-col gap-1 text-center text-[10px] text-slate-500 md:flex-row md:items-center md:justify-between">
            <span>Supports Arabic & English · Explainable RAG</span>
            <span>Built for document QA, follow-ups, and source-grounded analysis</span>
          </div>
        </div>
      </div>
    </div>
  );
}
