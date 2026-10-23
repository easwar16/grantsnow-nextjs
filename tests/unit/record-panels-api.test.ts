import { beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
const state = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock("@/server/oracle/connection", () => ({
  oracle: state.read,
  oracleWrite: state.write,
}));
vi.mock("@/server/oracle/context", () => ({
  oracleContext: async () => ({
    token: "session-token",
    identity: { legal_id: "77", org_id: "202", user_id: "101" },
  }),
}));
import { approvals, dynamicForm, objects, roles } from "@/server/oracle/api";
const record = { objectType: "OPPORTUNITIES-EOI", objectId: "12" };
const roleReads = () =>
  state.read.mock.calls.filter((c) => c[0] === "getSecurityUser_roles").length;
beforeEach(() => {
  state.read.mockReset().mockResolvedValue({ items: [] });
  state.write.mockReset().mockResolvedValue({});
});
it("holds the record roles until a status change, which drops them", async () => {
  await roles.record(record);
  await roles.record(record);
  expect(roleReads()).toBe(1);
  await objects.addStatus({ body: { p_status: "AIA" } });
  await roles.record(record);
  expect(roleReads()).toBe(2);
});
it("drops the held roles after every approval route write, a failed one too (it may have committed)", async () => {
  await roles.record(record);
  await approvals.act({ body: {} });
  await roles.record(record);
  expect(roleReads()).toBe(2);
  state.write.mockRejectedValueOnce(new AppError("UPSTREAM", "down"));
  await expect(
    approvals.generate({ docNum: "EOI_12", docType: "X", actionBy: "a" }),
  ).rejects.toThrow();
  await roles.record(record);
  expect(roleReads()).toBe(3);
});
it("sends the dynForm answers' token only as P_TOKEN, and the save's as both", async () => {
  await dynamicForm.answers({ objectId: "12", slot: "S" });
  expect(state.read.mock.calls[0][1]).toEqual({
    P_TOKEN: "session-token",
    P_REF_OBJ_ID: "12",
    P_REF_MODULE: "S",
  });
  await dynamicForm.save({ formId: 67, objectId: "12", slot: "S", body: [] });
  expect(state.write.mock.calls[0][1]).toEqual({
    token: "session-token",
    P_TOKEN: "session-token",
    P_FORM_ID: "67",
    P_OBJECT_ID: "12",
    P_OBJECT_TYPE: "S",
  });
});
