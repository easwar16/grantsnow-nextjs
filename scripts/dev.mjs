// `npm run dev`: next dev with .env.dev.local on top, when it exists (local IDCS sign-in for testing).
// Next only auto-loads fixed names, and `node --env-file-if-exists` cannot reach next's worker, so the values go in
// the environment here; set before Next starts, they win over .env.local and .env.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const file = ".env.dev.local";
const local = existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {};
const next = spawn(
  process.execPath,
  [
    ...process.execArgv,
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "localhost",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", env: { ...process.env, ...local } },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => next.kill(signal));
next.on("exit", (code, signal) =>
  signal ? process.kill(process.pid, signal) : process.exit(code ?? 0),
);
