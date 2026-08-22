import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import TokensClient from "./TokensClient";

export const metadata: Metadata = {
  title: "API tokens | Viberank",
  description: "Create an API token so viberank-cli can submit on a schedule without a browser.",
  // A page about credentials has no business in search results.
  robots: { index: false, follow: false },
};

export default async function TokensPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 micro-label text-muted hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Leaderboard
        </Link>

        <h1 className="text-3xl font-bold tracking-tight mb-3">API tokens</h1>
        <p className="text-muted leading-relaxed mb-8">
          A scheduled submission can&apos;t open a browser to sign in, so it carries a token
          instead. Tokens also mark your submissions as verified, which an{" "}
          <code className="text-accent">X-GitHub-User</code> header can&apos;t do — anyone can set
          that header to any name.
        </p>

        <TokensClient signedIn={Boolean(session?.user?.username)} />

        <section className="mt-12">
          <p className="micro-label mb-3">Using it</p>
          <pre className="bg-surface-1 border border-border rounded-lg p-4 text-sm overflow-x-auto">
            <code>{`npx viberank-cli login       # paste the token once
npx viberank-cli autosubmit  # daily backup, in the background`}</code>
          </pre>
          <p className="text-xs text-muted mt-3 leading-relaxed">
            The token is stored in <code>~/.viberank/config.json</code> with owner-only
            permissions. Anything holding it can submit as you, so treat it like a password —
            revoke it here if it leaks, and the access ends immediately.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
