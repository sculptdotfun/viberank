/**
 * Sequencing for hooks that fire a new request whenever their params change.
 *
 * Without this, responses are applied in whatever order they arrive. Scroll to
 * page 2 of the leaderboard and switch the sort before it lands, and the older
 * page-2 response can resolve after the newer page-0 one and repaint rows that
 * do not match the filters on screen. The `finally` of the stale request also
 * clears the loading flag belonging to the newer one.
 *
 * Kept as a plain object rather than inlined in each hook so the rule is
 * written and tested once instead of five times.
 */
export interface RequestGate {
  /** Start a request and get the token identifying it. */
  begin(): number;
  /** True only for the most recently started request. */
  isCurrent(token: number): boolean;
  /**
   * Abandon every in-flight request. Used on unmount and when a hook switches
   * to "skip", so a late arrival cannot set state afterwards.
   */
  abandon(): void;
}

export function createRequestGate(): RequestGate {
  let latest = 0;
  return {
    begin: () => ++latest,
    isCurrent: (token) => token === latest,
    // Bumping past every outstanding token invalidates all of them at once.
    abandon: () => { latest++; },
  };
}
