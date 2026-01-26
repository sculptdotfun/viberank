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
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {children}
      </div>
    </div>
  );
}