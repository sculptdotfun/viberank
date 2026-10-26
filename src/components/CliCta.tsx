"use client";

import { useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { Check, Copy, Trophy } from "lucide-react";
import { cliCommandCopied, type CopySource } from "@/lib/analytics";
import { CLI_COMMAND } from "@/lib/commands";

interface CliCtaProps {
  title: string;
  children?: ReactNode;
  /** Which page the copy came from, for the cli_command_copied event. */
  source: CopySource;
  /**
   * The handle whose own visits shouldn't see the card. A shared profile is
   * mostly seen by people who aren't on the board yet; its owner already is.
   */
  hideFor?: string;
}

/** "Want yours?"-style card with the CLI command and a copy button. */
export default function CliCta({ title, children, source, hideFor }: CliCtaProps) {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);

  const viewer = session?.user?.username;
  if (hideFor && viewer && viewer.toLowerCase() === hideFor.toLowerCase()) return null;

  const copy = () => {
    navigator.clipboard.writeText(CLI_COMMAND);
    cliCommandCopied(source);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-accent/40 bg-surface-1 p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
      <div className="min-w-0 flex-1">
        <p className="font-medium flex items-center gap-2">
          <Trophy className="w-4 h-4 text-accent flex-shrink-0" />
          {title}
        </p>
        {children && <p className="text-sm text-muted mt-1">{children}</p>}
      </div>
      <button
        onClick={copy}
        aria-label={`Copy ${CLI_COMMAND}`}
        className="group flex items-center justify-between gap-3 rounded-md bg-background border border-border hover:border-accent/50 px-3 py-2.5 transition-colors sm:flex-shrink-0"
      >
        <span className="flex items-center gap-2">
          <span className="text-accent font-mono text-sm">$</span>
          <code className="font-mono text-sm text-accent">{CLI_COMMAND}</code>
        </span>
        {copied ? (
          <Check className="w-4 h-4 text-success" />
        ) : (
          <Copy className="w-4 h-4 text-muted group-hover:text-foreground transition-colors" />
        )}
      </button>
    </div>
  );
}
