// Clears local, git-ignored build and test output. Source, docs, .env files and git are never touched.
//   npm run clean               e2e scratch copies, build-check output, Playwright results/report, TS build info
//   npm run clean -- --dev      also the dev server's build cache (.next); skipped while the dev server is running
//   npm run clean -- --deps     also node_modules (restore with `npm ci`)
//   add --dry-run to list what would be removed without deleting anything
import { existsSync, lstatSync, readdirSync, rmSync } from "node:fs";
import { connect } from "node:net";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const targets = [
  [".validation", "e2e scratch copies"],
  [".next-check", "isolated production-build check"],
  ["test-results", "Playwright results"],
  ["playwright-report", "Playwright report"],
  ["tsconfig.tsbuildinfo", "TypeScript build info"],
];

// Size on disk without following symlinks (the e2e copies link node_modules back to the project).
function size(path) {
  const stat = lstatSync(path);
  if (!stat.isDirectory()) return stat.size;
  return readdirSync(path).reduce(
    (sum, name) => sum + size(join(path, name)),
    0,
  );
}
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;

// The dev cache is in use while `npm run dev` listens on APP_ORIGIN's port (3000 by default).
function devServerRunning(port = 3000) {
  return new Promise((done) => {
    const socket = connect({ port, host: "localhost" });
    socket.setTimeout(1000);
    socket.once("connect", () => (socket.destroy(), done(true)));
    socket.once("timeout", () => (socket.destroy(), done(false)));
    socket.once("error", () => done(false));
  });
}

if (args.has("--dev")) {
  if (await devServerRunning())
    console.log(
      "Skipped .next: the dev server is running (stop it first to clear its cache).",
    );
  else targets.push([".next", "dev server build cache"]);
}
if (args.has("--deps"))
  targets.push(["node_modules", "dependencies (restore with `npm ci`)"]);

let freed = 0;
for (const [name, what] of targets) {
  const path = join(root, name);
  if (!existsSync(path)) continue;
  const bytes = size(path);
  // rmSync removes symlinks themselves and never follows them, so linked node_modules stay intact.
  if (!dryRun) rmSync(path, { recursive: true, force: true });
  freed += bytes;
  console.log(
    `${dryRun ? "Would remove" : "Removed"} ${name} (${what}): ${mb(bytes)}`,
  );
}
console.log(
  freed
    ? `${dryRun ? "Would free" : "Freed"} ${mb(freed)}.`
    : "Nothing to clear.",
);
