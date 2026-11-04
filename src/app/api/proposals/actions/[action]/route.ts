import { ZodError } from "zod";
import { readText } from "@/server/http/body";
import { route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import { advancedSetup } from "@/server/modules/proposals/advanced";
import { createProposal } from "@/server/modules/proposals/create";
import {
  proposalCopyOptions,
  proposalDeleted,
  proposalLinks,
  proposalListWrites,
  proposalShareOptions,
} from "@/server/modules/proposals/list-actions";
// The create form's text is the largest body.
const MAX_BODY = 12_000;
const invalid = (e: unknown) =>
  e instanceof ZodError
    ? new AppError("BAD_REQUEST", "Invalid Proposal action.", 400)
    : e;
const reads: Record<string, (q: URLSearchParams) => Promise<unknown>> = {
  advanced: () => advancedSetup(),
  recycle: () => proposalDeleted(),
  links: (q) => proposalLinks(q.get("type") ?? "", q.get("id") ?? ""),
  "copy-options": (q) =>
    proposalCopyOptions(q.get("type") ?? "", q.get("id") ?? ""),
  "share-options": (q) =>
    proposalShareOptions(q.get("type") ?? "", q.get("id") ?? ""),
};
const writes: Record<string, (body: unknown) => Promise<unknown>> = {
  create: createProposal,
  ...proposalListWrites,
};
type Context = { params: Promise<{ action: string }> };
/** The listing's dialog setups: Advanced Query, the recycle bin, links, copy and share options (?type, ?id). */
export const GET = route<Context>(
  async (request, { params }) => {
    const { action } = await params;
    const read = Object.hasOwn(reads, action) ? reads[action] : undefined;
    if (!read) throw new AppError("BAD_REQUEST", "Unknown action.", 400);
    return read(searchOf(request));
  },
  { onError: invalid },
);
/** WRITES: create, copy, delete, restore, share as a document. */
export const POST = route<Context>(
  async (request, { params }) => {
    const { action } = await params;
    const write = Object.hasOwn(writes, action) ? writes[action] : undefined;
    if (!write) throw new AppError("BAD_REQUEST", "Unknown action.", 400);
    let body: unknown;
    try {
      body = JSON.parse(await readText(request, MAX_BODY));
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid Proposal action.", 400);
    }
    return write(body);
  },
  { write: true, onError: invalid },
);
