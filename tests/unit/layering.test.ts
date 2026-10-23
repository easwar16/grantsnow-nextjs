import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

// docs/architecture.md § Layering rules, checked on the source.
const src = join(process.cwd(), "src");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? walk(path)
      : /\.(ts|tsx)$/.test(name)
        ? [path]
        : [];
  });
const files = walk(src).map((path) => ({
  path: path.slice(src.length + 1),
  text: readFileSync(path, "utf8"),
}));
// A value import (not `import type`, and not only `type` names) from the given prefix.
const valueImports = (text: string, prefix: string) =>
  [
    ...text.matchAll(
      /^import\s+(?!type\b)([^;]*?)\s+from\s+"(@\/[^"]+)";?$/gms,
    ),
  ].filter(
    ([, names, spec]) =>
      spec.startsWith(prefix) &&
      !/^\{\s*(type\s+\w+\s*,?\s*)+\}$/.test(names.trim()),
  );

it("keeps client components off server code (types only)", () => {
  const leaks = files
    .filter((f) => /^\s*["']use client["']/.test(f.text))
    .flatMap((f) =>
      valueImports(f.text, "@/server/").map(
        ([, , spec]) => `${f.path} → ${spec}`,
      ),
    );
  expect(leaks).toEqual([]);
});
it("keeps shared/ pure: neither a client nor a server-only module", () => {
  const impure = files
    .filter((f) => f.path.startsWith("shared/"))
    .filter(
      (f) =>
        /["']use client["']/.test(f.text) ||
        /import\s+["']server-only["']/.test(f.text) ||
        valueImports(f.text, "@/server/").length > 0,
    )
    .map((f) => f.path);
  expect(impure).toEqual([]);
});
it("calls Oracle only from the API layer and the session module", () => {
  const direct = files
    .filter(
      (f) =>
        !f.path.startsWith("server/oracle/") &&
        !f.path.startsWith("server/identity/") &&
        !f.path.startsWith("app/api/auth/") &&
        !f.path.startsWith("test-support/"),
    )
    .filter((f) => /\boracle(Write)?\(/.test(f.text))
    .map((f) => f.path);
  expect(direct).toEqual([]);
});
