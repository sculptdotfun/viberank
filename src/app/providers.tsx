"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { HomeVariantProvider } from "@/components/HomeVariant";
import type { HomeVariant } from "@/lib/home-flag";

export function Providers({ children, homeVariant }: { children: ReactNode; homeVariant: HomeVariant }) {
  return (
    <SessionProvider>
      <HomeVariantProvider variant={homeVariant}>{children}</HomeVariantProvider>
    </SessionProvider>
  );
}
