"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { clientEnv } from "@/lib/env";

const convex = new ConvexReactClient(clientEnv.NEXT_PUBLIC_CONVEX_URL);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ConvexProvider client={convex}>{children}</ConvexProvider>
    </SessionProvider>
  );
}