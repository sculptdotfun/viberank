import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { PARSER_VERSION } from "@/lib/ccusage";

/**
 * Best-effort archive of pre-normalization submission payloads (migration
 * 006). Keeping the raw ccusage output lets us re-parse history when the
 * normalizer changes shape again — without it, every format change is a
 * one-way door for already-submitted data.
 *
 * Never throws: archiving must not block or fail a submission, including when
 * the migration hasn't been applied yet.
 */

let client: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) throw new Error("Supabase server environment variables not set");
    client = createClient(url, serviceKey);
  }
  return client;
}

export interface RawArchiveMeta {
  username: string;
  source: "cli" | "oauth";
  machineId?: string;
  cliVersion?: string;
}

export async function archiveRawSubmission(payload: unknown, meta: RawArchiveMeta): Promise<void> {
  try {
    const json = JSON.stringify(payload);
    const sha256 = createHash("sha256").update(json).digest("hex");

    const { error } = await getServiceClient()
      .from("raw_submissions")
      .upsert(
        {
          payload_sha256: sha256,
          username: meta.username,
          source: meta.source,
          machine_id: meta.machineId ?? null,
          cli_version: meta.cliVersion ?? null,
          parser_version: PARSER_VERSION,
          payload: JSON.parse(json),
        },
        { onConflict: "payload_sha256", ignoreDuplicates: true }
      );

    if (error) console.error("Raw archive insert failed:", error.message);
  } catch (e) {
    console.error("Raw archive failed:", e instanceof Error ? e.message : e);
  }
}
