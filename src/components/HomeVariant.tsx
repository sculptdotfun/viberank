"use client";

import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";
import { boardHref, DEFAULT_HOME_VARIANT, type HomeVariant } from "@/lib/home-flag";

// The root layout reads VIBERANK_HOME on the server and hands it down here,
// so client components (the nav, the footer inside client trees) link the
// weekly board without reading env themselves.
const HomeVariantContext = createContext<HomeVariant>(DEFAULT_HOME_VARIANT);

export function HomeVariantProvider({ variant, children }: { variant: HomeVariant; children: ReactNode }) {
  return <HomeVariantContext.Provider value={variant}>{children}</HomeVariantContext.Provider>;
}

export function useHomeVariant(): HomeVariant {
  return useContext(HomeVariantContext);
}

/** "/" once the home is v2, "/week" before. */
export function useBoardHref(): "/" | "/week" {
  return boardHref(useHomeVariant());
}

/** A link to the weekly board, for server components such as the footer. */
export function BoardLink({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Link href={useBoardHref()} className={className}>
      {children}
    </Link>
  );
}
