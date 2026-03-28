"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Eye, EyeOff, FileText } from "lucide-react";
import clsx from "clsx";
import type { Message } from "@/lib/types";

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const [showSources, setShowSources] = useState(false);
  const isUser = message.role === "user";
  const hasSources = (message.sources?.length ?? 0) > 0;

  return (
    <div
      className={clsx(
        "flex gap-3 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={clsx(
          "w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold mt-0.5",
          isUser
            ? "bg-indigo-600 text-white"
            : "bg-gradient-to-br from-violet-600 to-indigo-600 text-white"
        )}
      >
        {isUser ? "U" : "AI"}
      </div>

      {/* Bubble */}
      <div
        className={clsx(
          "flex flex-col gap-1 max-w-[80%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={clsx(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-indigo-600 text-white rounded-tr-sm"
              : "bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-tl-sm"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <>
              {message.content ? (
                <div
                  className={clsx(
                    "prose-sm prose-invert max-w-none",
                    message.isStreaming && "streaming-cursor"
                  )}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => (
                        <p className="mb-2 last:mb-0 text-slate-200">{children}</p>
                      ),
                      h1: ({ children }) => (
                        <h1 className="text-lg font-bold mb-2 mt-3 text-slate-100">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-base font-bold mb-2 mt-3 text-slate-100">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-sm font-bold mb-1 mt-2 text-slate-100">{children}</h3>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc ml-5 mb-2 space-y-0.5 text-slate-300">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal ml-5 mb-2 space-y-0.5 text-slate-300">{children}</ol>
                      ),
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      code: ({ className, children, ...props }) => {
                        const isBlock = Boolean(className);
                        return isBlock ? (
                          <code
                            className={`${className ?? ""} font-mono text-xs text-indigo-300`}
                            {...props}
                          >
                            {children}
                          </code>
                        ) : (
                          <code
                            className="bg-slate-700/70 text-indigo-300 px-1.5 py-0.5 rounded text-xs font-mono"
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      },
                      pre: ({ children }) => (
                        <pre className="bg-slate-900/80 border border-slate-700/40 text-slate-200 p-3 rounded-lg my-2 overflow-x-auto text-xs font-mono">
                          {children}
                        </pre>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-indigo-500/60 pl-3 my-2 text-slate-400 italic">
                          {children}
                        </blockquote>
                      ),
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {children}
                        </a>
                      ),
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-2 rounded-lg border border-slate-700/50">
                          <table className="min-w-full text-xs">{children}</table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th className="border-b border-slate-700 px-3 py-2 bg-slate-800 text-left font-semibold text-slate-300">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="border-b border-slate-700/40 px-3 py-2 text-slate-400">
                          {children}
                        </td>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-slate-100">{children}</strong>
                      ),
                      em: ({ children }) => (
                        <em className="italic text-slate-300">{children}</em>
                      ),
                      hr: () => <hr className="border-slate-700/60 my-3" />,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
                /* Thinking dots while waiting for first token */
                <div className="flex items-center gap-1 py-0.5">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              )}
            </>
          )}
        </div>

        {!isUser && !message.isStreaming && (message.responseTime !== undefined || message.route) && (
          <div className="flex items-center gap-2 px-1 text-[11px] text-slate-500">
            {message.responseTime !== undefined && (
              <span>Generated in {message.responseTime.toFixed(1)}s</span>
            )}
            {message.responseTime !== undefined && message.route && (
              <span className="text-slate-700">·</span>
            )}
            {message.route && (
              <span>
                {message.route === "pdf" ? "From PDF context" : "From general knowledge"}
              </span>
            )}
          </div>
        )}

        {/* Sources toggle — only visible on completed assistant messages */}
        {!isUser && !message.isStreaming && hasSources && (
          <div className="w-full">
            <button
              onClick={() => setShowSources((v) => !v)}
              className={clsx(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all duration-200",
                showSources
                  ? "text-indigo-400 bg-indigo-500/10"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
              )}
              title={showSources ? "Hide sources" : "Show sources"}
            >
              {showSources ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              <span>
                {showSources ? "Hide" : "Show"} {message.sources!.length} source
                {message.sources!.length !== 1 ? "s" : ""}
              </span>
            </button>

            {/* Source snippets panel */}
            <div className={clsx("source-panel", showSources && "open")}>
              <div>
                <div className="mt-2 flex flex-col gap-2">
                  {message.sources!.map((src, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-3 text-xs"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5 text-slate-500">
                        <FileText className="w-3 h-3 text-indigo-500" />
                        <span className="font-medium text-indigo-400/80">
                          {src.source || "Document"}
                        </span>
                        {src.page > 0 && (
                          <>
                            <span className="text-slate-700">·</span>
                            <span>Page {src.page}</span>
                          </>
                        )}
                      </div>
                      <p className="text-slate-400 leading-relaxed line-clamp-4">
                        {src.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
