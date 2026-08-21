"use client";

import { track } from "@vercel/analytics";

/**
 * Client-side funnel events.
 *
 * Two questions were unanswerable before this existed: does search traffic ever
 * become a submission, and where does the league invite funnel break. Both were
 * dark because only the terminal step (a row landing in the database) was ever
 * recorded — a league with two members is equally consistent with "nobody saw
 * the banner", "nobody shared the code", and "the join page is broken", and
 * those need different fixes.
 *
 * Deliberately a thin wrapper over the analytics already installed rather than
 * a second vendor: the event names are the asset, and they stay stable if the
 * backend is swapped later. Names are snake_case and past-tense-or-noun so they
 * read consistently in a funnel builder.
 */

type Props = Record<string, string | number | boolean | null>;

function emit(event: string, props?: Props) {
  try {
    if (props) track(event, props);
    else track(event);
  } catch {
    // Analytics must never break a user flow. A blocked script, an ad blocker,
    // or a server-side render all land here and all should be silent.
  }
}

/* ---------- submission funnel ---------- */

/** Submit modal opened. `from` distinguishes nav, empty state, post-search CTA. */
export const submitOpened = (from: string) => emit("submit_opened", { from });

/** `npx viberank-cli` copied — the CLI path's intent signal. */
export const cliCommandCopied = () => emit("cli_command_copied");

/** `npx viberank-cli autosubmit` copied — the retention intent signal. */
export const autosubmitCommandCopied = () => emit("autosubmit_command_copied");

/** Landed on the token page, i.e. started enabling autosubmit for real. */
export const tokenPageViewed = (from: string) => emit("token_page_viewed", { from });

/** A token was minted — the closest proxy for autosubmit actually being set up. */
export const tokenMinted = () => emit("token_minted");

/* ---------- league funnel ---------- */

export const leagueBannerClicked = () => emit("league_banner_clicked");
export const leagueCreated = () => emit("league_created");
/** The invite code was copied — the step between creating and anyone joining. */
export const leagueInviteCopied = () => emit("league_invite_copied");
/** An invite link was opened. `signedIn` splits the auth wall from disinterest. */
export const leagueInviteOpened = (signedIn: boolean) =>
  emit("league_invite_opened", { signed_in: signedIn });
export const leagueJoined = () => emit("league_joined");

/* ---------- data / citation funnel ---------- */

/** Someone copied the citation line — a leading indicator of an inbound link. */
export const citationCopied = () => emit("citation_copied");
/** The public API was surfaced to a human (docs page, not the endpoint itself). */
export const apiDocsViewed = () => emit("api_docs_viewed");
