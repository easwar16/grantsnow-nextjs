// Builds the backend API catalogues from the legacy VBCS service definitions (read-only, `origin/development`):
// - every ORDS `apps` / `base` operation becomes an allowlist entry and one function, written only to the preview
//   (--out): copy the operations a module uses into src/server/oracle/operations.json and api/<area>.ts, so the
//   allowlist holds only what the app calls;
// - every OIC `ics` flow becomes an entry in src/server/oic/operations.json and one function in
//   src/server/oic/api/catalogue.ts (object storage maps to the byte-safe oicUpload / oicDownload / oicDelete).
//
//   node scripts/oracle-catalogue.mjs [--legacy <repo>] [--out <dir>] [--write]
//
// Without --write it prints a summary and writes the would-be files under --out (default .catalogue-preview).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const root = process.cwd();
const legacy = resolve(
  flag("--legacy", join(homedir(), "Documents/Projects/GrantsNow")),
);
const write = args.includes("--write");
const out = write
  ? root
  : resolve(flag("--out", join(root, ".catalogue-preview")));
const SERVICES = {
  apps: "services/apps/openapi3.json",
  base: "services/base/openapi3.json",
};
const METHODS = ["get", "post", "put", "delete"];
// GETs that change data. Listed by hand from their legacy chains; anything else that is a GET is a read.
const GET_WRITES = new Set([
  "getDynamicFormsInsertRequest",
  "getApproval_setupGenerate_stages",
  "getApproval_setupGenerate_stages_dynForm",
  "getContractsConvertContract",
  "postPost_awardsGenerateAward",
]);
// Identity the client fills from the verified session; never a parameter.
const IDENTITY = ["legal_id", "org_id", "user_id"];
const TOKEN_HEADERS = ["token", "p_token", "P_TOKEN"];

const show = (path) =>
  execFileSync("git", ["-C", legacy, "show", `origin/development:${path}`], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
const opsPath = join(root, "src/server/oracle/operations.json");
const current = JSON.parse(readFileSync(opsPath, "utf8"));
const byRoute = new Map(
  Object.entries(current).map(([name, op]) => [
    `${op.method ?? "GET"} ${op.path}`,
    name,
  ]),
);

const catalogue = [];
for (const [service, file] of Object.entries(SERVICES)) {
  const spec = JSON.parse(show(file));
  for (const [path, item] of Object.entries(spec.paths ?? {}))
    for (const method of METHODS) {
      const o = item[method];
      if (!o) continue;
      const params = [...(item.parameters ?? []), ...(o.parameters ?? [])];
      const verb = method.toUpperCase();
      const name = byRoute.get(`${verb} ${path}`) ?? o.operationId;
      catalogue.push({
        name,
        legacyId: o.operationId,
        service,
        path,
        method: verb,
        summary: (o.summary ?? o.description ?? "").replace(/\s+/g, " ").trim(),
        headers: params.filter((p) => p.in === "header").map((p) => p.name),
        query: params.filter((p) => p.in === "query").map((p) => p.name),
        pathParams: params.filter((p) => p.in === "path").map((p) => p.name),
        required: new Set(params.filter((p) => p.required).map((p) => p.name)),
        body: Boolean(o.requestBody),
        write: verb !== "GET" || GET_WRITES.has(o.operationId),
      });
    }
}

// The allowlist: existing entries unchanged, the rest added from the catalogue.
const operations = { ...current };
let added = 0;
for (const op of catalogue) {
  if (operations[op.name]) continue;
  added++;
  operations[op.name] = {
    service: op.service,
    path: op.path,
    headers: op.headers,
    ...(op.method === "GET" ? {} : { method: op.method }),
    ...(op.write ? { write: true } : {}),
    catalogue: true,
  };
}

// One function per operation, grouped by the path's first segment.
const camel = (s) =>
  s
    .replace(/[-_]+([a-zA-Z0-9])/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
const key = (n) => (/^[A-Za-z_$][\w$]*$/.test(n) ? n : JSON.stringify(n));
const access = (n) =>
  /^[A-Za-z_$][\w$]*$/.test(n) ? `p.${n}` : `p[${JSON.stringify(n)}]`;
const areaOf = (op) =>
  op.service === "base"
    ? "session"
    : camel(op.path.replace(/^\//, "").split("/")[0]);
const areas = new Map();
for (const op of catalogue) {
  const area = areaOf(op);
  if (!areas.has(area)) areas.set(area, []);
  areas.get(area).push(op);
}
const fnFor = (op) => {
  const tokenHeader = op.headers.find((h) => TOKEN_HEADERS.includes(h));
  const identity = op.headers.filter((h) => IDENTITY.includes(h));
  const own = op.headers.filter(
    (h) => !TOKEN_HEADERS.includes(h) && !IDENTITY.includes(h),
  );
  const fields = [
    ...own.map((n) => ["header", n]),
    ...op.query.map((n) => ["query", n]),
    ...op.pathParams.map((n) => ["path", n]),
  ];
  const type = [
    ...fields.map(
      ([, n]) => `${key(n)}${op.required.has(n) ? "" : "?"}: Value;`,
    ),
    ...(op.body && op.write ? ["body?: unknown;"] : []),
  ];
  const map = (kind) => {
    const names = fields.filter(([k]) => k === kind).map(([, n]) => n);
    if (!names.length) return null;
    const pairs = names.map((n) => `${key(n)}: ${access(n)}`).join(", ");
    return kind === "path"
      ? `path: (p) => ({ ${names.map((n) => `${key(n)}: String(${access(n)})`).join(", ")} }),`
      : `${kind === "header" ? "headers" : "query"}: (p) => ({ ${pairs} }),`;
  };
  const lines = [
    `op: ${JSON.stringify(op.name)},`,
    identity.length ? `identity: ${JSON.stringify(identity)},` : null,
    tokenHeader === "token"
      ? null
      : `tokenHeader: ${tokenHeader ? JSON.stringify(tokenHeader) : "false"},`,
    map("header"),
    map("query"),
    map("path"),
    op.body && op.write ? "body: (p) => p.body," : null,
  ].filter(Boolean);
  const params = type.length ? `{ ${type.join(" ")} }` : "void";
  const doc = `${op.method} ${op.path}${op.legacyId !== op.name ? ` (legacy id ${op.legacyId})` : ""}${op.summary ? ` — ${op.summary.slice(0, 120)}` : ""}`;
  return `/** ${op.write ? "WRITES: " : ""}${doc.replace(/\*\//g, "* /")} */\nexport const ${op.name} = ${op.write ? "write" : "read"}<${params}>({\n  ${lines.join("\n  ")}\n});`;
};
const preview = resolve(flag("--out", join(root, ".catalogue-preview")));
const dir = join(preview, "src/server/oracle/api/catalogue");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const header = (area) =>
  `// GENERATED by scripts/oracle-catalogue.mjs from the legacy service definitions; do not edit. Area: ${area}.\n` +
  `// Raw operations: parameters are the legacy names; identity and the token come from the session. Services wrap\n` +
  `// these in their area module with a response schema, cache policy and invalidations (docs/api-layer.md).\n` +
  `import "server-only";\nimport { read, write } from "../../client";\n`;
const VALUE = "type Value = string | number | boolean | null | undefined;\n";
for (const [area, ops] of [...areas].sort(([a], [b]) => a.localeCompare(b))) {
  const usesWrite = ops.some((o) => o.write),
    usesRead = ops.some((o) => !o.write);
  const head = header(area).replace(
    "import { read, write }",
    `import { ${[usesRead && "read", usesWrite && "write"].filter(Boolean).join(", ")} }`,
  );
  const body = ops.map(fnFor).join("\n\n");
  // The shared parameter type only where a function takes parameters.
  writeFileSync(
    join(dir, `${area}.ts`),
    `${head}${/\bValue\b/.test(body) ? `\n${VALUE}` : ""}\n${body}\n`,
  );
}
writeFileSync(
  join(dir, "index.ts"),
  `// GENERATED by scripts/oracle-catalogue.mjs; do not edit.\n/** Every legacy ORDS operation as a raw function, by area. */\n` +
    [...areas.keys()]
      .sort()
      .map((a) => `export * as ${a} from "./${a}";`)
      .join("\n") +
    "\n",
);
const opsOut = join(preview, "src/server/oracle/operations.json");
mkdirSync(join(preview, "src/server/oracle"), { recursive: true });
writeFileSync(opsOut, JSON.stringify(operations, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      operations: catalogue.length,
      alreadyAllowlisted: catalogue.length - added,
      added,
      writes: catalogue.filter((o) => o.write).length,
      areas: Object.fromEntries([...areas].map(([a, o]) => [a, o.length])),
      renamed: catalogue
        .filter((o) => o.name !== o.legacyId)
        .map((o) => `${o.legacyId} -> ${o.name}`),
      out: preview,
    },
    null,
    1,
  ),
);

// OIC flows (services/ics). Paths are relative to the integration flows root; a path the contract leaves empty is kept
// as `unresolved`, and its function refuses to call rather than post to the root.
const STORAGE = {
  "/UPLOAD_OBJECT/1.0/objectstorage": "upload",
  "/GET_OBJECT/1.0/objectstorage": "download",
  "/DELETE_OBJECT/1.0/objectstorage": "delete",
};
// Flows whose path legacy supplies at run time (sendToERP: `uriParams.path` = custErpDetails.oic_endpoint, e.g.
// /UNIT4_ERP_FLOW/1.0/unit4integration): a flow / version / resource template, each segment validated by the client.
const RUNTIME_PATH = {
  getIcApiIntegrationV1FlowsRestUNIT4_MAIN_FLOW1_0Unit4integration:
    "/{flow}/{version}/{resource}",
};
const ics = JSON.parse(show("services/ics/openapi3.json"));
const flows = [];
for (const [rawPath, item] of Object.entries(ics.paths ?? {}))
  for (const method of METHODS) {
    const o = item[method];
    if (!o) continue;
    const path = RUNTIME_PATH[o.operationId] ?? rawPath.trim();
    const params = [...(item.parameters ?? []), ...(o.parameters ?? [])];
    const uniq = (xs) => [...new Set(xs)];
    flows.push({
      name: o.operationId,
      path,
      method: method.toUpperCase(),
      headers: uniq(params.filter((p) => p.in === "header").map((p) => p.name)),
      query: uniq(params.filter((p) => p.in === "query").map((p) => p.name)),
      pathParams: uniq([
        ...params.filter((p) => p.in === "path").map((p) => p.name),
        ...[...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]),
      ]),
      required: new Set(params.filter((p) => p.required).map((p) => p.name)),
      body: Boolean(o.requestBody),
      write: method !== "get",
      storage: STORAGE[path],
      unresolved: path === "/",
      summary: (o.summary ?? o.description ?? "").replace(/\s+/g, " ").trim(),
    });
  }
const oicOps = Object.fromEntries(
  flows.map((f) => [
    f.name,
    {
      path: f.path,
      method: f.method,
      headers: f.headers,
      ...(f.write ? { write: true } : {}),
      ...(f.storage ? { storage: f.storage } : {}),
      ...(f.unresolved ? { unresolved: true } : {}),
    },
  ]),
);
const flowFn = (f) => {
  const doc = `/** ${f.write ? "WRITES: " : ""}${f.method} ${f.path}${f.unresolved ? " (no path in the legacy contract: refuses until it is confirmed)" : ""}${f.summary ? ` — ${f.summary.slice(0, 120)}` : ""} */`;
  if (f.storage === "upload")
    return `${doc}\nexport const ${f.name} = (p: { file_name: string; body: Uint8Array }) =>\n  oicUpload(p.file_name, p.body);`;
  if (f.storage === "download")
    return `${doc}\nexport const ${f.name} = (p: { file_name: string }) => oicDownload(p.file_name);`;
  if (f.storage === "delete")
    return `${doc}\nexport const ${f.name} = (p: { file_name: string }) => oicDelete(p.file_name);`;
  const identity = f.headers.filter((h) => IDENTITY.includes(h));
  const own = f.headers.filter((h) => h !== "token" && !IDENTITY.includes(h));
  const fields = [
    ...own.map((n) => ["header", n]),
    ...f.query.map((n) => ["query", n]),
    ...f.pathParams.map((n) => ["path", n]),
  ];
  const type = [
    ...fields.map(
      ([, n]) => `${key(n)}${f.required.has(n) ? "" : "?"}: Value;`,
    ),
    ...(f.body && f.write ? ["body?: unknown;"] : []),
  ];
  const map = (kind, prop) => {
    const names = fields.filter(([k]) => k === kind).map(([, n]) => n);
    return names.length
      ? `${prop}: (p) => ({ ${names.map((n) => `${key(n)}: ${access(n)}`).join(", ")} }),`
      : null;
  };
  const lines = [
    `op: ${JSON.stringify(f.name)},`,
    identity.length ? `identity: ${JSON.stringify(identity)},` : null,
    // The session token goes to OIC only where the contract requires it (storage and most flows never take it).
    f.required.has("token") ? "token: true," : null,
    map("header", "headers"),
    map("query", "query"),
    map("path", "path"),
    f.body && f.write ? "body: (p) => p.body," : null,
  ].filter(Boolean);
  return `${doc}\nexport const ${f.name} = flow<${type.length ? `{ ${type.join(" ")} }` : "void"}>({\n  ${lines.join("\n  ")}\n});`;
};
const oicDir = join(out, "src/server/oic/api");
mkdirSync(oicDir, { recursive: true });
writeFileSync(
  join(out, "src/server/oic/operations.json"),
  JSON.stringify(oicOps, null, 2) + "\n",
);
writeFileSync(
  join(oicDir, "catalogue.ts"),
  `// GENERATED by scripts/oracle-catalogue.mjs from the legacy ics service definition; do not edit.\n` +
    `// Raw OIC flows: parameters are the legacy names; identity and the token come from the session.\n` +
    `import "server-only";\nimport { flow } from "../flows";\nimport { oicDelete, oicDownload, oicUpload } from "../connection";\n\n` +
    `type Value = string | number | boolean | null | undefined;\n\n` +
    flows.map(flowFn).join("\n\n") +
    "\n",
);
console.log(
  JSON.stringify({
    oicFlows: flows.length,
    writes: flows.filter((f) => f.write).length,
    unresolved: flows.filter((f) => f.unresolved).map((f) => f.name),
  }),
);
