"use client";

import { useState } from "react";
import { User } from "lucide-react";
import { getGitHubAvatarUrl } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  githubUsername?: string | null;
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showRing?: boolean;
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
  // Generate a consistent gradient based on the name
  const colors = [
    "from-orange-500 to-amber-500",
    "from-blue-500 to-cyan-500",
    "from-purple-500 to-pink-500",
    "from-green-500 to-emerald-500",
    "from-red-500 to-rose-500",
    "from-indigo-500 to-violet-500",
    "from-teal-500 to-cyan-500",
    "from-yellow-500 to-orange-500",
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
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const displayName = name || githubUsername || "User";
  const initials = getInitials(displayName);
  const gradient = generateGradient(displayName);

  // Determine the image source
  let imageSrc = src;
  if (!imageSrc && githubUsername) {
    const sizePixels = size === "sm" ? 32 : size === "md" ? 40 : 48;
    imageSrc = getGitHubAvatarUrl(githubUsername, sizePixels);
  }

  const ringClass = showRing ? "ring-2 ring-border/20" : "";

  // Show fallback if no image or image failed to load
  if (!imageSrc || imageError) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center ${ringClass} ${className} ${
          initials
            ? `bg-gradient-to-br ${gradient}`
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
        src={imageSrc}
        alt={displayName}
        className={`${sizeClasses[size]} rounded-full ${ringClass} object-cover ${
          isLoading ? "opacity-0" : "opacity-100"
        } transition-opacity duration-200`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setImageError(true);
          setIsLoading(false);
        }}
      />
    </div>
  );
}
