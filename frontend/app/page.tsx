"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import ChatWindow from "@/components/ChatWindow";

export default function Home() {
  const [isIndexed, setIsIndexed] = useState(false);

  return (
    <div className="h-screen overflow-hidden p-3 md:p-4">
      <div className="relative flex h-full flex-col gap-3 lg:flex-row">
        <div className="pointer-events-none absolute inset-0 rounded-[32px] border border-slate-800/60 bg-white/[0.015]" />
        <Sidebar onIndexed={() => setIsIndexed(true)} onReset={() => setIsIndexed(false)} />
        <main className="relative z-10 flex min-w-0 flex-1 overflow-hidden rounded-[28px] surface-panel">
          <ChatWindow isIndexed={isIndexed} />
        </main>
      </div>
    </div>
  );
}
