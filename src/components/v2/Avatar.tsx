"use client";

import { useEffect, useRef, useState } from "react";
import { getGitHubAvatarUrl, sizedAvatarUrl } from "@/lib/utils";
import { isGithubHandle } from "@/lib/profile-index";

/**
 * A developer's avatar with a lettered fallback: shown when there is no
 * avatar URL, and when the image fails to load (a renamed GitHub account
 * leaves a dead URL behind, which rendered as an empty box).
 */
export default function Avatar({
  src,
  github,
  name,
  size,
  className = "",
  priority = false,
}: {
  src?: string | null;
  /** GitHub login, for the avatar GitHub serves when none is stored. */
  github?: string | null;
  name: string;
  size: number;
  className?: string;
  priority?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // An image that failed before hydration never fires onError for React.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setBroken(true);
  }, []);
  const style = { width: size, height: size };
  // No stored avatar: GitHub serves one for any real login.
  const url = src || (github && isGithubHandle(github) ? getGitHubAvatarUrl(github, size * 2) : null);
  if (!url || broken) {
    return (
      <span
        aria-hidden
        style={{ ...style, fontSize: Math.round(size * 0.42) }}
        className={`inline-flex flex-none items-center justify-center bg-raised border border-line-2 text-ink-2 font-medium uppercase select-none ${className}`}
      >
        {name.replace(/^@/, "").charAt(0) || "?"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={sizedAvatarUrl(url, size * 2)}
      alt=""
      width={size}
      height={size}
      style={style}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      onError={() => setBroken(true)}
      className={`flex-none object-cover bg-raised border border-line-2 ${className}`}
    />
  );
}
