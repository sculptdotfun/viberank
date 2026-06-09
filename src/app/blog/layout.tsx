import type { Metadata } from "next";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: {
    template: '%s | Viberank Blog',
    default: 'Blog | Viberank',
  },
  description: 'Insights on AI-powered development, Claude Code, vibe coding, and the future of programming.',
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
