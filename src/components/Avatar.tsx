"use client";

import { useEffect, useRef, useState } from "react";
import { User } from "lucide-react";
import { getGitHubAvatarUrl, sizedAvatarUrl } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  githubUsername?: string | null;
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showRing?: boolean;
  /** Above-the-fold avatars: fetch eagerly at high priority instead of lazy. */
  priority?: boolean;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
};

const iconSizes = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
};

const textSizes = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

function getInitials(name?: string): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function generateGradient(name?: string): string {
  // Generate a consistent solid color based on the name (flat — no gradient)
  const colors = [
    "bg-orange-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-emerald-500",
    "bg-rose-500",
    "bg-indigo-500",
    "bg-teal-500",
    "bg-amber-500",
  ];

  if (!name) return colors[0];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

export default function Avatar({
  src,
  githubUsername,
  name,
  size = "md",
  className = "",
  showRing = true,
  priority = false,
}: AvatarProps) {
  // Determine the image sources. Request 2x the display size for retina, and
  // never the full-res original — stored avatar URLs have no size param. If
  // the stored URL 404s (renamed/deleted account), fall back to the
  // username-derived CDN URL before giving up and showing initials.
  const sizePixels = size === "sm" ? 32 : size === "md" ? 40 : 48;
  const fetchSize = sizePixels * 2;
  const candidates: string[] = [];
  if (src) candidates.push(sizedAvatarUrl(src, fetchSize));
  if (githubUsername) {
    const fromUsername = getGitHubAvatarUrl(githubUsername, fetchSize);
    if (!candidates.includes(fromUsername)) candidates.push(fromUsername);
  }

  const [srcIndex, setSrcIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const displayName = name || githubUsername || "User";
  const initials = getInitials(displayName);
  const gradient = generateGradient(displayName);
  const imageSrc = candidates[srcIndex];

  // If the image finished (or failed) before React hydrated, the onLoad /
  // onError handlers never fire and the img would stay at opacity-0 forever.
  // Re-check the element's actual state after mount.
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !img.complete) return;
    if (img.naturalWidth > 0) {
      setIsLoading(false);
    } else {
      setSrcIndex((i) => i + 1);
    }
  }, [imageSrc]);

  const ringClass = showRing ? "ring-2 ring-border/20" : "";

  // Show fallback if no image or every candidate failed to load
  if (!imageSrc) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center ${ringClass} ${className} ${
          initials
            ? gradient
            : "bg-card"
        }`}
      >
        {initials ? (
          <span className={`${textSizes[size]} font-semibold text-white`}>
            {initials}
          </span>
        ) : (
          <User className={`${iconSizes[size]} text-muted`} />
        )}
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} relative ${className}`}>
      {/* Loading skeleton */}
      {isLoading && (
        <div className={`absolute inset-0 rounded-full bg-card ${ringClass} animate-pulse`} />
      )}
      <img
        ref={imgRef}
        key={imageSrc}
        src={imageSrc}
        alt={displayName}
        width={sizePixels}
        height={sizePixels}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className={`${sizeClasses[size]} rounded-full ${ringClass} object-cover ${
          isLoading ? "opacity-0" : "opacity-100"
        } transition-opacity duration-150`}
        onLoad={() => setIsLoading(false)}
        onError={() => setSrcIndex((i) => i + 1)}
      />
    </div>
  );
}
