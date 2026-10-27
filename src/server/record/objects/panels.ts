import "server-only";
import { z } from "zod";
import { eoiRecordContext } from "@/server/modules/opportunities/record";
import { EOI_MODULE, eoiTabs, pageOf } from "@/shared/opportunities/eoi-record";
import { AppError } from "@/lib/errors";
import { awardRecordContext } from "@/server/modules/awards/record";
import {
  AWARD_MODULE,
  awardTabs,
  pageOf as awardPage,
} from "@/shared/awards/award-record";
import type { UserContext } from "@/shared/auth/types";
import {
  CONTRACT_MODULE,
  CONTRACT_PAGES,
  contractRecordContext,
} from "@/server/modules/contracts/service";

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

type RecordRights = Pick<
  Awaited<ReturnType<typeof eoiRecordContext>>,
  "session" | "user" | "access"
>;
/**
 * A record host: any of its pages the record's roles let the user read; writing needs edit. Legacy passed canComment
 * `true` on every record.
 */
const recordHost =
  (
    objectType: string,
    bundle: string,
    pages: string[],
    context: (id: string) => Promise<RecordRights>,
  ) =>
  async (id: string, page: string, mode: PanelMode): Promise<PanelHost> => {
    if (!pages.includes(page))
      throw new AppError("BAD_REQUEST", "Invalid record page.", 400);
    const { session, user, access } = await context(id);
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
      objectType,
      objectId: id,
      page,
      bundle,
      token: session.token,
      user,
      canComment: rights.edit === true,
    };
  };
const HOSTS: Record<
  string,
  (id: string, page: string, mode: PanelMode) => Promise<PanelHost>
> = {
  [EOI_MODULE]: recordHost(
    EOI_MODULE,
    "opportunities-eoi",
    eoiTabs.map(pageOf),
    eoiRecordContext,
  ),
  [AWARD_MODULE]: recordHost(
    AWARD_MODULE,
    "award",
    awardTabs.map(awardPage),
    awardRecordContext,
  ),
  [CONTRACT_MODULE]: recordHost(
    CONTRACT_MODULE,
    "contract",
    CONTRACT_PAGES,
    contractRecordContext,
  ),
};
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
