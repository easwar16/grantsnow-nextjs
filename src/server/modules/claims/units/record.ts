import "server-only";
import type { AttachmentHost } from "@/server/record/attachments/attachments";
import { cache } from "react";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import { roles as recordRoles } from "@/server/oracle/api";
import { recordId, recordRoleRows } from "@/server/record/shared";
import { AppError } from "@/lib/errors";
import { serverFunctions } from "@/server/functions";
import {
  UNIT_MODULE,
  unitTabs,
  pageOf,
  type UnitTab,
} from "@/shared/claims/unit-record";

export const unitRecordIdentity = z.object({
  id: recordId,
  tab: z.enum(unitTabs),
});

/**
 * One unit application's record (legacy claims-unit-inquiry-info-page vbBeforeEnter): the drawer grant, then the
 * application's own CLAIMS roles. Legacy refused no roles or Summary read N; a missing Summary row is refused too
 * (fail closed).
 */
export const unitRecordContext = cache(async (id: string) => {
  if (!recordId.safeParse(id).success)
    throw new AppError("BAD_REQUEST", "Invalid application identity.", 400);
  const { session, user } = await authenticate();
  serverFunctions.permissions.requireDrawerAccess(user, "claims-unit-inquiry");
  const access = serverFunctions.permissions.objectAccessOf(
    recordRoleRows.parse(
      await recordRoles.record({ objectType: UNIT_MODULE, objectId: id }),
    ).items,
  );
  if (access.roles.get(pageOf("summary"))?.read !== true)
    throw new AppError(
      "FORBIDDEN",
      "You don't have access to this application",
      403,
    );
  return {
    session,
    user,
    id,
    access,
    // Legacy getTabs: a tab shows when its page has read access.
    tabs: unitTabs.filter(
      (tab) => access.roles.get(pageOf(tab))?.read === true,
    ),
  };
});
export type UnitRecordContext = Awaited<ReturnType<typeof unitRecordContext>>;

/** A tab the record does not show is refused, as getTabs hides it and subFlowAccessGuard turns it away. */
export async function unitRecordRead(id: string, tab: UnitTab) {
  const context = await unitRecordContext(id);
  if (!context.tabs.includes(tab))
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to this page.",
      403,
    );
  return context;
}

/**
 * The Attachments tab's host (legacy claims-unit-attachments on the shared fragment, 9272): the application under
 * the CLAIMS object type, upload and delete with the tab's edit right.
 */
export async function unitAttachmentHost(
  id: string,
  mode: "read" | "view" | "edit",
): Promise<AttachmentHost> {
  const context = await unitRecordRead(id, "attachments");
  const canEdit =
    context.access.roles.get(pageOf("attachments"))?.edit === true;
  if (mode === "edit" && !canEdit)
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to change these attachments.",
      403,
    );
  return {
    objectType: UNIT_MODULE,
    objectId: id,
    objectNumber: id,
    pathSegment: UNIT_MODULE,
    bundle: "claims",
    token: context.session.token,
    user: context.user,
    canEdit: mode !== "read" && canEdit,
  };
}
