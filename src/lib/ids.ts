/**
 * A record or config key as a readable id part (owner rule: unique, short, kebab-case ids): camelCase splits on its
 * capitals, and anything outside a-z0-9 becomes one dash, e.g. "pPendingApprovals" → "p-pending-approvals",
 * "UK Research Council" → "uk-research-council".
 */
export function idPart(key: string | number) {
  return (
    String(key)
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "none"
  );
}
