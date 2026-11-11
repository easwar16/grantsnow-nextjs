import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ page: vi.fn() }));
vi.mock("@/server/identity/session/service", () => ({
  authenticate: async () => ({ user: { modules: { PROPOSALS: true } } }),
}));
vi.mock("@/server/modules/proposals/record", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/server/modules/proposals/record")
  >()),
  proposalPage: state.page,
}));

import { authorizeForm } from "@/server/record/dynamic-form/access";

const target = {
  objectType: "PROPOSAL",
  slot: "PROPOSALS-DYNAMIC-FORM-1",
  parentId: "1000",
  objectId: "1000",
};
const context = () => ({
  user: { modules: { PROPOSALS: true } },
  rights: { read: true, edit: true },
  pageIds: new Map([["proposals-dynamic-form-1", 55]]),
  summary: {
    id: "1000",
    reference: "P_1000",
    statusCode: "DRFT",
    lockedPageIds: [],
  },
});

beforeEach(() => {
  state.page.mockReset();
  state.page.mockResolvedValue(context());
});

it("allows a draft Proposal dynamic form with edit role and an open page", async () => {
  await expect(authorizeForm(target, "edit")).resolves.toMatchObject({
    page: "proposals-dynamic-form-1",
    record: { id: "1000", number: "P_1000" },
  });
  expect(state.page).toHaveBeenCalledWith(
    "PROPOSAL",
    "1000",
    "proposals-dynamic-form-1",
  );
});

it("denies editing without the page grant or after finalization", async () => {
  state.page.mockResolvedValueOnce({
    ...context(),
    rights: { read: true, edit: false },
  });
  await expect(authorizeForm(target, "edit")).rejects.toMatchObject({
    status: 403,
  });
  state.page.mockResolvedValueOnce({
    ...context(),
    summary: { ...context().summary, lockedPageIds: [55] },
  });
  await expect(authorizeForm(target, "edit")).rejects.toMatchObject({
    status: 403,
  });
  state.page.mockResolvedValueOnce({
    ...context(),
    summary: { ...context().summary, statusCode: "AIA" },
  });
  await expect(authorizeForm(target, "edit")).rejects.toMatchObject({
    status: 403,
  });
});

it("keeps a finalized dynamic form readable", async () => {
  state.page.mockResolvedValueOnce({
    ...context(),
    summary: { ...context().summary, lockedPageIds: [55] },
  });
  await expect(authorizeForm(target, "read")).resolves.toMatchObject({
    record: { id: "1000" },
  });
});
