import assert from "node:assert/strict";
import { mock } from "node:test";

const normalized = {
  totals: {
    inputTokens: 1,
    outputTokens: 1,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 2,
    totalCost: 0.01,
  },
  daily: [
    {
      date: "2026-01-01",
      inputTokens: 1,
      outputTokens: 1,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 2,
      totalCost: 0.01,
      modelsUsed: ["test-model"],
      agents: ["test"],
    },
  ],
  tools: ["test"],
};

mock.module("next-auth", {
  exports: { getServerSession: async () => null },
});
mock.module("@/lib/auth", {
  exports: { authOptions: {} },
});
mock.module("@/lib/data", {
  exports: {
    getDatabaseBackend: () => "supabase",
    getServerDataLayer: async () => ({
      submissions: {
        submit: async () => {
          throw new Error("Database operation timed out");
        },
      },
    }),
  },
});
mock.module("@/lib/ccusage", {
  exports: { normalizeCcData: () => normalized },
});
mock.module("@/lib/data/supabase/rawArchive", {
  exports: { archiveRawSubmission: async () => undefined },
});
mock.module("@/lib/sponsor", {
  exports: { getCliNotice: () => null },
});
mock.module("@vercel/analytics/server", {
  exports: { track: async () => undefined },
});

const { POST } = await import("../src/app/api/submit/route.ts");

const request = new Request("https://www.viberank.app/api/submit", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-github-user": "timeout-regression",
  },
  body: JSON.stringify({ daily: [{}], totals: normalized.totals }),
});

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
console.log = () => undefined;
console.error = () => undefined;
let response: Awaited<ReturnType<typeof POST>>;
try {
  response = await POST(request as never);
} finally {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
}
const body = await response.json();

assert.equal(response.status, 504, `expected 504, got ${response.status}: ${JSON.stringify(body)}`);
assert.equal(
  body.error,
  "Request timed out. Please try again or submit smaller batches of data."
);

console.log("✓ timed-out submission maps to a 504 timeout response");
