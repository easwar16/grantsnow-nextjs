import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import operations from "@/server/oracle/operations.json";

type Op = {
  method?: string;
  write?: boolean;
  headers: string[];
  catalogue?: boolean;
};
const allowlist = operations as Record<string, Op>;
const api = join(process.cwd(), "src/server/oracle/api");
const generated = join(api, "catalogue");
/** `export const <name> = read|write<…>({ op: "<op>"` pairs in a source file. */
const definitions = (file: string) =>
  [
    ...readFileSync(file, "utf8").matchAll(
      /export const (\w+) = (read|write)<[\s\S]*?op: "(\w+)"/g,
    ),
  ].map(([, name, kind, op]) => ({ name, kind, op }));
const catalogue = readdirSync(generated)
  .filter((f) => f.endsWith(".ts") && f !== "index.ts")
  .flatMap((f) => definitions(join(generated, f)));

it("has one generated function per allowlisted operation, each named after it", () => {
  expect(catalogue.every((d) => d.name === d.op)).toBe(true);
  expect(new Set(catalogue.map((d) => d.op)).size).toBe(catalogue.length);
  expect(catalogue.map((d) => d.op).sort()).toEqual(
    Object.keys(allowlist).sort(),
  );
});
it("generates writes exactly for the allowlist's writes, so every one goes through the writes gate", () => {
  for (const d of catalogue)
    expect([d.op, d.kind]).toEqual([
      d.op,
      allowlist[d.op].write ? "write" : "read",
    ]);
  expect(
    Object.entries(allowlist)
      .filter(([, o]) => o.write !== true && (o.method ?? "GET") !== "GET")
      .map(([k]) => k),
  ).toEqual([]);
});
it("treats only the reviewed GETs as writes", () => {
  expect(
    Object.entries(allowlist)
      .filter(([, o]) => o.write && (o.method ?? "GET") === "GET")
      .map(([k]) => k)
      .sort(),
  ).toEqual(
    [
      "getApproval_setupGenerate_stages",
      "getApproval_setupGenerate_stages_dynForm",
      "getContractsConvertContract",
      "getDynamicFormsInsertRequest",
    ].sort(),
  );
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
