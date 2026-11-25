"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Check, Copy, Swords, X } from "lucide-react";
import { challengeText, parseHandle, sameHandle, vsUrl } from "@/lib/v2/invite";

const BTN = "inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-md text-[13px] font-medium transition-colors";

/**
 * "Challenge": type a GitHub handle, get a /vs link to copy or post. The
 * challenger is the signed-in visitor when there is one, else the card's
 * owner (the person sharing their own card). A signed-in visitor on someone
 * else's card gets that person prefilled as the opponent.
 */
export default function ChallengeButton({ owner }: { owner: string }) {
  const { data: session } = useSession();
  const login = session?.user?.username ?? null;
  const me = login ?? owner;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [rank, setRank] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const start = () => {
    setValue(login && !sameHandle(login, owner) ? owner : "");
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    // The post says "I'm #41": read the challenger's live rank.
    const ctrl = new AbortController();
    fetch(`/api/v2/standing/${encodeURIComponent(me)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { rank?: number | null } | null) => setRank(typeof s?.rank === "number" ? s.rank : null))
      .catch(() => setRank(null));
    return () => {
      window.removeEventListener("keydown", onKey);
      ctrl.abort();
    };
  }, [open, me]);

  const opponent = parseHandle(value);
  const self = opponent !== null && sameHandle(opponent, me);
  const ready = opponent !== null && !self;
  const link = ready ? vsUrl(me, opponent) : "";
  const error = value.trim() === "" ? null : self ? "That's you. Pick someone else." : opponent === null ? "That doesn't look like a GitHub handle." : null;

  const post = () => {
    if (!ready) return;
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(challengeText(opponent, rank))}&url=${encodeURIComponent(link)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const copy = async () => {
    if (!ready) return;
    await navigator.clipboard.writeText(`${challengeText(opponent, rank)} ${link}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <>
      <button type="button" onClick={start} className={`${BTN} border border-line-2 text-ink hover:bg-raised`}>
        <Swords className="w-3.5 h-3.5" />
        Challenge
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="challenge-h">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-[440px] border border-line-2 rounded-[14px] bg-panel p-5 sm:p-6 shadow-2xl">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="absolute top-3 right-3 p-1.5 rounded-md text-ink-3 hover:text-ink hover:bg-raised">
              <X className="w-4 h-4" />
            </button>
            <p className="font-mono text-[12px] text-ink-3 m-0">head to head · this week</p>
            <h2 id="challenge-h" className="text-[22px] font-medium tracking-[-0.03em] text-ink mt-1 mb-1">Challenge someone</h2>
            <p className="text-[13.5px] text-ink-2 m-0 mb-4">
              {me} against a GitHub handle. If they aren&apos;t on viberank yet, the link invites them.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                post();
              }}
            >
              <label className="flex items-center gap-1 border border-line-2 rounded-[10px] bg-bg px-3 h-11 focus-within:border-ink-3">
                <span className="font-mono text-[15px] text-ink-3">@</span>
                <span className="sr-only">GitHub handle</span>
                <input
                  ref={input}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="github-handle"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="flex-1 min-w-0 bg-transparent outline-none font-mono text-[15px] text-ink placeholder:text-ink-3"
                />
              </label>
              <p className={`font-mono text-[12px] mt-2 mb-0 min-h-[18px] break-all ${error ? "text-down" : "text-ink-3"}`}>
                {error ?? (ready ? link.replace("https://www.", "") : "")}
              </p>
              {ready && (
                <p className="text-[13px] leading-relaxed text-ink-2 bg-raised border border-line rounded-md px-3 py-2 mt-2 mb-0">
                  {challengeText(opponent, rank)} {link.replace("https://www.", "")}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button type="submit" disabled={!ready} className={`${BTN} bg-btn text-btn-ink hover:opacity-90 disabled:opacity-40`}>
                  Post to X
                </button>
                <button type="button" onClick={copy} disabled={!ready} className={`${BTN} border border-line-2 text-ink hover:bg-raised disabled:opacity-40`}>
                  {copied ? <Check className="w-3.5 h-3.5 text-up" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
              {ready && (
                <a href={link.replace("https://www.viberank.app", "")} className="block text-center font-mono text-[12px] text-ink-3 hover:text-ink mt-3">
                  Open the head-to-head →
                </a>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
