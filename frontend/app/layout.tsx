import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "RAG Chat — AI PDF Assistant",
  description: "Chat with your documents using Groq-powered AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} bg-slate-950 text-slate-100 antialiased h-screen overflow-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
