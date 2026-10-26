"use client";

import { signIn } from "next-auth/react";

/**
 * Coming back to the submit modal after GitHub sign-in.
 *
 * Uploads need a session. The modal used to let people choose a file, then
 * refuse it, and sign-in returned them to the page with the modal closed and
 * the file gone. Now sign-in comes first and lands back here with
 * `?submit=1`, which NavBar turns into an open modal.
 */

const SUBMIT_PARAM = "submit";

/** Sign in with GitHub, then return to this page with the submit modal open. */
export function signInAndReopenSubmit() {
  const url = new URL(window.location.href);
  url.searchParams.set(SUBMIT_PARAM, "1");
  signIn("github", { callbackUrl: `${url.pathname}${url.search}${url.hash}` });
}

/**
 * True when this page load should open the submit modal. Removes the
 * parameter, so a reload or a copied link doesn't reopen it.
 */
export function takeSubmitParam(): boolean {
  const url = new URL(window.location.href);
  if (url.searchParams.get(SUBMIT_PARAM) !== "1") return false;
  url.searchParams.delete(SUBMIT_PARAM);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  return true;
}
