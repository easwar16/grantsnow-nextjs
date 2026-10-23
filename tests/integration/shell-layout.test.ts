import { beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
const mocks = vi.hoisted(() => ({
  preferences: vi.fn(),
  globals: vi.fn(),
}));
vi.mock("@/server/identity/auth/page", () => ({
  pageIdentity: async () => ({
    session: { token: "private-test-token" },
    user: { name: "Test User", modules: {} },
  }),
}));
vi.mock("@/server/platform/configuration/service", () => ({
  dashboardConfiguration: mocks.preferences,
}));
vi.mock("@/server/platform/configuration/resources", () => ({
  resources: async () => [],
  label: (_rows: unknown, _m: string, _g: string, _k: string, f: string) => f,
  resourceDescription: () => null,
}));
vi.mock("@/server/platform/configuration/formatting", () => ({
  displayFormat: async () => undefined,
  globalVariables: mocks.globals,
}));
vi.mock("@/components/chatbot/chatbot-mount", () => ({
  ChatbotMount: () => null,
}));
import AuthLayout from "@/app/(authenticated)/layout";
beforeEach(() => {
  mocks.preferences.mockReset();
  mocks.globals.mockReset().mockResolvedValue([]);
});
/** The AppShell element's props inside the layout's root. */
async function shellProps() {
  const root = await AuthLayout({ children: null });
  return (root.props.children as { props: Record<string, unknown> }[]).find(
    (child) => child?.props && "labels" in child.props,
  )!.props;
}
it("renders the shell with the default theme when the preferences read fails", async () => {
  mocks.preferences.mockRejectedValue(
    new AppError("UPSTREAM", "Oracle is unavailable.", 502),
  );
  const shell = await AuthLayout({ children: null });
  expect(shell.props.className).toBe("app");
});
it("still sends an expired session to sign in", async () => {
  mocks.preferences.mockRejectedValue(
    new AppError("EXPIRED", "Your session has expired.", 401),
  );
  await expect(AuthLayout({ children: null })).rejects.toMatchObject({
    code: "EXPIRED",
  });
});
it("shows the configured header logo only when it is a safe address", async () => {
  mocks.preferences.mockResolvedValue({});
  mocks.globals.mockResolvedValue([
    {
      var_key: "APPLICATION_LOGO_URL",
      var_value: "https://cdn.example/logo.svg",
    },
  ]);
  expect((await shellProps()).logo).toBe("https://cdn.example/logo.svg");
  mocks.globals.mockResolvedValue([
    { var_key: "APPLICATION_LOGO_URL", var_value: "javascript:alert(1)" },
  ]);
  expect((await shellProps()).logo).toBeUndefined();
  mocks.globals.mockRejectedValue(new Error("down"));
  expect((await shellProps()).logo).toBeUndefined();
});
