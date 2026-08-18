"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Users } from "lucide-react";

/**
 * One-line launch announcement, dismissible forever per `id`. Change the id
 * for a future announcement and everyone sees it exactly once again — no
 * server state, no nagging.
 */
export default function AnnouncementBanner({ id, href, children }: {
  id: string;
  href: string;
  children: React.ReactNode;
}) {
  const key = `viberank-announcement-${id}`;
  // Start hidden so SSR/hydration match; reveal only for un-dismissed browsers.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(key)) setVisible(true);
    } catch {
      // Storage blocked — better to stay quiet than to nag on every load.
    }
  }, [key]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(key, "1");
    } catch {
      // Session-only dismissal is fine.
    }
  };

  return (
    <div className="bg-surface-1 border-b border-accent/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-3 text-sm">
        <Users className="w-4 h-4 text-accent flex-shrink-0" />
        <Link href={href} onClick={dismiss} className="flex-1 min-w-0 truncate text-foreground hover:text-accent transition-colors">
          {children}
        </Link>
        <button
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="text-muted hover:text-foreground transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
