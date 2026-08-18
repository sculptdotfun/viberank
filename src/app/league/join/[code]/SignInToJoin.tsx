"use client";

import { signIn } from "next-auth/react";
import { LogIn } from "lucide-react";
import { usePathname } from "next/navigation";

export default function SignInToJoin() {
  const pathname = usePathname();
  return (
    <button
      onClick={() => signIn("github", { callbackUrl: pathname ?? "/leagues" })}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
    >
      <LogIn className="w-4 h-4" />
      Sign in with GitHub to join
    </button>
  );
}
