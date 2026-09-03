/**
 * Full reload to the landing. Signing out and deleting the account both end here so
 * nothing of the old session (query cache, realtime channels) survives in memory.
 * Kept apart because real navigation cannot be observed under jsdom: tests mock this.
 */
export function reloadToRoot(): void {
  window.location.replace('/');
}
