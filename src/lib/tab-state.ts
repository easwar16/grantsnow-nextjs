/** Legacy endSessionHandler: per-tab state (installments) does not outlive the session; storage may be blocked. */
export function clearTabState() {
  try {
    sessionStorage.clear();
  } catch {
    // Nothing stored to clear.
  }
}
