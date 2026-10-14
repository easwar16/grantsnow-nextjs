import { cpSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
// Two Next dev processes cannot share next-env.d.ts, even with separate distDir.
// Copy only source/config/test assets; credentials and captures never enter it.
const source = process.cwd();
const workspace = resolve(source, ".validation", `e2e-${Date.now()}`);
mkdirSync(workspace, { recursive: true });
for (const entry of [
  "src",
  "public",
  "tests",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "next.config.ts",
  "playwright.config.ts",
])
  cpSync(join(source, entry), join(workspace, entry), { recursive: true });
symlinkSync(
  join(source, "node_modules"),
  join(workspace, "node_modules"),
  "dir",
);
writeFileSync(
  join(workspace, "next-env.d.ts"),
  '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n',
);
const result = spawnSync(
  process.execPath,
  [
    join(source, "node_modules/@playwright/test/cli.js"),
    "test",
    ...process.argv.slice(2),
  ],
  {
    cwd: workspace,
    stdio: "inherit",
    env: { ...process.env, GRANTSNOW_SOURCE_ROOT: source },
  },
);
for (const entry of ["test-results", "playwright-report"]) {
  try {
    cpSync(join(workspace, entry), join(source, entry), { recursive: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
process.exitCode = result.status ?? 1;
