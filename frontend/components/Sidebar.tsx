"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
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
            ? `Cannot reach backend at ${API}. Start the FastAPI server and try again.`
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
    <aside className="w-72 shrink-0 flex flex-col h-screen bg-slate-900 border-r border-slate-800/60">
      {/* ── Logo ─────────────────────────────────────── */}
      <div className="px-5 py-5 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100 leading-tight">
              RAG Chat
            </p>
            <p className="text-[10px] text-slate-500 leading-tight">
              llama3-70b · Groq
            </p>
          </div>
        </div>
      </div>

      {/* ── Upload section ───────────────────────────── */}
      <div className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto">
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest px-1">
          Document
        </p>

        {/* Drop Zone */}
        {(status === "idle" || status === "error") && (
          <div
            {...getRootProps()}
            className={clsx(
              "relative rounded-xl border-2 border-dashed p-6 flex flex-col items-center gap-3 cursor-pointer",
              "transition-all duration-300 ease-out outline-none",
              isDragActive
                ? "border-indigo-500 bg-indigo-500/5 glow-indigo"
                : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/40"
            )}
          >
            <input {...getInputProps()} />

            {/* animated ring on drag */}
            {isDragActive && (
              <div className="absolute inset-0 rounded-xl border-2 border-indigo-400 animate-ping opacity-30 pointer-events-none" />
            )}

            <div
              className={clsx(
                "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
                isDragActive
                  ? "bg-indigo-500/20 text-indigo-400"
                  : "bg-slate-800 text-slate-500"
              )}
            >
              <UploadCloud className="w-6 h-6" />
            </div>

            <div className="text-center">
              <p className="text-sm font-medium text-slate-300">
                {isDragActive ? "Release to upload" : "Drop PDF here"}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                or click to browse
              </p>
            </div>

            {status === "error" && (
              <div className="w-full mt-1 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-400 leading-snug">{errorMsg}</p>
              </div>
            )}
          </div>
        )}

        {/* Uploading / Indexing state */}
        {status === "uploading" && (
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5 flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-indigo-400" />
              </div>
              <Loader2 className="absolute -bottom-0.5 -right-0.5 w-5 h-5 text-indigo-400 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-200">Indexing…</p>
              <p
                className="text-xs text-slate-500 mt-0.5 max-w-[160px] truncate"
                title={filename ?? ""}
              >
                {filename}
              </p>
              <p className="text-[11px] text-slate-600 mt-2 max-w-[200px] leading-relaxed">
                {uploadHint}
              </p>
              {elapsedSeconds > 0 && (
                <p className="text-[10px] text-slate-500 mt-1">{elapsedSeconds}s elapsed</p>
              )}
            </div>
            {/* progress bar shimmer */}
            <div className="w-full h-1 rounded-full bg-slate-700 overflow-hidden">
              <div className="h-full w-1/2 bg-indigo-500 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" />
            </div>
          </div>
        )}

        {/* Ready state */}
        {status === "ready" && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200">Ready to chat</p>
                <p
                  className="text-xs text-slate-500 truncate mt-0.5"
                  title={filename ?? ""}
                >
                  {filename}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <div className="text-center">
                <p className="text-lg font-bold text-indigo-400">{chunks}</p>
                <p className="text-[10px] text-slate-500">chunks</p>
              </div>
              <div className="h-8 w-px bg-slate-700/60" />
              <div className="text-center">
                <p className="text-lg font-bold text-violet-400">5</p>
                <p className="text-[10px] text-slate-500">top-k</p>
              </div>
              <div className="h-8 w-px bg-slate-700/60" />
              <div className="text-center">
                <p className="text-lg font-bold text-pink-400">800</p>
                <p className="text-[10px] text-slate-500">chars</p>
              </div>
            </div>

            <button
              onClick={reset}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Upload another PDF
            </button>
          </div>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────── */}
      <div className="px-5 py-4 border-t border-slate-800/60">
        <p className="text-[10px] text-slate-600 text-center leading-relaxed">
          Powered by{" "}
          <span className="text-slate-500">LangChain</span> &{" "}
          <span className="text-slate-500">Groq</span>
        </p>
      </div>
    </aside>
  );
}
