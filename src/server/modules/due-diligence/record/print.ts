import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { authenticate } from "@/server/identity/session/service";
import { reports } from "@/server/oracle/api";
import { dashboardRoles } from "@/server/platform/configuration/service";
import { serverFunctions } from "@/server/functions";
import { dueDiligenceRecord, type DueDiligenceRecord } from "../record";

const list = z.object({
  items: z.array(
    z.object({
      page_name: z.string().min(1),
      page_desc: z.string(),
      show_item: z.string().nullish(),
    }),
  ),
});
const request = z
  .object({ access: z.string(), respondent: z.string(), code: z.string() })
  .strict();

async function available(record: DueDiligenceRecord, respondentId: string) {
  const { user } = await authenticate();
  const respondent = record.respondents.find((row) => row.id === respondentId);
  if (
    !record.tabs.includes("duediligence-responses") ||
    record.statusCode === "DRFT" ||
    !respondent ||
    (record.access === "RESPONDENT_ACCESS" &&
      respondent.personId !== String(user.personId))
  )
    throw new AppError(
      "FORBIDDEN",
      "Due Diligence print access has not been granted.",
      403,
    );
  const granted = serverFunctions.permissions.pageAccess(
    await dashboardRoles(),
    "due-diligence-print-button",
  );
  if (!granted.read)
    throw new AppError(
      "FORBIDDEN",
      "Due Diligence print access has not been granted.",
      403,
    );
  return {
    respondent,
    reports: list.parse(
      await reports.forObject({ id: record.id, objectType: "DUE_DILIGENCE" }),
    ).items,
  };
}

export async function dueDiligencePrintOptions(
  record: DueDiligenceRecord,
  respondentId: string,
) {
  const { reports } = await available(record, respondentId);
  return reports.map((row) => ({
    code: row.page_name,
    label: row.page_desc,
    enabled: row.show_item !== "N",
  }));
}

export async function printDueDiligence(id: string, raw: unknown) {
  const input = request.parse(raw);
  const record = await dueDiligenceRecord(id, input.access);
  const { respondent, reports: choices } = await available(
    record,
    input.respondent,
  );
  if (
    input.code === "report-vbcs-ethics" ||
    !choices.some(
      (row) => row.page_name === input.code && row.show_item !== "N",
    )
  )
    throw new AppError(
      "BAD_REQUEST",
      "Choose an available Due Diligence report.",
      400,
    );
  const { user } = await authenticate();
  return reports.generate({
    body: serverFunctions.reports.reportPayload(input.code, {
      proposal_id: null,
      object_type: "DUE_DILIGENCE",
      object_id: Number(respondent.id),
      conv_rate: null,
      curr_code: null,
      curr_symbol: null,
      costing_header_id: null,
      org_id: Number(user.organizationId),
      creation_date: null,
    }),
  });
}
