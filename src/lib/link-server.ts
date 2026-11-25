/**
 * Server-only wiring for the device link: the store, the rate limiter and the
 * token/claim calls, picked for the current backend. The demo backend keeps
 * links in memory and has no rate limit, so the flow works in local dev.
 */

import { createClient } from "@supabase/supabase-js";
import { getDatabaseBackend, getServerDataLayer } from "@/lib/data";
import { createMemoryLinkStore, type IssueToken, type LinkStore } from "@/lib/link-flow";

export interface LinkBackend {
  store: LinkStore;
  /** Resolves to the seconds to wait, or null when allowed. */
  limit(type: "linkStart" | "linkApprove", key: string): Promise<number | null>;
  issueToken: IssueToken;
  claim(githubUsername: string): Promise<number>;
}

let memoryStore: LinkStore | null = null;
let backend: LinkBackend | null = null;

export async function getLinkBackend(): Promise<LinkBackend> {
  if (backend) return backend;
  const data = await getServerDataLayer();

  const issueToken: IssueToken = async (username, githubUsername, label) => {
    const { plaintext, token } = await data.tokens.issue(username, githubUsername, label);
    return { plaintext, id: token.id };
  };
  const claim = async (githubUsername: string) => {
    try {
      const result = await data.submissions.claimAndMergeSubmissions(githubUsername);
      return result.mergedCount ?? 0;
    } catch (error) {
      // Someone linking before their first submit has nothing to claim.
      if (error instanceof Error && error.message === "No submissions found") return 0;
      throw error;
    }
  };

  if (getDatabaseBackend() === "demo") {
    memoryStore ??= createMemoryLinkStore();
    backend = { store: memoryStore, limit: async () => null, issueToken, claim };
    return backend;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables not set");
  const client = createClient(url, key);
  const [{ createSupabaseLinkStore }, { SupabaseRateLimiter }] = await Promise.all([
    import("@/lib/data/supabase/link"),
    import("@/lib/data/supabase/rate-limiter"),
  ]);
  const limiter = new SupabaseRateLimiter(client);
  backend = {
    store: createSupabaseLinkStore(client),
    async limit(type, k) {
      const result = await limiter.checkLimit(type, k);
      if (result.allowed) return null;
      return Math.max(1, Math.ceil(((result.retryAfter ?? Date.now()) - Date.now()) / 1000));
    },
    issueToken,
    claim,
  };
  return backend;
}
