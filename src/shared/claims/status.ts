import type { StatusTone } from "@/components/ui/status-badge";

/**
 * Legacy claimStatusTone (app-flow.js, MR 15893): the dot's tone from the status as shown, since the claims tables
 * carry the lookup value, not the code. Empty text has no dot.
 */
export function claimStatusTone(text: string): StatusTone | null {
  const t = text.toLowerCase();
  if (t === "") return null;
  if (/reject|ineligible/.test(t)) return "danger";
  if (/rework/.test(t)) return "rework";
  if (/payment/.test(t)) return "info";
  if (/approved|complete|paid/.test(t)) return "success";
  if (/review|submitted|notified|in process/.test(t)) return "warning";
  return "neutral";
}
