import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import CliCta from "@/components/CliCta";

// Reached from shared or mistyped links, and often by the person the link
// names before they've ever submitted, so it offers the way on rather than
// only the way back.
export default function ProfileNotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavBar />
      <main className="flex-1 w-full max-w-xl mx-auto px-6 py-20">
        <h1 className="text-2xl font-semibold mb-2">Profile not found</h1>
        <p className="text-muted mb-6">No one has submitted under this username.</p>
        <CliCta title="Is this you?" source="profile_not_found">
          Submit with one command and this page is yours. It ranks Claude Code, Codex, Gemini and more.
        </CliCta>
        <Link
          href="/"
          className="inline-flex items-center gap-2 mt-8 text-accent hover:text-accent-hover transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to leaderboard
        </Link>
      </main>
      <Footer />
    </div>
  );
}
