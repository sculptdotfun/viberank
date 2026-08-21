import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Users, Trophy } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getServerDataLayer } from "@/lib/data";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import SignInToJoin from "./SignInToJoin";
import TrackInviteOpen from "./TrackInviteOpen";

interface JoinParams {
  params: Promise<{ code: string }>;
}

export const metadata: Metadata = {
  title: "Join a league | Viberank",
  description: "Join a private AI coding leaderboard with an invite code.",
  robots: { index: false, follow: false },
};

// Invite links resolve per-visitor; never cache a join.
export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: JoinParams) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw);
  const session = await getServerSession(authOptions);

  if (session?.user?.username) {
    let slug: string | null = null;
    let error: string | null = null;
    try {
      const dataLayer = await getServerDataLayer();
      const league = await dataLayer.leagues.joinByCode(code, session.user.username);
      slug = league.slug;
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not join.";
    }
    if (slug) redirect(`/league/${slug}`);

    return (
      <div className="min-h-screen bg-background">
        <TrackInviteOpen signedIn />
        <NavBar />
        <div className="max-w-xl mx-auto px-6 py-16 text-center">
          <p className="font-medium mb-2">That didn&apos;t work</p>
          <p className="text-sm text-muted mb-6">{error}</p>
          <Link href="/leagues" className="text-accent hover:underline text-sm">
            Back to leagues
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  // Signed out: show what they were invited to before asking for anything.
  // Whoever sent the code meant for them to see this league.
  let preview: { name: string; memberCount: number } | null = null;
  try {
    const dataLayer = await getServerDataLayer();
    const found = await dataLayer.leagues.previewByCode(code);
    if (found) preview = { name: found.league.name, memberCount: found.memberCount };
  } catch {
    // fall through to the generic invite screen
  }

  return (
    <div className="min-h-screen bg-background">
      <TrackInviteOpen signedIn={false} />
      <NavBar />
      <div className="max-w-xl mx-auto px-6 py-16">
        <p className="micro-label mb-3">League invite</p>

        {preview ? (
          <>
            <h1 className="font-mono text-2xl font-bold tracking-tight mb-3">
              You&apos;ve been invited to {preview.name}
            </h1>
            <div className="rounded-lg border border-border bg-surface-1 p-5 mb-6">
              <div className="flex items-center gap-6">
                <div>
                  <div className="micro-label mb-1.5 flex items-center gap-1.5">
                    <Trophy className="w-3 h-3" /> League
                  </div>
                  <div className="font-mono text-lg font-bold text-foreground">{preview.name}</div>
                </div>
                <div>
                  <div className="micro-label mb-1.5 flex items-center gap-1.5">
                    <Users className="w-3 h-3" /> Members
                  </div>
                  <div className="font-mono text-lg font-bold text-foreground">{preview.memberCount}</div>
                </div>
              </div>
            </div>
            <p className="text-muted mb-6 leading-relaxed">
              A friend league ranks its members by real AI coding usage — the same measured spend and tokens as the
              public board, just among people you know. Sign in with GitHub to accept; leagues hang off your GitHub
              identity, same as the verified badge.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-mono text-2xl font-bold tracking-tight mb-2">You&apos;re invited</h1>
            <p className="text-muted mb-6">
              Sign in with GitHub to accept — leagues hang off your GitHub identity, same as the verified badge.
            </p>
          </>
        )}

        <SignInToJoin />

        <p className="text-xs text-muted mt-6">
          New to viberank? Joining also puts you on the{" "}
          <Link href="/" className="text-accent hover:underline">
            public leaderboard
          </Link>{" "}
          once you run <code className="font-mono text-accent">npx viberank-cli</code>. Only usage totals are ever
          submitted — never code or prompts.
        </p>
      </div>
      <Footer />
    </div>
  );
}
