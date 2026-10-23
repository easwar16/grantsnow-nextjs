// Builds the resource-bundle seed (the fallback translations) from the legacy app's design-time bundle,
// webApps/app/resources/js/strings.js on `origin/development` (read-only), the same object legacy's
// mergeTranslations() lays the backend's getSharedLabels rows over. Rebuild-owned seeds come from
// src/server/platform/configuration/resource-additions.json and win over legacy's.
//
//   node scripts/resource-seed.mjs [--legacy <repo>] [--check]
//
// --check exits non-zero when the committed seed differs from what legacy would produce.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import vm from "node:vm";

const args = process.argv.slice(2);
const at = args.indexOf("--legacy");
const legacy = resolve(
  at === -1 ? join(homedir(), "Documents/Projects/GrantsNow") : args[at + 1],
);
const check = args.includes("--check");
const root = process.cwd();
const source = execFileSync(
  "git",
  [
    "-C",
    legacy,
    "show",
    "origin/development:webApps/app/resources/js/strings.js",
  ],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
// The module is `define(function () { return { …bundles } })`; run it with nothing but a define stub.
let bundles;
vm.runInNewContext(
  source,
  { define: (factory) => (bundles = factory()) },
  { timeout: 5000 },
);
if (!bundles || typeof bundles !== "object")
  throw new Error("strings.js did not define the bundles");

const rows = [],
  skipped = [];
for (const [bundle, groups] of Object.entries(bundles))
  for (const [type, items] of Object.entries(groups ?? {})) {
    if (!items || typeof items !== "object") continue;
    for (const [name, value] of Object.entries(items)) {
      if (name.startsWith("@")) continue;
      // Legacy nests 11 whole groups inside dashboard.aria-labels by mistake; nothing reads them there.
      if (typeof value !== "string") {
        skipped.push(`${bundle}.${type}.${name}`);
        continue;
      }
      const meta = items[`@${name}`] ?? {};
      const prefs = meta.preferences;
      rows.push({
        module_name: bundle.toUpperCase(),
        label_type: type,
        label_name: name,
        label_value: value,
        ...(meta.isVisible ? { is_visible: meta.isVisible } : {}),
        ...(meta.isMandatory ? { is_mandatory: meta.isMandatory } : {}),
        ...(meta.description ? { label_description: meta.description } : {}),
        ...(prefs && typeof prefs === "object" && Object.keys(prefs).length
          ? { preferences: prefs }
          : {}),
      });
    }
  }
const key = (r) =>
  `${r.module_name.toLowerCase()}:${r.label_type}:${r.label_name}`;
const merged = new Map(rows.map((r) => [key(r), r]));
const additions = JSON.parse(
  readFileSync(
    join(root, "src/server/platform/configuration/resource-additions.json"),
    "utf8",
  ),
);
for (const r of additions) merged.set(key(r), { ...merged.get(key(r)), ...r });
const out = [...merged.values()].sort((a, b) => key(a).localeCompare(key(b)));
const file = join(
  root,
  "src/server/platform/configuration/resource-defaults.json",
);
const text = JSON.stringify(out, null, 2) + "\n";
if (check) {
  const same = readFileSync(file, "utf8") === text;
  console.log(
    same
      ? "seed matches legacy"
      : "seed differs from legacy: run node scripts/resource-seed.mjs",
  );
  process.exit(same ? 0 : 1);
}
writeFileSync(file, text);
console.log(
  JSON.stringify({
    bundles: Object.keys(bundles),
    rows: out.length,
    additions: additions.length,
    withDescription: out.filter((r) => r.label_description).length,
    withPreferences: out.filter((r) => r.preferences).length,
    skippedNonText: skipped,
  }),
);
