import type { Metadata } from "next";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: {
    default: 'AI Coding Costs, Limits & Usage Data — the Viberank Blog',
  },
  description: 'Data-backed writing on what AI coding actually costs: Claude Code and Codex usage limits, real spend benchmarks from 1,100+ developers, and how to measure your own.',
  // Without a self-canonical the index competes with its own posts for the
  // informational queries it collects impressions on.
  alternates: { canonical: 'https://www.viberank.app/blog' },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavBar />
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-12">
        {children}
      </main>
      <Footer />
    </div>
  );
}
