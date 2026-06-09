"use client";

import dynamic from "next/dynamic";

// recharts is ~100KB gz — keep it out of the profile page's critical bundle
// and swap in once loaded. The skeleton mirrors the chart card's footprint.
const UsageChart = dynamic(() => import("./UsageChart"), {
  ssr: false,
  loading: () => (
    <div className="bg-surface-1 border border-border rounded-lg p-5 mb-6 animate-pulse" aria-hidden>
      <div className="h-5 w-36 rounded bg-surface-3 mb-4" />
      <div className="h-[260px] rounded bg-surface-2" />
    </div>
  ),
});

export default UsageChart;
