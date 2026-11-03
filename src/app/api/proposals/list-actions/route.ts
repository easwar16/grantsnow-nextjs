import { z } from "zod";
import { route, searchOf } from "@/server/http/route";
import {
  proposalCopy,
  proposalCopyOptions,
  proposalDelete,
  proposalDeleted,
  proposalLinks,
  proposalRestore,
  proposalShareDocument,
  proposalShareOptions,
} from "@/server/modules/proposals/list-actions";
import { AppError } from "@/lib/errors";

export const GET = route(async (request) => {
  const query = searchOf(request);
  const action = query.get("action");
  if (action === "recycle") return proposalDeleted();
  const type = query.get("type") ?? "",
    id = query.get("id") ?? "";
  if (action === "links") return proposalLinks(type, id);
  if (action === "copy-options") return proposalCopyOptions(type, id);
  if (action === "share-options") return proposalShareOptions(type, id);
  throw new AppError("BAD_REQUEST", "Unknown proposal action.", 400);
});

export const POST = route(
  async (request) => {
    const input = z
      .discriminatedUnion("action", [
        z.object({
          action: z.literal("copy"),
          type: z.string(),
          id: z.string(),
          objects: z.array(z.string()),
        }),
        z.object({
          action: z.literal("delete"),
          type: z.string(),
          id: z.string(),
        }),
        z.object({
          action: z.literal("restore"),
          id: z.number().int().positive(),
        }),
        z.object({
          action: z.literal("share-document"),
          type: z.string(),
          id: z.string(),
          report: z.string(),
          emails: z.array(z.string().email()).min(1),
        }),
      ])
      .parse(await request.json());
    if (input.action === "copy")
      return proposalCopy(input.type, input.id, input.objects);
    if (input.action === "delete") return proposalDelete(input.type, input.id);
    if (input.action === "share-document")
      return proposalShareDocument(
        input.type,
        input.id,
        input.report,
        input.emails,
      );
    return proposalRestore(input.id);
  },
  { write: true },
);
