import "server-only";
import { z } from "zod";
import { awards } from "@/server/oracle/api";
import { getIcApiIntegrationV1FlowsRestUNIT4_MAIN_FLOW1_0Unit4integration as erpFlow } from "@/server/oic/api/catalogue";
import { oracleContext } from "@/server/oracle/context";
import { forgetOperation } from "@/server/oracle/cache";
import { AppError } from "@/lib/errors";
import { pageOf } from "@/shared/awards/award-record";
import { awardRecordRead } from "../record";

const details = z.object({
  erp_type: z.string().nullish(),
  oic_endpoint: z.string().nullish(),
});
// custErpDetails' oic_endpoint, e.g. /UNIT4_ERP_FLOW/1.0/unit4integration: a REST flow under the integration root only.
const ENDPOINT =
  /^\/([A-Za-z0-9_]{1,100})\/(\d{1,3}\.\d{1,3})\/([A-Za-z0-9_-]{1,100})$/;
const reply = z.object({ Status: z.string().nullish() }).passthrough();

/** Whether the award offers Send to ERP: internally approved, and the user may edit the award's header page. */
export const canSendToErp = (
  status: string,
  access: { roles: ReadonlyMap<string, { edit?: boolean }> },
) => status === "IA" && access.roles.get(pageOf("header"))?.edit === true;

/**
 * WRITES: legacy sendToERPButtonActionChain. Reads the tenant's ERP target and posts `{AwardId, Token}` to its OIC
 * flow, server to server. Legacy defects fixed: the button had no access gate (now the header page's edit right),
 * an unknown `erp_type` did nothing silently, and the flow address was used unchecked.
 */
export async function sendToErp(id: string) {
  const context = await awardRecordRead(id, "header");
  if (!canSendToErp(context.award.award_status ?? "", context.access))
    throw new AppError(
      "FORBIDDEN",
      "Only an internally approved award can be sent to ERP, by someone who can edit it.",
      403,
    );
  const target = details.parse(await awards.erpDetails());
  if (target.erp_type !== "ORACLE" && target.erp_type !== "UNIT4")
    throw new AppError(
      "BUSINESS",
      "No supported ERP is configured for awards.",
      409,
    );
  const path = ENDPOINT.exec(target.oic_endpoint ?? "");
  if (!path)
    throw new AppError(
      "CONTRACT",
      "The ERP integration address is not a valid flow path.",
    );
  const { token } = await oracleContext();
  try {
    const answer = reply.safeParse(
      await erpFlow({
        flow: path[1],
        version: path[2],
        resource: path[3],
        body: { AwardId: Number(id), Token: token },
      }),
    );
    return { status: (answer.success && answer.data.Status) || "Sent" };
  } finally {
    // The hand-off can move the award's status; the next read must see it.
    forgetOperation("getPost_awardsAwardDetails", token);
    forgetOperation("getPost_awardsAwardHeader", token);
  }
}
