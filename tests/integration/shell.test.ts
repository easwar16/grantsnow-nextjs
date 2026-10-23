import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  oracle: vi.fn(),
  oracleWrite: vi.fn(),
  resources: vi.fn(),
}));
vi.mock("@/server/identity/session/service", () => ({
  authenticate: async () => ({
    session: { token: "private-test-token" },
    user: { personId: "12", modules: {} },
  }),
}));
vi.mock(
  "@/server/platform/configuration/resources",
  async (importOriginal) => ({
    resourceVisible: (
      await importOriginal<
        typeof import("@/server/platform/configuration/resources")
      >()
    ).resourceVisible,
    resources: mocks.resources,
    label: () => "",
  }),
);
vi.mock("@/server/platform/configuration/service", () => ({
  organizations: async () => [],
}));
vi.mock("@/server/oracle/connection", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  oracle: mocks.oracle,
  oracleWrite: mocks.oracleWrite,
}));
import {
  bell,
  markAllRead,
  repairNotificationHtml,
  utcOf,
} from "@/server/modules/notifications/service";
import { POST } from "@/app/api/notifications/route";
// The client also passes its optional signal / query / path arguments; assertions compare the leading ones.
const lead = (mock: { mock: { calls: unknown[][] } }, n = 3) =>
  mock.mock.calls.map((c) => c.slice(0, n));
import { digitalPresence, saveAccount } from "@/server/modules/account/service";
import { customThemeRows } from "@/server/modules/account/themes";
import { groupByDay } from "@/components/layout/notification-days";
import {
  findTheme,
  presetThemes,
  themeVariables,
} from "@/features/modules/account/themes";
import { drawerAccess, visibleNavigation } from "@/server/platform/permissions";
const presenceVisible = [
  {
    module_name: "dashboard",
    label_type: "labels",
    label_name: "digital-presence",
    is_visible: "Y",
  },
];
const links = {
  linkedin: "https://www.linkedin.com/in/someone",
  scholar: "",
  research_gate: "",
  orc_id: "",
  researcher_id: "",
};
beforeEach(() => {
  mocks.oracle.mockReset();
  mocks.oracleWrite.mockReset().mockResolvedValue({});
  mocks.resources.mockReset().mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

it("repairs legacy notification links whose & became = and leaves good ones alone", () => {
  expect(
    repairNotificationHtml(
      '<a href="https://gn.example/?proposal_id=5=edit=shell=proposals=proposals-info-start">x</a>',
    ),
  ).toBe(
    '<a href="https://gn.example/?proposal_id=5&mode=edit&page=shell&shell=proposals&proposals=proposals-info-start">x</a>',
  );
  const good = '<a href="https://gn.example/?page=shell&shell=home">x</a>';
  expect(repairNotificationHtml(good)).toBe(good);
  expect(repairNotificationHtml(null)).toBe("");
});
it("reads zone-less backend times as UTC", () => {
  expect(utcOf("2026-10-14T10:00:00")).toBe("2026-10-14T10:00:00Z");
  expect(utcOf("2026-10-14T10:00:00+01:00")).toBe("2026-10-14T10:00:00+01:00");
});
it("groups by the viewer's local day with Today and Yesterday labels", () => {
  const now = new Date(2026, 9, 22, 12);
  const at = (d: number, h: number) => new Date(2026, 9, d, h).toISOString();
  const days = groupByDay(
    [
      { id: 1, at: at(22, 9) },
      { id: 2, at: at(22, 1) },
      { id: 3, at: at(21, 23) },
      { id: 4, at: at(18, 8) },
    ],
    now,
  );
  expect(days.map((d) => [d.label, d.day, d.items.length])).toEqual([
    ["Today", "2026-10-22", 2],
    ["Yesterday", "2026-10-21", 1],
    [null, "2026-10-18", 1],
  ]);
});
it("counts unread over the whole list, sanitises, and shows the latest five", async () => {
  mocks.oracle.mockResolvedValue({
    items: Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      is_read: i < 6 ? "N" : "Y",
      notific_content: `<p onclick="steal()">n${i + 1}</p><script>x()</script>`,
      datetime: "2026-10-14T10:00:00",
    })),
  });
  const result = await bell();
  expect(result.unread).toBe(6);
  expect(result.latest.map((n) => n.id)).toEqual([1, 2, 3, 4, 5]);
  expect(result.latest[0].html).toBe("<p>n1</p>");
  expect(result.latest[0].at).toBe("2026-10-14T10:00:00Z");
});
it("marks only the user's own unread notifications read, and writes nothing when all are read", async () => {
  mocks.oracle.mockResolvedValue({
    items: [
      { id: 7, is_read: "N" },
      { id: 8, is_read: "Y" },
      { id: 9, is_read: "N" },
    ],
  });
  expect(await markAllRead()).toEqual({ marked: 2 });
  expect(lead(mocks.oracleWrite)).toContainEqual([
    "postNotificationsNotifications",
    { token: "private-test-token" },
    {
      items: [
        { id: 7, is_read: "Y" },
        { id: 9, is_read: "Y" },
      ],
    },
  ]);
  mocks.oracleWrite.mockClear();
  mocks.oracle.mockResolvedValue({ items: [{ id: 8, is_read: "Y" }] });
  expect(await markAllRead()).toEqual({ marked: 0 });
  expect(mocks.oracleWrite).not.toHaveBeenCalled();
});
it("refuses a cross-origin mark-read", async () => {
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3000");
  const response = await POST(
    new Request("http://127.0.0.1:3000/api/notifications", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    }),
  );
  expect(response.status).toBe(403);
  expect(mocks.oracle).not.toHaveBeenCalled();
});
it("keeps digital presence closed unless RB switches it on", async () => {
  await expect(digitalPresence()).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(saveAccount("presence", links)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(mocks.oracle).not.toHaveBeenCalled();
  expect(mocks.oracleWrite).not.toHaveBeenCalled();
});
it("reads digital presence with the session's pid and keeps only the five links", async () => {
  mocks.resources.mockResolvedValue(presenceVisible);
  mocks.oracle.mockResolvedValue({
    items: [{ linkedin: "https://x.example", person_id: 99, extra: "y" }],
  });
  expect(await digitalPresence()).toEqual({
    linkedin: "https://x.example",
    scholar: "",
    research_gate: "",
    orc_id: "",
    researcher_id: "",
  });
  expect(lead(mocks.oracle, 2)).toContainEqual([
    "getSharedDigitalPresence",
    { token: "private-test-token", pid: "12" },
  ]);
});
it("saves digital presence through the write gate with the token as a header, never unsafe links", async () => {
  mocks.resources.mockResolvedValue(presenceVisible);
  await saveAccount("presence", links);
  expect(lead(mocks.oracleWrite)).toContainEqual([
    "postSharedDigitalPresence",
    { token: "private-test-token" },
    links,
  ]);
  mocks.oracleWrite.mockClear();
  await expect(
    saveAccount("presence", { ...links, scholar: "javascript:alert(1)" }),
  ).rejects.toThrow();
  await expect(
    saveAccount("presence", { ...links, pid: "99" }),
  ).rejects.toThrow();
  expect(mocks.oracleWrite).not.toHaveBeenCalled();
});
it("maps organisation themes and drops rows whose colours could inject CSS", () => {
  expect(
    customThemeRows({
      items: [
        {
          legal_id: 3,
          display_name: "Plum",
          primary_color: "#5b2a5e",
          secondary_color: "rgb(240, 204, 113)",
          background_color: "red; background:url(x)",
          text_color: null,
          is_dark: "Y",
        },
        {
          legal_id: 3,
          display_name: "Bad",
          primary_color: "url(https://evil.example)",
          secondary_color: "#fff",
        },
      ],
    }),
  ).toEqual([
    {
      id: "apitheme:3:Plum",
      name: "Plum",
      primary: "#5b2a5e",
      secondary: "rgb(240, 204, 113)",
      dark: true,
    },
  ]);
  expect(customThemeRows({ error_code: "X" })).toEqual([]);
});
it("applies the theme's own variables and falls back to the default preset", () => {
  expect(findTheme(presetThemes, "apitheme:9:Gone").id).toBe("theme-default");
  expect(themeVariables(findTheme(presetThemes, "theme-dark"))).toEqual({
    "--gn-brand": "#0a0a0a",
    "--gn-brand-deep": "#0a0a0a",
    "--gn-bg": "#1f1e1c",
    "--gn-text": "#f5f4f2",
  });
  expect(Object.keys(themeVariables(presetThemes[0]))).toEqual([
    "--gn-brand",
    "--gn-brand-deep",
  ]);
});
it("rejects a theme the organisation does not offer before any write", async () => {
  mocks.oracle.mockImplementation(async (op: string) =>
    op === "getSharedGetCustomTheme"
      ? { items: [] }
      : { theme: "theme-default", needAttention: {}, insights: {} },
  );
  await expect(
    saveAccount("dashboard", { theme: "apitheme:1:Elsewhere" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(mocks.oracleWrite).not.toHaveBeenCalled();
});
it("always opens the header's Help and View all pages but never lists them in the drawer", () => {
  expect(drawerAccess({}, "tutorials")).toBe(true);
  expect(drawerAccess({}, "announcements-notifications")).toBe(true);
  expect(visibleNavigation({}).map((i) => i.id)).toEqual([
    "home",
    "announcements",
  ]);
});
