import type { Metadata } from "next";

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
    <div className="min-h-screen bg-stone-950">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {children}
      </div>
    </div>
  );
}