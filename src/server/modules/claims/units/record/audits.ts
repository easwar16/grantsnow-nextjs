import "server-only";
import { z } from "zod";
import { claims } from "@/server/oracle/api";
import { AppError } from "@/lib/errors";
import type { PanelHost, PanelMode } from "@/server/record/objects/panels";
import { UNIT_MODULE } from "@/shared/claims/unit-record";
import { numberish } from "../listing";
import { unitRecordRead } from "../record";
import { assuranceRequirement } from "./assurance";

/**
 * Legacy openAudits / loadAuditData: the application's audit trails. The Summary page; a fund's allocations
 * (`claim-allocations`) and goals (`claims-unit-goals`), with the fund as the secondary object; and the Assurance
 * form, on its requirement (object type SUMMARY-ASSURANCE). The unit record has no comments.
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
  if (
    page !== "claims-unit-summary" &&
    page !== "summary-assurance" &&
    !FUND_PAGES.includes(page)
  )
    throw new AppError("BAD_REQUEST", "Invalid record page.", 400);
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
