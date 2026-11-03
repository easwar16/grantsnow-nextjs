import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { authenticate } from "@/server/identity/session/service";
import { people, proposals, reports } from "@/server/oracle/api";
import { formattingConfiguration } from "@/server/platform/configuration/formatting";
import { dashboardRoles } from "@/server/platform/configuration/service";
import { resources } from "@/server/platform/configuration/resources";
import { serverFunctions } from "@/server/functions";
import { linkedObjects } from "@/server/record/linked/linked";
import { proposalContext } from "./record";
import { recordIdentity } from "@/features/modules/proposals/record";

const deletedRows = z.object({
  items: z.array(
    z.object({
      proposal_id: z.number().int().positive(),
      proposal_type: z.string(),
      proposal_number: z.string(),
      proposal_title: z.string(),
      parent_proposal_id: z.number().nullish(),
      proposal_status_value: z.string().nullish(),
    }),
  ),
});
const copyRows = z.object({
  items: z.array(
    z.object({
      r: z.string(),
      d: z.string(),
      default_value: z.union([z.boolean(), z.string()]).nullish(),
    }),
  ),
});

async function authorize(
  type: string,
  id: string,
  action: "link" | "share" | "clone" | "delete",
) {
  const identity = recordIdentity.parse({ type, id });
  const [context, labels, roles] = await Promise.all([
    proposalContext(identity.type, id),
    resources(),
    dashboardRoles(),
  ]);
  const key = `list-${action}`;
  if (
    !serverFunctions.resources.resourceVisible(
      labels,
      "proposal",
      "button-labels",
      key,
    )
  )
    throw new AppError(
      "FORBIDDEN",
      "This proposal action is not available.",
      403,
    );
  if (
    action === "clone" &&
    !serverFunctions.permissions.pageAccess(roles, "proposal-clone").read
  )
    throw new AppError("FORBIDDEN", "Clone access has not been granted.", 403);
  if (
    action === "delete" &&
    !serverFunctions.permissions.pageDeleteAccess(
      roles,
      "proposal-listing-delete",
    )
  )
    throw new AppError("FORBIDDEN", "Delete access has not been granted.", 403);
  const raw = z
    .object({
      parent_proposal_id: z.number().nullish(),
      main_proposal_id: z.number().nullish(),
      proposal_status_code: z.string().nullish(),
      proposal_status: z.string().nullish(),
    })
    .parse(await proposals.summary({ id }));
  if (
    (action === "clone" || action === "delete") &&
    (raw.parent_proposal_id || raw.main_proposal_id)
  )
    throw new AppError(
      "FORBIDDEN",
      "This sub-proposal action is unavailable.",
      403,
    );
  if (
    action === "delete" &&
    (raw.proposal_status_code ?? raw.proposal_status) !== "DRFT"
  )
    throw new AppError(
      "FORBIDDEN",
      "Only draft proposals can be deleted.",
      403,
    );
  return context;
}

export async function proposalLinks(type: string, id: string) {
  await authorize(type, id, "link");
  return linkedObjects(
    { module: type, id: Number(id) },
    {
      bundle: "proposal",
      key: "no-linked-data-found",
      fallback: "No Linked Data Found",
    },
  );
}

export async function proposalCopyOptions(type: string, id: string) {
  await authorize(type, id, "clone");
  return copyRows
    .parse(await proposals.copyObjects({ type }))
    .items.map((row) => ({
      value: row.r,
      label: row.d,
      required: row.default_value === true || row.default_value === "true",
    }));
}

export async function proposalCopy(
  type: string,
  id: string,
  selected: string[],
) {
  const options = await proposalCopyOptions(type, id);
  const allowed = new Set(options.map((option) => option.value));
  if (selected.some((value) => !allowed.has(value)))
    throw new AppError("BAD_REQUEST", "Unknown proposal copy option.", 400);
  const objects = options
    .filter((option) => option.required || selected.includes(option.value))
    .map((option) => option.value);
  const result = z
    .object({ proposal: z.number().int().positive() })
    .parse(await proposals.copy({ id: Number(id), objects }));
  return { id: result.proposal, type };
}

export async function proposalDelete(type: string, id: string) {
  await authorize(type, id, "delete");
  await proposals.remove({ id });
  return { deleted: true };
}

export async function proposalDeleted() {
  const { user } = await authenticate();
  serverFunctions.permissions.requireModule(user, "PROPOSALS");
  return deletedRows.parse(await proposals.deleted()).items.map((row) => ({
    id: row.proposal_id,
    type: row.proposal_type,
    reference: row.proposal_number,
    title: row.proposal_title,
    status: row.proposal_status_value ?? "",
    canRestore: !row.parent_proposal_id,
  }));
}

export async function proposalRestore(id: number) {
  const row = (await proposalDeleted()).find((item) => item.id === id);
  if (!row || !row.canRestore)
    throw new AppError("FORBIDDEN", "This proposal cannot be restored.", 403);
  await proposals.restore({ id: String(id) });
  return { restored: true };
}

const reportRows = z.object({
  items: z.array(
    z.object({
      page_name: z.string(),
      page_desc: z.string(),
      show_item: z.string().nullish(),
    }),
  ),
});

export async function proposalShareOptions(type: string, id: string) {
  await authorize(type, id, "share");
  const [rawReports, persons] = await Promise.all([
    reports.forObject({ id }),
    people.all(),
  ]);
  return {
    reports: reportRows
      .parse(rawReports)
      .items.filter((row) => row.show_item === "Y")
      .map((row) => ({ value: row.page_name, label: row.page_desc })),
    people: persons
      .filter((person) => person.email_address)
      .map((person) => ({
        value: person.email_address!,
        label: person.full_name ?? person.email_address!,
        detail: person.org_unit_name ?? "",
      })),
  };
}

export async function proposalShareDocument(
  type: string,
  id: string,
  report: string,
  emails: string[],
) {
  const [context, options, formatting] = await Promise.all([
    authorize(type, id, "share"),
    proposalShareOptions(type, id),
    formattingConfiguration(),
  ]);
  if (
    !options.reports.some((option) => option.value === report) ||
    emails.length === 0 ||
    emails.some(
      (email) => !options.people.some((person) => person.value === email),
    )
  )
    throw new AppError(
      "BAD_REQUEST",
      "Choose an available report and recipient.",
      400,
    );
  const currency = formatting.currency;
  const orgId = Number(context.user.organizationId);
  if (!currency || !Number.isSafeInteger(orgId))
    throw new AppError(
      "CONTRACT",
      "The report currency or organization is unavailable.",
    );
  const bind = (
    type: "NUMBER" | "VARCHAR2" | "DATE",
    value: number | string | null,
  ) => ({ type, value });
  await reports.share({
    id,
    report,
    emails,
    body: {
      report_code: report,
      binds: {
        proposal_id: bind("NUMBER", Number(id)),
        object_type: bind("VARCHAR2", type),
        object_id: bind("NUMBER", Number(id)),
        conv_rate: bind("NUMBER", 1),
        curr_code: bind("VARCHAR2", currency),
        curr_symbol: bind(
          "VARCHAR2",
          new Intl.NumberFormat("en", {
            style: "currency",
            currency,
          }).formatToParts()[0]?.value ?? "",
        ),
        costing_header_id: bind("NUMBER", null),
        org_id: bind("NUMBER", orgId),
        creation_date: bind("DATE", null),
      },
    },
  });
  return { shared: true };
}
