import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { authenticate } from "@/server/identity/session/service";
import { reports } from "@/server/oracle/api";
import { dashboardRoles } from "@/server/platform/configuration/service";
import { serverFunctions } from "@/server/functions";
import { ethicsRecord, ethicsStakeholder, type EthicsRecord } from "../record";

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
  .object({
    access: z.enum(["EA_ACCESS", "RESPONDENT_ACCESS", "APPROVER_ACCESS"]),
    participant: z.string().regex(/^[1-9]\d{0,14}$/),
    code: z.string(),
  })
  .strict();

async function available(record: EthicsRecord, participantId: string) {
  const { user } = await authenticate();
  const participant = ethicsStakeholder(
    record,
    String(user.personId),
    participantId,
  );
  if (
    !record.tabs.includes("ethics-responses") ||
    record.statusCode === "DRFT" ||
    !participant ||
    (record.access === "RESPONDENT_ACCESS" &&
      participant.personId !== String(user.personId))
  )
    throw new AppError(
      "FORBIDDEN",
      "Ethics print access has not been granted.",
      403,
    );
  if (
    !serverFunctions.permissions.pageAccess(
      await dashboardRoles(),
      "ethics-print-button",
    ).read
  )
    throw new AppError(
      "FORBIDDEN",
      "Ethics print access has not been granted.",
      403,
    );
  return {
    participant,
    reports: list.parse(
      await reports.forObject({ id: record.id, objectType: "ETHICS" }),
    ).items,
  };
}
export async function ethicsPrintOptions(
  record: EthicsRecord,
  participantId: string,
) {
  const { reports } = await available(record, participantId);
  return reports.map((row) => ({
    code: row.page_name,
    label: row.page_desc,
    enabled: row.show_item !== "N",
  }));
}
export async function printEthics(id: string, raw: unknown) {
  const input = request.parse(raw);
  const record = await ethicsRecord(id, input.access);
  const { participant, reports: choices } = await available(
    record,
    input.participant,
  );
  if (
    input.code === "report-vbcs-ethics" ||
    !choices.some(
      (row) => row.page_name === input.code && row.show_item !== "N",
    )
  )
    throw new AppError(
      "BAD_REQUEST",
      "Choose an available Ethics report.",
      400,
    );
  const { user } = await authenticate();
  return reports.generate({
    body: serverFunctions.reports.reportPayload(input.code, {
      proposal_id: null,
      object_type: "ETHICS",
      object_id: Number(participant.id),
      conv_rate: null,
      curr_code: null,
      curr_symbol: null,
      costing_header_id: null,
      org_id: Number(user.organizationId),
      creation_date: null,
    }),
  });
}
