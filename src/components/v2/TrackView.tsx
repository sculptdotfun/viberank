"use client";

import { useEffect } from "react";
import { viewTracked, type ViewEvent } from "@/lib/analytics";

/** Fires one analytics view event when a server-rendered page mounts. Renders nothing. */
export default function TrackView({ event, props }: { event: ViewEvent; props?: Record<string, string | number> }) {
  const key = JSON.stringify(props ?? {});
  useEffect(() => {
    viewTracked(event, JSON.parse(key) as Record<string, string | number>);
  }, [event, key]);
  return null;
}
