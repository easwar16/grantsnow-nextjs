import "server-only";
import { read, write } from "../client";

/**
 * A proposal version's FX rates. The body comes back as read: the FX service checks it against the record it asked
 * for. Record data, held for the request only.
 */
type Version = { proposalId: string; versionId: string };
/** The version's rates (proposalFxRates). */
export const rates = read<Version>({
  op: "getProposalFxRates",
  headers: (p) => ({ proposal_id: p.proposalId, version_id: p.versionId }),
});
/** WRITES: the version's rates for one mode (`PURCHASE` or `INCOME`); `body` is built from the rows read. */
export const save = write<Version & { mode: string; body: unknown }>({
  op: "postProposalFxRates",
  headers: (p) => ({
    proposal_id: p.proposalId,
    version_id: p.versionId,
    mode: p.mode,
  }),
  body: (p) => p.body,
});
