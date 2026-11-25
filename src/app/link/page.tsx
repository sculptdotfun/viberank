import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import PageHead from "@/components/v2/PageHead";
import { authOptions } from "@/lib/auth";
import { lookupLink } from "@/lib/link-flow";
import { getLinkBackend } from "@/lib/link-server";
import type { LinkPageState } from "@/lib/link";
import LinkClient from "./LinkClient";

export const metadata: Metadata = {
  title: "Connect your terminal | viberank",
  description: "Approve the code your terminal shows to verify with GitHub and join the Ranked board.",
  robots: { index: false, follow: false },
};

// Per-visitor and per-code: never cached.
export const dynamic = "force-dynamic";

export default async function LinkPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const params = await searchParams;
  const raw = Array.isArray(params.code) ? params.code[0] : params.code;
  const session = await getServerSession(authOptions);

  let code: string | null = null;
  let state: LinkPageState | "none" | "error" = "none";
  if (raw) {
    try {
      const found = await lookupLink((await getLinkBackend()).store, raw, Date.now());
      code = found.code;
      state = found.state;
    } catch (error) {
      console.error("[link page]", error instanceof Error ? error.message : error);
      state = "error";
    }
  }

  return (
    <div className="vr">
      <NavBar />
      <main className="vr-in">
        <PageHead eyebrow={<span>viberank-cli</span>} title="Connect your terminal.">
          One click verifies you with GitHub, puts you on the Ranked board, and lets this machine submit signed from now on.
        </PageHead>
        <LinkClient
          code={code}
          rawCode={raw ?? ""}
          state={state}
          username={session?.user?.username ?? null}
        />
      </main>
      <Footer />
    </div>
  );
}
