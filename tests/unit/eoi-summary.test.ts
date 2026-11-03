import { expect, it } from "vitest";
import {
  summaryView,
  type OpportunityRecord,
} from "@/server/modules/opportunities/eoi-record/opportunity";
const record = {
  opportunities_id: 1,
  opp_heading: "Synthetic call",
  opportunity_status: "Open",
  site: "Funder site",
  site_url: "https://funder.example",
  call: "CALL-1",
  programme: "Programme A",
  currency_code: "GBP",
  aoi_app_count: 2,
  create_application_of_interest: "Y",
  create_outline_application: "Y",
  create_grant_application: "Y",
} as OpportunityRecord;
const row = (label_name: string, is_visible: "Y" | "N" | null) => ({
  module_name: "OPPORTUNITIES-EOI",
  label_type: "labels",
  label_name,
  label_value: null,
  is_visible,
});
const roles = [
  "opportunities-eoi-count",
  "apply-opportunities",
  "convert-opportunity",
  "convert-opportunity-to-proposal",
].map((page_name) => ({ page_name, read_access: "Y", edit_access: "Y" }));
it("shows RB-driven summary fields, counts and actions only on an explicit 'Y' row", () => {
  const rows = [
    row("summary-status", "Y"),
    row("summary-site", "N"),
    row("summary-call-code", "Y"),
    row("summary-programme", null),
    row("aoi-count", "Y"),
    row("apply", "Y"),
    row("convert", "N"),
  ];
  const view = summaryView(record, rows, roles, undefined, true);
  expect(view.side.map((f) => f.key)).toEqual(["summary-status"]);
  expect(view.details.map((f) => f.key)).toEqual(["summary-call-code"]);
  expect(view.counts).toHaveLength(1);
  expect(view.actions.apply).not.toBeNull();
  expect(view.actions.convert).toBeNull();
  expect(view.actions.convertToProposal).toBeNull();
  // No rows at all (bundle unreadable): nothing RB-driven shows.
  const bare = summaryView(record, [], roles, undefined, true);
  expect([...bare.side, ...bare.details, ...bare.counts]).toEqual([]);
  expect(Object.values(bare.actions).every((a) => a === null)).toBe(true);
});
