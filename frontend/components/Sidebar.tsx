"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  FileText,
  FileSearch,
  Github,
  Linkedin,
  Loader2,
  RefreshCw,
  UploadCloud,
  Zap,
} from "lucide-react";
import clsx from "clsx";

type UploadStatus = "idle" | "uploading" | "ready" | "error";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Props {
  onIndexed: () => void;
  onReset: () => void;
}

export default function Sidebar({ onIndexed, onReset }: Props) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [filename, setFilename] = useState<string | null>(null);
  const [chunks, setChunks] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [uploadStartedAt, setUploadStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    if (status !== "uploading" || uploadStartedAt === null) {
      setElapsedSeconds(0);
      return;
    }

    const tick = () => {
      setElapsedSeconds(Math.max(1, Math.floor((Date.now() - uploadStartedAt) / 1000)));
    };

    tick();
    const interval = window.setInterval(tick, 1000);

    return () => window.clearInterval(interval);
  }, [status, uploadStartedAt]);

  const uploadFile = useCallback(
    async (file: File) => {
      setStatus("uploading");
      setFilename(file.name);
      setErrorMsg("");
      setUploadStartedAt(Date.now());

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch(`${API}/upload`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail ?? "Upload failed");
        }

        const data = await res.json();
        setChunks(data.chunks);
        setStatus("ready");
        setUploadStartedAt(null);
        onIndexed();
      } catch (e) {
        const message =
          e instanceof TypeError
            ? `Cannot reach backend at ${API}. Check the backend deployment and NEXT_PUBLIC_API_URL configuration.`
            : e instanceof Error
              ? e.message
              : "Upload failed";
        setErrorMsg(message);
        setUploadStartedAt(null);
        setStatus("error");
      }
    },
    [onIndexed]
  );

  const reset = () => {
    setStatus("idle");
    setFilename(null);
    setChunks(0);
    setErrorMsg("");
    setUploadStartedAt(null);
    setElapsedSeconds(0);
    onReset();
  };

  const uploadHint =
    elapsedSeconds >= 20
      ? "Still indexing… if this is your first PDF, the embeddings model may still be downloading."
      : "Uploading, extracting text, and building the index…";

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: status === "uploading",
    onDrop: (accepted) => {
      if (accepted.length > 0) uploadFile(accepted[0]);
    },
  });

  return (
    <aside className="relative z-10 flex w-full shrink-0 flex-col overflow-hidden rounded-[28px] surface-panel lg:h-full lg:w-[340px]">
      <div className="border-b border-slate-800/60 px-5 py-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-100 leading-tight">
                RAG Intelligence Workspace
              </p>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-300">
                Live demo
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Multilingual retrieval, grounded answers, and transparent routing for document-aware AI chat.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-950/60 px-3 py-2">
            <Bot className="h-4 w-4 text-indigo-300" />
            <div>
              <p className="text-[11px] font-medium text-slate-200">Agentic routing</p>
              <p className="text-[10px] text-slate-500">PDF-grounded or general knowledge per question</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-950/60 px-3 py-2">
            <FileSearch className="h-4 w-4 text-violet-300" />
            <div>
              <p className="text-[11px] font-medium text-slate-200">Inspectable retrieval</p>
              <p className="text-[10px] text-slate-500">View chunks, pages, and routing rationale</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="rounded-[24px] border border-slate-800/70 bg-slate-950/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                Document workspace
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Upload one PDF to build the retrieval index and activate grounded answers.
              </p>
            </div>
          </div>

          {(status === "idle" || status === "error") && (
            <div
              {...getRootProps()}
              className={clsx(
                "relative flex cursor-pointer flex-col items-center gap-3 rounded-[22px] border-2 border-dashed p-6",
                "transition-all duration-300 ease-out outline-none",
                isDragActive
                  ? "border-indigo-500 bg-indigo-500/5 glow-indigo"
                  : "border-slate-700/80 bg-slate-950/40 hover:border-slate-500 hover:bg-slate-900/70"
              )}
            >
              <input {...getInputProps()} />

              {isDragActive && (
                <div className="pointer-events-none absolute inset-0 rounded-[22px] border-2 border-indigo-400 opacity-30 animate-ping" />
              )}

              <div
                className={clsx(
                  "flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300",
                  isDragActive
                    ? "bg-indigo-500/20 text-indigo-400"
                    : "bg-slate-800 text-slate-500"
                )}
              >
                <UploadCloud className="w-6 h-6" />
              </div>

              <div className="text-center">
                <p className="text-sm font-medium text-slate-200">
                  {isDragActive ? "Release to upload" : "Drop a PDF here"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Drag and drop or click to browse. Best for specs, RFCs, research notes, and manuals.
                </p>
              </div>

              {status === "error" && (
                <div className="mt-1 flex w-full items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-2.5">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <p className="text-xs leading-snug text-red-400">{errorMsg}</p>
                </div>
              )}
            </div>
          )}

          {status === "uploading" && (
            <div className="flex flex-col items-center gap-3 rounded-[22px] border border-slate-700/60 bg-slate-900/50 p-5">
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10">
                  <FileText className="h-5 w-5 text-indigo-400" />
                </div>
                <Loader2 className="absolute -bottom-0.5 -right-0.5 h-5 w-5 animate-spin text-indigo-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-200">Indexing…</p>
                <p className="mt-0.5 max-w-[160px] truncate text-xs text-slate-500" title={filename ?? ""}>
                  {filename}
                </p>
                <p className="mt-2 max-w-[220px] text-[11px] leading-relaxed text-slate-500">
                  {uploadHint}
                </p>
                {elapsedSeconds > 0 && (
                  <p className="mt-1 text-[10px] text-slate-400">{elapsedSeconds}s elapsed</p>
                )}
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-slate-700">
                <div className="h-full w-1/2 animate-[shimmer_1.5s_ease-in-out_infinite] rounded-full bg-indigo-500" />
              </div>
            </div>
          )}

          {status === "ready" && (
            <div className="flex flex-col gap-4 rounded-[22px] border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-100">Ready to inspect</p>
                  <p className="mt-0.5 truncate text-xs text-slate-400" title={filename ?? ""}>
                    {filename}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 px-3 py-3 text-center">
                  <p className="text-lg font-bold text-indigo-400">{chunks}</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">chunks</p>
                </div>
                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 px-3 py-3 text-center">
                  <p className="text-lg font-bold text-violet-400">5</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">top-k</p>
                </div>
                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 px-3 py-3 text-center">
                  <p className="text-lg font-bold text-pink-400">800</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">chars</p>
                </div>
              </div>

              <button
                onClick={reset}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-800/70 bg-slate-950/60 py-2 text-xs text-slate-300 transition-colors hover:border-slate-700 hover:text-slate-100"
              >
                <RefreshCw className="h-3 w-3" />
                Upload another PDF
              </button>
            </div>
          )}
        </div>

        <div className="rounded-[22px] border border-slate-800/70 bg-slate-950/50 p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
            What this demo shows
          </p>
          <div className="mt-3 space-y-3 text-xs text-slate-400">
            <div className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400" />
              <p>Grounded answers with page-aware citations and source snippets.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-400" />
              <p>Agentic routing between uploaded-document context and general knowledge.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <p>Transparent inspector metadata for explainability and debugging.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800/60 px-5 py-4">
        <div className="mb-3 rounded-2xl border border-slate-800/70 bg-slate-950/50 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Built by Ahmed</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <a
              href="https://github.com/ahmedgeeter"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800/70 bg-slate-950/70 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-slate-700 hover:text-white"
            >
              <Github className="h-3.5 w-3.5" />
              <span>GitHub</span>
            </a>
            <a
              href="https://www.linkedin.com/in/ahmed-ai-dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800/70 bg-slate-950/70 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-slate-700 hover:text-white"
            >
              <Linkedin className="h-3.5 w-3.5" />
              <span>LinkedIn</span>
            </a>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>LangChain · Groq · FAISS</span>
          <span>Arabic + English</span>
        </div>
      </div>
    </aside>
  );
}
