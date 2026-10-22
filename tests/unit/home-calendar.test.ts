import { expect, it } from "vitest";
import {
  eventDay,
  eventTitle,
  providerOf,
  providersOf,
  toCalendarEvents,
  viewLabel,
} from "@/features/home/components/calendar/model";
import type { AttentionRow } from "@/features/home/types";
import { mapWidget } from "@/server/home/service";
import { widgets } from "@/server/home/widgets";

const row = (over: Partial<AttentionRow>): AttentionRow => ({
  id: "1:1",
  reference: "P_1",
  title: "Title",
  href: "/proposals/PROPOSAL/1",
  date: "2026-10-22",
  ...over,
});
const filters = { offset: 0 } as Parameters<typeof mapWidget>[2];
const mapped = (id: string, item: Record<string, unknown>) =>
  mapWidget(
    { items: [item] },
    widgets.find((w) => w.id === id)!,
    filters,
    new Date(2026, 9, 22),
  ).attention[0];

it("derives the legacy provider from the server row link and proposal number prefix", () => {
  expect(
    providerOf(
      mapped("cApproachingDeadlines", {
        contract_id: 7,
        contract_number: "C_7",
      }),
    ),
  ).toBe("CONTRACT");
  expect(
    providerOf(
      mapped("ePendingApprovals", {
        setup_flow_id: 3,
        application_number: "E_3",
      }),
    ),
  ).toBe("ETHICS");
  expect(
    providerOf(mapped("aApprovedAwards", { award_id: 2, award_number: "A_2" })),
  ).toBe("AWARD");
  expect(
    providerOf(
      mapped("eoiPendingApprovals", { request_id: 9, request_number: "R_9" }),
    ),
  ).toBe("AOI");
  expect(providerOf(row({ reference: "OP_1" }))).toBe("OUTLINE_PROPOSAL");
  expect(
    providerOf(row({ reference: "SP_1", href: "/proposals?reference=SP_1" })),
  ).toBe("SUB_PROPOSAL");
  expect(providerOf(row({}))).toBe("PROPOSAL");
  expect(viewLabel("SUB_PROPOSAL")).toBe("View Proposal");
  expect(viewLabel("AOI")).toBe("View Application");
});

it("titles events per queue as the legacy fetch chains did", () => {
  expect(
    eventTitle("pApproachingDeadlines", row({ deadlineType: "Internal" })),
  ).toBe("P_1 Deadline Type : Internal");
  expect(eventTitle("pPendingApprovals", row({ stage: "Dean" }))).toBe(
    "P_1 Pending at: Dean",
  );
  expect(eventTitle("pPendingApprovals", row({}))).toBe("P_1");
  expect(eventTitle("aApprovedAwards", row({ title: "Grant" }))).toBe(
    "P_1 Grant",
  );
  expect(eventTitle("eApproachingDeadlines", row({ stage: "x" }))).toBe("P_1");
});

it("places events on the calendar day written in the value, never shifted by zone", () => {
  expect(eventDay("2026-10-22")).toBe("2026-10-22");
  expect(eventDay("2026-10-22T23:30:00Z")).toBe("2026-10-22");
  expect(eventDay("2026-02-30")).toBeUndefined();
  expect(eventDay(undefined)).toBeUndefined();
});

it("builds events from the current rows only, skipping undated rows and hidden providers", () => {
  const rows = [
    row({ id: "a", reference: "OP_1" }),
    row({ id: "b" }),
    row({ id: "c", date: undefined }),
  ];
  const events = toCalendarEvents("pApproachingDeadlines", rows, new Set());
  expect(events.map((e) => [e.id, e.start, e.backgroundColor])).toEqual([
    ["a", "2026-10-22", "var(--calendar-provider-1)"],
    ["b", "2026-10-22", "var(--calendar-provider-2)"],
  ]);
  expect(
    toCalendarEvents("pApproachingDeadlines", rows, new Set(["PROPOSAL"])).map(
      (e) => e.id,
    ),
  ).toEqual(["a"]);
  // A refetch with other rows yields only those rows' events: nothing accumulates.
  expect(
    toCalendarEvents("x", [row({ id: "z" })], new Set()).map((e) => e.id),
  ).toEqual(["z"]);
  expect(providersOf(rows).map((p) => p.provider)).toEqual([
    "OUTLINE_PROPOSAL",
    "PROPOSAL",
  ]);
});
