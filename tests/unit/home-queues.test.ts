import { expect, it, vi } from "vitest";
import { calendarDaysUntil, isOverdue } from "@/features/modules/home/deadline";
import { sparklineSegments } from "@/features/modules/home/sparkline";
import { formattingSettings } from "@/server/platform/configuration/formatting";
import { mapWidget, viewerToday } from "@/server/modules/home/service";
import { widgets } from "@/server/modules/home/widgets";
import { functions } from "@/lib/functions";
// 22 Oct 2026, 23:30 local: late in the day, where the old millisecond diff misjudged tomorrow.
const today = new Date(2026, 9, 22, 23, 30);
const widget = (id: string) => widgets.find((w) => w.id === id)!;
const zone = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (zone.value === undefined ? undefined : { value: zone.value }),
  }),
}));
it("counts on the viewer's calendar day from the shell's time-zone cookie", async () => {
  // 20:00 UTC on 22 Oct is 01:30 on 23 Oct in Kolkata.
  const now = new Date("2026-10-22T20:00:00Z");
  zone.value = "Asia/Kolkata";
  const day = await viewerToday(now);
  expect([day.getFullYear(), day.getMonth(), day.getDate()]).toEqual([
    2026, 9, 23,
  ]);
  zone.value = "Not/AZone";
  expect(await viewerToday(now)).toBe(now);
  zone.value = undefined;
  expect(await viewerToday(now)).toBe(now);
});
it("compares calendar days in local time for date-only and timestamp values", () => {
  expect(calendarDaysUntil("2026-10-22", today)).toBe(0);
  expect(calendarDaysUntil("2026-10-23", today)).toBe(1);
  expect(calendarDaysUntil("2026-10-21", today)).toBe(-1);
  expect(calendarDaysUntil("2026-10-23T00:00:00Z", today)).toBe(1);
  expect(calendarDaysUntil("2026-10-21T23:59:00", today)).toBe(-1);
});
it("marks due-today and past deadlines overdue, never tomorrow or a missing date", () => {
  expect(isOverdue("2026-10-22", today)).toBe(true);
  expect(isOverdue("2026-10-21T08:00:00Z", today)).toBe(true);
  expect(isOverdue("2026-10-23", today)).toBe(false);
  expect(isOverdue(undefined, today)).toBe(false);
  expect(isOverdue("", today)).toBe(false);
  expect(isOverdue("2026-02-31", today)).toBe(false);
});
it("reads each queue's deadline field, not the never-returned submission_deadline_date", () => {
  const data = mapWidget(
    {
      items: [
        {
          proposal_id: 1,
          proposal_number: "P_1",
          deadline_date: "2026-11-30",
        },
        {
          proposal_id: 2,
          proposal_number: "P_2",
          deadline_date: "2026-10-22",
        },
      ],
    },
    widget("pApproachingDeadlines"),
    { offset: 0 },
    today,
  );
  expect(data.attention.map((r) => r.overdue)).toEqual([false, true]);
  // Approval queues are due from their creation date (owner's GN-Angular build, matching the live app).
  const pending = mapWidget(
    {
      items: [
        {
          proposal_id: 3,
          proposal_number: "P_3",
          proposal_creation_date: "2026-01-01",
        },
      ],
    },
    widget("pPendingApprovals"),
    { offset: 0 },
    today,
  );
  expect(pending.attention[0]).toMatchObject({
    overdue: true,
    date: "2026-01-01",
  });
});
it("notes contract deadlines that have passed, as legacy does", () => {
  const [row] = mapWidget(
    {
      items: [
        {
          contract_id: 5,
          contract_number: "CT_5",
          deadline_date: "2026-10-19",
          deadline_days: "3",
        },
      ],
    },
    widget("cApproachingDeadlines"),
    { offset: 0 },
    today,
  ).attention;
  expect(row.age).toBe("Overdue by 3 Days");
});
it("links every queue row to its route or module placeholder with record params", () => {
  const href = (id: string, row: Record<string, unknown>) =>
    mapWidget({ items: [row] }, widget(id), { offset: 0 }, today).attention[0]
      .href;
  expect(
    href("pPendingApprovals", {
      proposal_id: 9,
      proposal_number: "OP_9",
      proposal_type: "OUTLINE_PROPOSAL",
    }),
  ).toBe("/proposals/OUTLINE_PROPOSAL/9");
  expect(
    href("pPendingApprovals", {
      proposal_id: 9,
      proposal_number: "P_9",
      proposal_type: "UNKNOWN",
    }),
  ).toBe("/proposals?reference=P_9");
  expect(
    href("eoiPendingApprovals", { request_id: 4, request_number: "EOI_4" }),
  ).toBe("/opportunities/eoi/4");
  expect(
    href("cPendingApprovals", { contract_id: 7, contract_number: "CT_7" }),
  ).toBe("/contracts/7");
  expect(
    href("ePendingApprovals", {
      setup_flow_id: 8,
      access_type: "EDIT",
      application_number: "ETH_8",
    }),
  ).toBe("/modules/ethics?access_type=EDIT&setup_flow_id=8");
  expect(href("aApprovedAwards", { award_id: 6, award_number: "AW_6" })).toBe(
    "/awards/6/header",
  );
});
it("keeps row identities unique across scroll pages", () => {
  const page = (offset: number) =>
    mapWidget(
      { items: [{ award_id: 1, award_number: "AW_1" }] },
      widget("aApprovedAwards"),
      { offset },
      today,
    ).attention[0].id;
  expect(page(0)).not.toBe(page(25));
});
it("formats dates with the configured legacy pattern and falls back on unsupported tokens", () => {
  expect(
    functions.format.dateDisplay("2026-09-05", { dateFormat: "dd-MMM-yyyy" }),
  ).toBe("05-Sep-2026");
  expect(
    functions.format.dateDisplay("2026-09-05T23:00:00Z", {
      dateFormat: "MM/DD/YY",
    }),
  ).toBe("09/05/26");
  expect(
    functions.format.dateDisplay("2026-09-05", { dateFormat: "DDDD MMMM" }),
  ).toBe("05-Sep-2026");
  expect(functions.format.dateDisplay("2026-09-05")).toBe("05-Sep-2026");
  expect(functions.format.dateDisplay("not a date")).toBe("not a date");
});
it("applies configured decimals for display only and keeps masks verbatim", () => {
  expect(
    functions.format.moneyDisplay("1234.5678", "GBP", { decimals: 3 }),
  ).toBe("£1,234.568");
  expect(
    functions.format.moneyDisplay("1234.5", "GBP", { decimals: null }),
  ).toBe("£1,234.5");
  expect(functions.format.moneyDisplay("1234.5", "GBP", { decimals: 0 })).toBe(
    "£1,234.5",
  );
  expect(
    functions.format.moneyDisplay("1234.5678", undefined, { decimals: 1 }),
  ).toBe("1,234.6");
  expect(functions.format.moneyDisplay("1234.5", "GBP")).toBe("£1,234.50");
  expect(functions.format.moneyDisplay("****", "GBP", { decimals: 2 })).toBe(
    "****",
  );
});
it("reads global variables without inventing a decimal count", () => {
  expect(
    formattingSettings([
      { var_key: "DECIMAL_PLACES_COUNT", var_value: "3" },
      { var_key: "DEFAULT_DATE_FORMAT", var_value: "dd-MMM-yyyy" },
      { var_key: "DEFAULT_CURRENCY_CODE", var_value: "GBP" },
    ]),
  ).toEqual({ currency: "GBP", decimals: 3, dateFormat: "dd-MMM-yyyy" });
  expect(
    formattingSettings([{ var_key: "DECIMAL_PLACES_COUNT", var_value: null }]),
  ).toEqual({ currency: undefined, decimals: null, dateFormat: "DD-MMM-YYYY" });
});
it("draws KPI trend gaps for missing values instead of zeros", () => {
  const segments = sparklineSegments([1, null, 3, 5]);
  expect(segments).toHaveLength(2);
  expect(segments[0].points).toBe("0,12");
  expect(segments[1].points).toBe("40,8 60,4");
  expect(sparklineSegments([null, null])).toEqual([]);
});
