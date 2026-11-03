import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/server/oracle/connection", () => ({ oracle: state.read }));
vi.mock("@/server/oracle/context", () => ({
  oracleContext: async () => ({ token: "session-token", identity: {} }),
}));
import { contracts } from "@/server/oracle/api";

it("reads a Proposal's linked Contracts with legacy's object_ref_id clause, quotes escaped", async () => {
  state.read.mockResolvedValue({ items: [] });
  await contracts.linkedToProposal({
    reference: "P_67'43",
    offset: 10,
    limit: 10,
  });
  const [op, headers, query] = state.read.mock.calls[0];
  expect(op).toBe("getGetAllContracts");
  expect(headers.p_object_ref_id).toBe("P_67'43");
  expect(Object.fromEntries(query)).toEqual({
    p_offset: "10",
    p_limit: "10",
    p_where_clause: `("object_ref_id"='P_67''43')`,
  });
});
