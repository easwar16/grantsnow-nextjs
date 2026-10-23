import "server-only";
import { z } from "zod";
import { eoiRecordContext } from "@/server/opportunities/record";
import {
  EOI_MODULE,
  eoiTabs,
  pageOf,
} from "@/server/opportunities/eoi-record/model";
import { AppError } from "@/lib/errors";
import type { UserContext } from "@/features/auth/types";

/**
 * One host of the shared comments and audit panels (legacy `object-comments` and each detail page's audit drawer).
 * The host settles who may read the record's page (its object role `read`) and who may write (`edit`); both fail
 * closed, and every request resolves it again.
 */
export interface PanelHost {
  objectType: string;
  objectId: string;
  /** The page id: the comment thread key (`module`) and the audit's `p_page_name`. */
  page: string;
  /** The resource bundle the labels come from. */
  bundle: string;
  token: string;
  user: UserContext;
  canComment: boolean;
}
export type PanelMode = "read" | "write";

const eoiPages: string[] = eoiTabs.map(pageOf);
/** The EOI record: any of its pages the record's roles let the user read; legacy passes canComment `true`. */
async function eoiPanelHost(
  id: string,
  page: string,
  mode: PanelMode,
): Promise<PanelHost> {
  if (!eoiPages.includes(page))
    throw new AppError("BAD_REQUEST", "Invalid record page.", 400);
  const { session, user, access } = await eoiRecordContext(id);
  const rights = access.roles.get(page);
  if (rights?.read !== true)
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to this page.",
      403,
    );
  if (mode === "write" && rights.edit !== true)
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to comment on this page.",
      403,
    );
  return {
    objectType: EOI_MODULE,
    objectId: id,
    page,
    bundle: "opportunities-eoi",
    token: session.token,
    user,
    canComment: rights.edit === true,
  };
}
const HOSTS: Record<
  string,
  (id: string, page: string, mode: PanelMode) => Promise<PanelHost>
> = { [EOI_MODULE]: eoiPanelHost };
const hostQuery = z.object({
  type: z.enum(Object.keys(HOSTS) as [string, ...string[]]),
  id: z.string().regex(/^[1-9]\d{0,14}$/),
  page: z.string().regex(/^[a-z0-9-]{1,80}$/),
});
/** `?type&id&page` → the resolved host; anything malformed or unknown is a 400. */
export function panelHost(q: URLSearchParams, mode: PanelMode) {
  const parsed = hostQuery.safeParse({
    type: q.get("type"),
    id: q.get("id"),
    page: q.get("page"),
  });
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid record panel request.", 400);
  const { type, id, page } = parsed.data;
  return HOSTS[type](id, page, mode);
}
