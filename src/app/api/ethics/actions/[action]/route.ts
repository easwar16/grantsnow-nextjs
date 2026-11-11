import { ZodError } from "zod";
import { readText } from "@/server/http/body";
import { route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import {
  cloneEthics,
  createEthics,
  deleteEthics,
  deletedEthics,
  ethicsCloneOptions,
  ethicsCreateForm,
  ethicsCreateSetup,
  restoreEthics,
  ethicsCreatePeople,
  ethicsCreateSupervisors,
  updateEthics,
} from "@/server/modules/ethics/actions";
import {
  ethicsReferenceTypes,
  ethicsReferenceItems,
  linkEthicsReferences,
  unlinkEthicsReference,
} from "@/server/modules/ethics/record/references";
// The create form's text and a few ids.
const MAX_BODY = 32768;
const invalid = (e: unknown) =>
  e instanceof ZodError
    ? new AppError("BAD_REQUEST", "Invalid ethics action.", 400)
    : e;
const reads: Record<string, (q: URLSearchParams) => Promise<unknown>> = {
  create: () => ethicsCreateSetup(),
  form: (q) =>
    ethicsCreateForm(
      q.get("formType") ?? "",
      q.get("id") ?? undefined,
      q.get("access") ?? undefined,
    ),
  recycle: () => deletedEthics(),
  "clone-options": (q) =>
    ethicsCloneOptions(q.get("id") ?? "", q.get("access") ?? ""),
  people: (q) =>
    ethicsCreatePeople(
      q.get("org") ?? "",
      q.get("id") ?? undefined,
      q.get("access") ?? undefined,
    ),
  supervisors: (q) =>
    ethicsCreateSupervisors(
      q.get("id") ?? undefined,
      q.get("access") ?? undefined,
    ),
  "reference-types": (q) =>
    ethicsReferenceTypes(q.get("id") ?? "", q.get("access") ?? ""),
  "reference-items": (q) =>
    ethicsReferenceItems(
      q.get("id") ?? "",
      q.get("access") ?? "",
      q.get("type") ?? "",
    ),
};
const writes: Record<string, (body: unknown) => Promise<unknown>> = {
  create: createEthics,
  restore: restoreEthics,
  clone: cloneEthics,
  update: updateEthics,
  link: linkEthicsReferences,
};
type Context = { params: Promise<{ action: string }> };
/** The listing's setups: the New form's choices and form metadata, the recycle bin. */
export const GET = route<Context>(
  async (request, { params }) => {
    const { action } = await params;
    const read = Object.hasOwn(reads, action) ? reads[action] : undefined;
    if (!read) throw new AppError("BAD_REQUEST", "Unknown action.", 400);
    return read(searchOf(request));
  },
  { onError: invalid },
);
/** WRITES: create a draft, restore from the recycle bin, clone a listed application. */
export const POST = route<Context>(
  async (request, { params }) => {
    const { action } = await params;
    const write = Object.hasOwn(writes, action) ? writes[action] : undefined;
    if (!write) throw new AppError("BAD_REQUEST", "Unknown action.", 400);
    let body: unknown;
    try {
      body = JSON.parse(await readText(request, MAX_BODY));
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid ethics action.", 400);
    }
    return write(body);
  },
  { write: true, onError: invalid },
);
/** WRITES: a listed application to the recycle bin (legacy listing Delete), or one reference unlinked. */
export const DELETE = route<Context>(
  async (request, { params }) => {
    const { action } = await params;
    if (action !== "delete" && action !== "unlink")
      throw new AppError("BAD_REQUEST", "Unknown action.", 400);
    const q = searchOf(request);
    return action === "delete"
      ? deleteEthics({ id: q.get("id"), access: q.get("access") })
      : unlinkEthicsReference({
          id: q.get("id"),
          access: q.get("access"),
          relationId: q.get("relationId"),
          page: q.get("page"),
        });
  },
  { write: true, onError: invalid },
);
