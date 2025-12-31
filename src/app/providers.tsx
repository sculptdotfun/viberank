"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { SessionProvider } from "next-auth/react";
import { ReactNode, useMemo } from "react";
import { clientEnv } from "@/lib/env";

export function Providers({ children }: { children: ReactNode }) {
  // Always create the Convex client - hooks need the provider even when skipping queries
  // This prevents "Could not find Convex client" errors when backend is supabase
  const convexClient = useMemo(() => {
    return new ConvexReactClient(clientEnv.NEXT_PUBLIC_CONVEX_URL);
  }, []);

  return (
    <SessionProvider>
      <ConvexProvider client={convexClient}>{children}</ConvexProvider>
    </SessionProvider>
  );
}