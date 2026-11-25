import type { ReactNode } from "react";

/** Page title block for the board pages, in the landing's type scale. */
export default function PageHead({ eyebrow, title, children }: { eyebrow?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <header className="vr-phead">
      {eyebrow && <div className="vr-status">{eyebrow}</div>}
      <h1 className="vr-h1 sm">{title}</h1>
      {children && <div className="vr-lede">{children}</div>}
    </header>
  );
}
