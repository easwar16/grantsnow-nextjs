import { expect, it } from "vitest";
import {
  parseContractQuery,
  contractSearch,
} from "@/features/contracts/schema";
import { contractOracleQuery, mapContracts } from "@/server/contracts/service";
import { resolveOperationPath } from "@/server/oracle/connection";
import { safeReturn } from "@/lib/security";
import { mapApprovalGraph } from "@/server/record/approvals/graph";
import { contractSignerStamp } from "@/features/contracts/format";

const q = () => parseContractQuery(new URLSearchParams());
const record = {
  contract_id: 1300,
  contract_number: "C_1300",
  contract_title: "Collaboration",
  status: "Draft",
  contract_level: "PROPOSAL",
  object_ref_id: "P_100",
  internal_terms: "PRIVATE CONTRACT DATA",
};
it("matches the VBCS Signers twelve-hour converter without an AM/PM suffix", () => {
  expect(contractSignerStamp("2026-10-13T17:35:43Z")).toBe(
    "13-Oct-2026 11:05:43",
  );
  expect(contractSignerStamp("not a date")).toBe("not a date");
});
it("rejects malformed query and detail identities", () => {
  expect(() => parseContractQuery(new URLSearchParams("page=-1"))).toThrow();
  expect(() =>
    parseContractQuery(new URLSearchParams("status=DRFT%0Aother")),
  ).toThrow();
  expect(() =>
    resolveOperationPath("getContractsContract_id", {
      contract_id: "13/../../session",
    }),
  ).toThrow();
  expect(safeReturn("/contracts/1300")).toBe("/contracts/1300");
  expect(safeReturn("/contracts/new")).toBe("/contracts/new");
  expect(safeReturn("/contracts/1300/history")).toBe("/contracts/1300/history");
  expect(safeReturn("/contracts/1300/delegation")).toBe(
    "/contracts/1300/delegation",
  );
  expect(safeReturn("/contracts/1300/signers")).toBe("/contracts/1300/signers");
  expect(safeReturn("/contracts/1300/workflow")).toBe(
    "/contracts/1300/workflow",
  );
  expect(safeReturn("/contracts/../home")).toBe("/home");
});
it("quotes a pasted contract number and delegates pagination to Oracle", () => {
  const query = parseContractQuery(
    new URLSearchParams({ number: " C_'1 ", page: "2", status: "DRFT" }),
  );
  const oracle = contractOracleQuery(query);
  expect(oracle.get("p_where_clause")).toContain("%C_''1%");
  expect(oracle.get("p_offset")).toBe("10");
  expect(contractSearch(query)).toContain("page=2");
});
it("serializes verified multi-select relation filters and rejects unknown values", () => {
  const query = parseContractQuery(
    new URLSearchParams("level=PROPOSAL&level=AWARD"),
  );
  expect(query.level).toBe("PROPOSAL,AWARD");
  expect(contractSearch(query)).toContain("level=PROPOSAL%2CAWARD");
  expect(() =>
    parseContractQuery(new URLSearchParams("level=PROPOSAL&level=PROPOSAL")),
  ).toThrow();
  expect(() =>
    parseContractQuery(new URLSearchParams("level=UNKNOWN")),
  ).toThrow();
});
it("builds a bounded remote query for the source sidebar filters", () => {
  const query = parseContractQuery(
    new URLSearchParams({
      referenceNumber: " P_'100 ",
      contractType: "RESEARCH",
      orgUnit: "202",
      sort: "creation_date",
      direction: "ASC",
    }),
  );
  const oracle = contractOracleQuery(query);
  expect(oracle.get("p_where_clause")).toContain("object_number");
  expect(oracle.get("p_where_clause")).toContain("%P_''100%");
  expect(oracle.get("p_where_clause")).toContain(
    "\"contract_type\"='RESEARCH'",
  );
  expect(oracle.get("p_where_clause")).toContain("\"org_id\"='202'");
  expect(oracle.get("p_order_by")).toBe('"creation_date"');
  expect(oracle.get("p_sort_order")).toBe("ASC");
  expect(() =>
    parseContractQuery(new URLSearchParams("sort=creation_date%22%3Bdrop")),
  ).toThrow();
});
it("maps only display fields and refuses a mismatched Oracle page", () => {
  const result = mapContracts(
    { items: [record], offset: 0, total_count: 2 },
    q(),
  );
  expect(result.rows[0].number).toBe("C_1300");
  expect(result.total).toBe(2);
  expect(JSON.stringify(result)).not.toContain("PRIVATE CONTRACT DATA");
  expect(() => mapContracts({ items: [record], offset: 10 }, q())).toThrow();
  expect(() => mapContracts({ items: [record, record] }, q())).toThrow();
});
it("accepts live ORDS null status with a verified status code", () => {
  const result = mapContracts(
    {
      items: [{ ...record, status: null, status_lkp_code: "SUB" }],
      offset: 0,
      totalResults: 257,
      hasMore: true,
    },
    q(),
  );
  expect(result.rows[0].status).toBe("Submitted for Signing");
  expect(result.total).toBe(257);
  expect(result.hasMore).toBe(true);
});
it("maps the nested ORDS approval graph without backend metadata and refuses cross-record nodes", () => {
  const raw = {
    chart: { container: "#foreign", callback: "untrusted" },
    nodeStructure: {
      text: { name: "Approval Workflow", title: "Start" },
      children: [
        {
          text: {
            name: "Contract Approval",
            title: "Approved",
            contact: "Stage 1",
          },
          data: {
            approval_number: "C_1301",
            status: "Approved",
            approver_email: "private@example.org",
          },
        },
      ],
    },
  };
  const graph = mapApprovalGraph(raw, "C_1301");
  expect(graph.children[0].name).toBe("Contract Approval");
  expect(JSON.stringify(graph)).not.toContain("private@example.org");
  expect(JSON.stringify(graph)).not.toContain("untrusted");
  expect(() => mapApprovalGraph(raw, "C_1302")).toThrow();
  expect(() =>
    mapApprovalGraph({ nodeStructure: { children: {} } }, "C_1301"),
  ).toThrow();
});
