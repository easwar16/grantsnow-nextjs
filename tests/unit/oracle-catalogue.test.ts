import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import operations from "@/server/oracle/operations.json";

type Op = {
  method?: string;
  write?: boolean;
  headers: string[];
};
const allowlist = operations as Record<string, Op>;
const api = join(process.cwd(), "src/server/oracle/api");
/** Every source file under src/server, read once. */
const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sources(join(dir, e.name))
      : e.name.endsWith(".ts")
        ? [readFileSync(join(dir, e.name), "utf8")]
        : [],
  );

it("allowlists only operations the server names, so the allowlist cannot widen unused", () => {
  const code = sources(join(process.cwd(), "src/server")).join("\n");
  expect(
    Object.keys(allowlist).filter((op) => !code.includes(`"${op}"`)),
  ).toEqual([]);
});
it("marks every non-GET operation a write, so each goes through the writes gate", () => {
  expect(
    Object.entries(allowlist)
      .filter(([, o]) => o.write !== true && (o.method ?? "GET") !== "GET")
      .map(([k]) => k),
  ).toEqual([]);
});
// GETs that change data, reviewed from their legacy chains (scripts/oracle-catalogue.mjs GET_WRITES).
const GET_WRITES = [
  "getApproval_setupGenerate_stages",
  "getApproval_setupGenerate_stages_dynForm",
  "getContractsConvertContract",
  "getDynamicFormsInsertRequest",
  // GenerateAward is declared GET but creates the award (legacy createAward).
  "postPost_awardsGenerateAward",
];
it("treats exactly the reviewed GETs as writes", () => {
  for (const [op, o] of Object.entries(allowlist))
    if ((o.method ?? "GET") === "GET")
      expect([op, o.write === true]).toEqual([op, GET_WRITES.includes(op)]);
});
it("uses only allowlisted operations in the hand-written API modules", () => {
  const used = readdirSync(api)
    .filter((f) => f.endsWith(".ts"))
    .flatMap((f) =>
      [...readFileSync(join(api, f), "utf8").matchAll(/\bop: "(\w+)"/g)].map(
        (m) => m[1],
      ),
    );
  expect(used.filter((op) => !allowlist[op])).toEqual([]);
});
