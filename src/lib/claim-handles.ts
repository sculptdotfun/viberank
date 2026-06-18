export interface ClaimableSubmissionIdentity {
  username?: string | null;
  githubUsername?: string | null;
  source?: "cli" | "oauth" | null;
  verified?: boolean | null;
}

export function normalizeClaimHandle(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "");
}

export function isClaimableCliAlias(
  signedInGithubUsername: string,
  submission: ClaimableSubmissionIdentity
): boolean {
  if (submission.source !== "cli" || submission.verified) return false;

  const signed = normalizeClaimHandle(signedInGithubUsername);
  if (!signed) return false;

  return [submission.username, submission.githubUsername].some(
    (value) => normalizeClaimHandle(value) === signed
  );
}
