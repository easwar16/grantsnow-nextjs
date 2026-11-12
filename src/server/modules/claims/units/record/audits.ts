import "server-only";
import { z } from "zod";
import { claims } from "@/server/oracle/api";
import { AppError } from "@/lib/errors";
import type { PanelHost, PanelMode } from "@/server/record/objects/panels";
import { UNIT_MODULE } from "@/shared/claims/unit-record";
import { numberish } from "../listing";
import { unitRecordRead } from "../record";
import { assuranceRequirement } from "./assurance";
import { requirementOf } from "./requirements";
import { claimAuditScope, claimLineAuditScope } from "./claims";
import { adjustmentAuditScope } from "./adjustments";

/**
 * Legacy openAudits / loadAuditData: the application's audit trails. The Summary page; a fund's allocations
 * (`claim-allocations`) and goals (`claims-unit-goals`), with the fund as the secondary object; and the Assurance
 * form, on its requirement (object type SUMMARY-ASSURANCE); a Fund Summary survey, on its requirement (`sec`), its
 * module the page and object type. The unit record has no comments.
 */
const FUND_PAGES = ["claim-allocations", "claims-unit-goals"];
const fundRow = z.object({ app_fund_id: numberish });
export async function unitPanelHost(
  id: string,
  page: string,
  mode: PanelMode,
  sec?: string,
): Promise<PanelHost> {
  if (mode === "write")
    throw new AppError("FORBIDDEN", "This record has no comments.", 403);
  // A claim's trail (legacy loadAuditTrail HEADER): page claims-unit-claims, the claim as the secondary object.
  // An adjustment's or its line's (legacy ADJ_HEADER / ADJ_LINE): `claims-unit-claims-adj-<claim>` with the
  // adjustment as `sec`, or `claims-unit-claims-adjline-<claim>-<adjustment>` with the line.
  const adjOf =
    /^claims-unit-claims-adj(?:line-(\d{1,15})-(\d{1,15})|-(\d{1,15}))$/.exec(
      page,
    );
  if (adjOf) {
    const scope = adjOf[1]
      ? await adjustmentAuditScope(id, adjOf[1], adjOf[2], sec)
      : await adjustmentAuditScope(id, adjOf[3], null, sec);
    return {
      page: "claims-unit-claims",
      bundle: "claims",
      token: scope.context.session.token,
      user: scope.context.user,
      canComment: false,
      objectType: UNIT_MODULE,
      objectId: id,
      secondary: { type: scope.type, id: scope.id },
    };
  }
  // A claim line's: the browser names it `claims-unit-claims-line-<claim_id>`, `sec` being the line's id.
  const lineOf = /^claims-unit-claims-line-(\d{1,15})$/.exec(page);
  if (page === "claims-unit-claims" || lineOf) {
    const line = lineOf !== null;
    const { context, claimId } = lineOf
      ? await claimLineAuditScope(id, lineOf[1], sec)
      : await claimAuditScope(id, sec);
    return {
      page: "claims-unit-claims",
      bundle: "claims",
      token: context.session.token,
      user: context.user,
      canComment: false,
      objectType: UNIT_MODULE,
      objectId: id,
      secondary: { type: line ? "CLAIM_LINE" : "CLAIM_HEADER", id: claimId },
    };
  }
  const known =
    page === "claims-unit-summary" ||
    page === "summary-assurance" ||
    FUND_PAGES.includes(page);
  if (!known && !/^[a-z0-9-]{1,60}$/.test(page))
    throw new AppError("BAD_REQUEST", "Invalid record page.", 400);
  // A Fund Summary survey: its requirement's module is the page and object type (legacy loadAuditTrail DYN).
  if (!known) {
    const context = await unitRecordRead(id, "activities");
    const requirement = await requirementOf(context, page, sec);
    if (!requirement)
      throw new AppError("BAD_REQUEST", "Invalid record page.", 400);
    return {
      page,
      bundle: "claims",
      token: context.session.token,
      user: context.user,
      canComment: false,
      objectType: String(requirement.reference_module),
      objectId: String(requirement.app_requirement_id),
    };
  }
  const context = await unitRecordRead(
    id,
    page === "claims-unit-goals" ? "goals" : "summary",
  );
  const base = {
    page,
    bundle: "claims",
    token: context.session.token,
    user: context.user,
    canComment: false,
  };
  if (page === "summary-assurance") {
    const requirement = await assuranceRequirement(context);
    if (!requirement?.app_requirement_id)
      throw new AppError("BAD_REQUEST", "No assurance has been saved.", 400);
    return {
      ...base,
      objectType: "SUMMARY-ASSURANCE",
      objectId: String(requirement.app_requirement_id),
    };
  }
  if (FUND_PAGES.includes(page)) {
    const funds =
      z.object({ items: z.array(fundRow).nullish() }).parse(
        await claims.appFunds({
          appId: Number(id),
          orgId: context.user.organizationId,
        }),
      ).items ?? [];
    if (!sec || !funds.some((f) => String(f.app_fund_id) === sec))
      throw new AppError(
        "FORBIDDEN",
        "This fund is not on the application.",
        403,
      );
    return {
      ...base,
      objectType: UNIT_MODULE,
      objectId: id,
      secondary: { type: "CLAIM_FUNDS", id: sec },
    };
  }
  return { ...base, objectType: UNIT_MODULE, objectId: id };
}
