import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      // The Codex guide answers "how do I check my Codex usage" but lived at a
      // slug that read "leaderboard". Search Console showed 9.1k impressions at
      // an average position of 7 converting at 0.71% — people scanning results
      // for a how-to skipped a URL that promised a ranking table. Permanent so
      // the accumulated authority follows the slug.
      {
        source: "/blog/codex-token-usage-leaderboard",
        destination: "/blog/how-to-check-codex-usage",
        permanent: true,
      },
      // /claude-rank-tracker chased "claude rank tracker" — which turns out to
      // mean AI-visibility tracking (does *your brand* get cited inside Claude's
      // answers), a category with eight funded vendors and no overlap with what
      // viberank measures. 7,319 impressions, zero clicks, and Google rated the
      // dedicated page below the homepage for the same queries.
      {
        source: "/claude-rank-tracker",
        destination: "/tool/claude",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
