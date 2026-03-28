import type { Metadata } from "next";
import { Cairo, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-arabic",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "RAG Intelligence Workspace",
  description: "Explainable multilingual RAG workspace with document grounding, citations, and routing transparency.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${cairo.variable} min-h-screen bg-slate-950 text-slate-100 antialiased overflow-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
