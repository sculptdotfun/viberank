import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ProfileNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">Profile not found</h1>
        <p className="text-muted mb-6">No one has submitted under this username.</p>
        <Link href="/" className="inline-flex items-center gap-2 text-accent hover:text-accent-hover transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to leaderboard
        </Link>
      </div>
    </div>
  );
}
