import { placeholderModules } from "@/lib/unavailable-modules";
import { awardHref } from "@/features/modules/awards/links";
const recordId = /^[1-9]\d{0,14}$/;
const proposalTypes = [
  "PROPOSAL",
  "OUTLINE_PROPOSAL",
  "SUB_PROPOSAL",
  "EXTENSION_PROPOSAL",
];
// Legacy opportunities pages (webApps/app/flows/opportunities/pages) that have a route here.
const opportunityPages: Record<string, string> = {
  "opportunities-finder": "/opportunities",
  "opportunities-eoi-list": "/opportunities/eoi",
  "opportunities-analytics": "/opportunities/analytics",
};
/**
 * Repairs a backend link whose `&` separators became `=` (legacy shell beforeEnterHandlerChain.js:24-48):
 * `<detail_id>=<id>=<mode>=shell=<module>=<page>`.
 */
function legacyParams(search: string) {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const parts = raw.split("=");
  if (raw.includes("&") || parts.length !== 6 || parts[3] !== "shell")
    return new URLSearchParams(raw);
  const fixed = new URLSearchParams();
  fixed.set(parts[0], parts[1]);
  fixed.set("mode", parts[2]);
  fixed.set("page", "shell");
  fixed.set("shell", parts[4]);
  fixed.set(parts[4], parts[5]);
  return fixed;
}
/**
 * The route for a legacy VBCS deep link `?page=shell&shell=<module>&<module>=<page>&<id>=…` (H26), or null
 * when the query is not one. Unknown modules land on Home; the target route still authenticates.
 */
export function legacyDeepLink(search: string): string | null {
  const params = legacyParams(search);
  if (params.get("page") !== "shell") return null;
  const flow = params.get("shell") ?? "";
  const page = (params.get(flow) ?? "").split("/")[0];
  if (flow === "proposals") {
    const id = params.get("proposal_id") ?? "",
      type = params.get("proposal_type") ?? "";
    return page === "proposals-info-start" &&
      recordId.test(id) &&
      proposalTypes.includes(type)
      ? `/proposals/${type}/${id}`
      : "/proposals";
  }
  if (flow === "awards") {
    const id = params.get("award_id") ?? "";
    return page === "awards-detail" && recordId.test(id)
      ? awardHref(id)
      : "/awards";
  }
  if (flow === "opportunities") {
    const id = params.get("request_id") ?? "";
    if (page === "opportunities-eoi" && recordId.test(id))
      return `/opportunities/eoi/${id}/summary`;
    return opportunityPages[page] ?? "/opportunities";
  }
  if (flow === "contracts") {
    const id = params.get("contract_id") ?? "";
    return page === "contracts-new-contract" && recordId.test(id)
      ? `/contracts/${id}`
      : "/contracts";
  }
  // A page id names the drawer child (claims=claims-unit-inquiry…); otherwise the flow names the module.
  const placeholder =
    placeholderModules.find(
      (m) => page === m.id || page.startsWith(`${m.id}-`),
    ) ?? placeholderModules.find((m) => m.id === flow);
  return placeholder ? `/modules/${placeholder.id}` : "/home";
}
