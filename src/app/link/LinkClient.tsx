"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import type { LinkPageState } from "@/lib/link";
import s from "./link.module.css";

type State = LinkPageState | "none" | "error";

interface Props {
  code: string | null;
  rawCode: string;
  state: State;
  username: string | null;
}

const DEAD: Record<"invalid" | "unknown" | "expired" | "used" | "error", { title: string; text: string }> = {
  invalid: { title: "That isn't a viberank code", text: "Codes look like HXKT-4Q2M. Check the one in your terminal and type it below." },
  unknown: { title: "No sign-in is waiting for that code", text: "It may be mistyped, or from an old run. Type the code your terminal shows, or run npx viberank-cli login again." },
  expired: { title: "That code expired", text: "Codes last 10 minutes. Run npx viberank-cli login in your terminal for a fresh one." },
  used: { title: "That code was already used", text: "If your terminal says you're signed in, you're done. Otherwise run npx viberank-cli login again." },
  error: { title: "Something went wrong on our side", text: "Reload this page in a moment. Your terminal keeps waiting for up to 10 minutes." },
};

/** Lets someone type the code when the browser didn't open on its own. */
function CodeForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (v) router.push(`/link?code=${encodeURIComponent(v)}`);
  };
  return (
    <form className={s.row} onSubmit={submit}>
      <input
        className={s.input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="XXXX-XXXX"
        aria-label="Code from your terminal"
        autoComplete="off"
        spellCheck={false}
        maxLength={12}
      />
      <button type="submit" className={s.primary}>Continue</button>
    </form>
  );
}

export default function LinkClient({ code, rawCode, state, username }: Props) {
  const [phase, setPhase] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [dead, setDead] = useState<keyof typeof DEAD | null>(null);
  const here = code ? `/link?code=${encodeURIComponent(code)}` : "/link";

  if (state === "none") {
    return (
      <section className={s.card}>
        <p className={s.label}>Enter the code from your terminal</p>
        <p className={s.text}>Run <b>npx viberank-cli login</b> and type the code it prints.</p>
        <CodeForm initial="" />
      </section>
    );
  }

  const deadState = dead ?? (state === "pending" ? null : state);
  if (deadState) {
    const d = DEAD[deadState];
    return (
      <section className={s.card}>
        <p className={s.label}>{rawCode || "No code"}</p>
        <p className={s.ok} style={{ color: "var(--ink)" }}>{d.title}</p>
        <p className={s.text}>{d.text}</p>
        {(deadState === "invalid" || deadState === "unknown") && <CodeForm initial="" />}
      </section>
    );
  }

  if (phase === "done") {
    return (
      <section className={s.card}>
        <p className={s.ok}>✓ Connected as @{username}</p>
        <p className={s.text}>
          <b>Back to your terminal.</b> It picks this up within a few seconds, submits signed, and you are on the Ranked board.
        </p>
        <p className={s.label}>You can close this tab.</p>
      </section>
    );
  }

  const approve = async () => {
    setPhase("busy");
    setError(null);
    try {
      const res = await fetch("/api/v2/link/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCode: code }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      if (res.ok) return setPhase("done");
      if (body.code && body.code in DEAD) setDead(body.code as keyof typeof DEAD);
      else setError(body.error ?? "Could not approve right now. Try again in a minute.");
    } catch {
      setError("Could not reach viberank. Check your connection and try again.");
    }
    setPhase("idle");
  };

  return (
    <section className={s.card}>
      <p className={s.label}>Confirm this matches your terminal</p>
      <p className={s.code}>{code}</p>
      {error && <p className={s.error}>{error}</p>}
      {username ? (
        <>
          <p className={s.text}>
            This machine will submit as <b>@{username}</b>, verified. Your earlier unverified submissions under that name become yours.
          </p>
          <div className={s.row}>
            <button type="button" className={s.primary} onClick={approve} disabled={phase === "busy"}>
              {phase === "busy" ? "Approving…" : "Approve"}
            </button>
            <button type="button" className={s.quiet} onClick={() => signOut({ callbackUrl: here })}>
              Not @{username}? Switch account
            </button>
          </div>
        </>
      ) : (
        <>
          <p className={s.text}>Sign in with GitHub so we know whose usage this is. You come straight back here.</p>
          <button type="button" className={s.primary} onClick={() => signIn("github", { callbackUrl: here })}>
            Sign in with GitHub
          </button>
        </>
      )}
      <p className={s.warn}>Only approve a code you just saw in your own terminal. Anyone holding an approved code can submit as you.</p>
    </section>
  );
}
