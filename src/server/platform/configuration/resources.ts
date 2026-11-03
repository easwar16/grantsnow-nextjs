import "server-only";
import { AppError } from "@/lib/errors";
import { cache } from "react";
import { memo, memoKey } from "@/server/oracle/cache";
import { configuration } from "@/server/oracle/api";
import { authenticate } from "@/server/identity/session/service";
import { serverConstants } from "@/server/constants";
import { serverFunctions } from "@/server/functions";
/** Legacy shell-page findModuleAccess: the bundles a user's modules need, DASHBOARD always. */
const MODULE_BUNDLES: Record<string, string[]> = {
  "opportunities-group": ["OPPORTUNITIES-EOI"],
  // Outline proposals are reached through EOI Convert and shared links, so their bundle loads with PROPOSALS (8336).
  PROPOSALS: [
    "PROPOSAL",
    "SUB_PROPOSAL",
    "EXTENSION_PROPOSAL",
    "OUTLINE_PROPOSAL",
  ],
  OUTLINE_PROPOSAL: ["OUTLINE_PROPOSAL"],
  ETHICS: ["ETHICS"],
  AWARDS: ["AWARD"],
  CONTRACTS: ["CONTRACT"],
  DUE_DILIGENCE: ["DUE_DILIGENCE"],
};

export function labelBundles(modules: Record<string, boolean>) {
  return [
    ...new Set([
      "DASHBOARD",
      ...Object.keys(modules)
        .filter((m) => modules[m] === true)
        .flatMap((m) => MODULE_BUNDLES[m] ?? []),
    ]),
  ].join(",");
}

export const resources = cache(async () => {
  const { session, user } = await authenticate();
  // The merged bundle (seeds included, or seeds alone) is held for a few minutes: labels change only by admin edits.
  return memo(
    memoKey("labels", session.token),
    serverConstants.ttl.config,
    async () => {
      let rows: unknown = [];
      try {
        rows = await configuration.labels(
          { bundles: labelBundles(user.modules) },
          { token: session.token },
        );
      } catch (e) {
        // Legacy merges backend rows over the seeds; with the labels call unreachable the seeds alone render.
        if (!(e instanceof AppError && e.code === "UPSTREAM")) throw e;
      }
      return serverFunctions.resources.mergeResourceDefaults(rows);
    },
  );
});

export type Resources = Awaited<ReturnType<typeof resources>>;
