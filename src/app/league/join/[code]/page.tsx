import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerDataLayer } from "@/lib/data";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import SignInToJoin from "./SignInToJoin";

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

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="max-w-xl mx-auto px-6 py-16">
        <p className="micro-label mb-3">League invite</p>
        <h1 className="font-mono text-2xl font-bold tracking-tight mb-2">You&apos;re invited</h1>
        <p className="text-muted mb-6">
          Sign in with GitHub to accept — leagues hang off your GitHub identity, same as the verified badge.
        </p>
        <SignInToJoin />
      </div>
      <Footer />
    </div>
  );
}
