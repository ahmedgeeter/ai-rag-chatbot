"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import ChatWindow from "@/components/ChatWindow";

export default function Home() {
  const [isIndexed, setIsIndexed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onIndexed={() => setIsIndexed(true)} onReset={() => setIsIndexed(false)} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <ChatWindow isIndexed={isIndexed} />
      </main>
    </div>
  );
}
