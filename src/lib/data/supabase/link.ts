/**
 * cli_link_codes (migration 025) behind the LinkStore interface. Every state
 * change is a conditional update on the current status, so two racing
 * requests cannot both approve a code or both receive its token.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LinkStore } from "@/lib/link-flow";
import type { LinkRow, LinkStatus } from "@/lib/link";

const COLUMNS = "id, user_code, device_code_hash, status, username, github_username, created_at, expires_at, last_polled_at, token_id";
const UNIQUE_VIOLATION = "23505";

interface DbRow {
  id: string;
  user_code: string;
  device_code_hash: string;
  status: LinkStatus;
  username: string | null;
  github_username: string | null;
  created_at: string;
  expires_at: string;
  last_polled_at: string | null;
  token_id: string | null;
}

function toRow(r: DbRow): LinkRow {
  return {
    id: r.id,
    userCode: r.user_code,
    deviceHash: r.device_code_hash,
    status: r.status,
    username: r.username,
    githubUsername: r.github_username,
    createdAt: Date.parse(r.created_at),
    expiresAt: Date.parse(r.expires_at),
    lastPolledAt: r.last_polled_at ? Date.parse(r.last_polled_at) : null,
    tokenId: r.token_id,
  };
}

const iso = (ms: number) => new Date(ms).toISOString();

export function createSupabaseLinkStore(client: SupabaseClient): LinkStore {
  const one = async (column: string, value: string): Promise<LinkRow | null> => {
    const { data, error } = await client.from("cli_link_codes").select(COLUMNS).eq(column, value).limit(1);
    if (error) throw new Error(`Failed to query link code: ${error.message}`);
    const row = (data ?? [])[0] as DbRow | undefined;
    return row ? toRow(row) : null;
  };

  const transition = async (id: string, from: LinkStatus, patch: Record<string, unknown>): Promise<boolean> => {
    const { data, error } = await client
      .from("cli_link_codes")
      .update(patch)
      .eq("id", id)
      .eq("status", from)
      .select("id");
    if (error) throw new Error(`Failed to update link code: ${error.message}`);
    return (data ?? []).length > 0;
  };

  return {
    async create({ userCode, deviceHash, expiresAt }) {
      const { error } = await client
        .from("cli_link_codes")
        .insert({ user_code: userCode, device_code_hash: deviceHash, expires_at: iso(expiresAt) });
      if (!error) return "ok";
      if (error.code === UNIQUE_VIOLATION) return "collision";
      throw new Error(`Failed to create link code: ${error.message}`);
    },
    byDeviceHash: (hash) => one("device_code_hash", hash),
    byUserCode: (code) => one("user_code", code),
    async touchPoll(id, at) {
      await client.from("cli_link_codes").update({ last_polled_at: iso(at) }).eq("id", id);
    },
    markApproved: (id, who, at) =>
      transition(id, "pending", {
        status: "approved",
        username: who.username,
        github_username: who.githubUsername,
        approved_at: iso(at),
      }),
    markConsumed: (id, at) => transition(id, "approved", { status: "consumed", consumed_at: iso(at) }),
    async revertConsumed(id) {
      await transition(id, "consumed", { status: "approved", consumed_at: null });
    },
    async setTokenId(id, tokenId) {
      await client.from("cli_link_codes").update({ token_id: tokenId }).eq("id", id);
    },
  };
}
