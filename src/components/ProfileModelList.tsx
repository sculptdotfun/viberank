"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { splitProfileModelRows, type ProfileModelEntry } from "@/lib/profile-models";

interface ProfileModelListProps {
  entries: ProfileModelEntry[];
  modelTotal: number;
  hasModelCosts: boolean;
  initialLimit?: number;
}

export default function ProfileModelList({
  entries,
  modelTotal,
  hasModelCosts,
  initialLimit = 8,
}: ProfileModelListProps) {
  const [expanded, setExpanded] = useState(false);
  const rows = splitProfileModelRows(entries, { limit: initialLimit, expanded });
  const total = modelTotal || 1;

  return (
    <div className="space-y-3">
      {rows.visible.map(([name, value]) => (
        <div key={name}>
          <div className="flex justify-between items-center mb-1.5 gap-2">
            <span className="text-xs font-mono truncate">{name}</span>
            <span className="font-mono text-xs text-muted flex-shrink-0">
              {hasModelCosts ? `$${formatCurrency(value)}` : `${value}d`}
              <span className="text-muted/60"> · {Math.round((value / total) * 100)}%</span>
            </span>
          </div>
          <div className="w-full bg-surface-3 rounded-full h-1.5">
            <div
              className="bg-accent h-1.5 rounded-full"
              style={{ width: `${Math.max((value / total) * 100, 1)}%` }}
            />
          </div>
        </div>
      ))}

      {rows.canExpand && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs font-mono text-muted transition-colors hover:text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? "Show fewer" : `Show ${rows.hidden.length} more`}
          </button>
          {!expanded && rows.hiddenTotal > 0 && (
            <span className="font-mono text-xs text-muted/60">
              {hasModelCosts ? `$${formatCurrency(rows.hiddenTotal)}` : `${rows.hiddenTotal}d`}
            </span>
          )}
        </div>
      )}

      {!hasModelCosts && (
        <p className="text-[11px] text-muted/70 pt-1">
          Cost split per model appears after the next <code className="font-mono">npx viberank-cli</code> submission.
        </p>
      )}
    </div>
  );
}
