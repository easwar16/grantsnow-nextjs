import "server-only";
import { cache } from "react";
import { z } from "zod";
import { authenticate } from "@/server/session/service";
import { requireModule, requireRead } from "@/server/permissions/policy";
import { oracle } from "@/server/api/transport";
import { AppError } from "@/lib/errors";
import { cleanAnnouncement } from "@/server/home/announcements";
export const eoiTabs = [
  "summary",
  "application",
  "attachments",
  "approvals",
  "delegation",
  "history",
  "dynamic-form-1",
  "dynamic-form-2",
  "dynamic-form-3",
  "dynamic-form-4",
  "dynamic-form-5",
] as const;
export const eoiRecordIdentity = z.object({
  id: z.string().regex(/^[1-9]\d{0,14}$/),
  tab: z.enum(eoiTabs),
});
export type EoiTab = (typeof eoiTabs)[number];
const roleSchema = z.object({
  items: z.array(z.object({ page_name: z.string(), read_access: z.string() })),
});
const detailsSchema = z.object({
  items: z.array(
    z.object({
      request_id: z.number().int().positive(),
      request_number: z.string(),
      request_type: z.literal("OPPORTUNITIES-EOI"),
      status: z.string().nullish(),
      status_code: z.string().nullish(),
      creation_date: z.string().nullish(),
      last_update_date: z.string().nullish(),
      ref_object_type: z.string().nullish(),
      ref_object_id: z.number().int().positive().nullish(),
      org_id: z.union([z.string(), z.number()]).nullish(),
    }),
  ),
});
export const eoiRecordContext = cache(async (id: string) => {
  if (!/^[1-9]\d{0,14}$/.test(id))
    throw new AppError("BAD_REQUEST", "Invalid application identity.", 400);
  const { session, user } = await authenticate();
  requireModule(user, "opportunities-eoi");
  const roles = roleSchema.parse(
    await oracle("getSecurityUser_roles", {
      token: session.token,
      p_obj_id: id,
      p_obj_type: "OPPORTUNITIES-EOI",
    }),
  ).items;
  const tabs = eoiTabs.filter((tab) =>
    roles.some(
      (r) =>
        r.page_name === `opportunities-eoi-${tab}` && r.read_access === "Y",
    ),
  );
  if (!tabs.length)
    throw new AppError(
      "FORBIDDEN",
      "Application read access has not been granted.",
      403,
    );
  return { session, roles, tabs };
});
export async function eoiRecordRead(id: string, tab: EoiTab) {
  const context = await eoiRecordContext(id);
  requireRead(context.roles, `opportunities-eoi-${tab}`);
  const b = detailsSchema.parse(
    await oracle("getDynamicFormsGetRequestDetails", {
      token: context.session.token,
      request_id: id,
    }),
  );
  const record = b.items[0];
  if (b.items.length !== 1 || String(record.request_id) !== id)
    throw new AppError("CONTRACT", "Oracle returned a different application.");
  return { ...context, record };
}
const rowsSchema = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
});
export interface EoiReadTable {
  columns: { key: string; label: string }[];
  rows: { id: string; values: Record<string, string> }[];
}
function table(
  raw: unknown,
  columns: EoiReadTable["columns"],
  identity: string,
): EoiReadTable {
  const b = rowsSchema.parse(raw);
  return {
    columns,
    rows: b.items.map((row, i) => ({
      id: `${row[identity] ?? i}:${i}`,
      values: Object.fromEntries(
        columns.map((c) => [
          c.key,
          typeof row[c.key] === "string" || typeof row[c.key] === "number"
            ? String(row[c.key])
            : "—",
        ]),
      ),
    })),
  };
}
export async function eoiRecordTable(
  id: string,
  tab: "attachments" | "approvals" | "delegation" | "history",
) {
  const { session, record } = await eoiRecordRead(id, tab);
  const headers = { token: session.token };
  if (tab === "attachments")
    return table(
      await oracle(
        "getPre_awardAttachmentsProposal_id",
        headers,
        new URLSearchParams({ p_obj_id: id, p_obj_type: "OPPORTUNITIES-EOI" }),
      ),
      [
        { key: "file_name", label: "File Name" },
        { key: "description", label: "Description" },
        { key: "document_type", label: "Document Type" },
        { key: "file_size", label: "File Size" },
        { key: "created_by_name", label: "Uploaded By" },
        { key: "creation_date", label: "Uploaded On" },
      ],
      "document_id",
    );
  if (tab === "approvals")
    return table(
      await oracle(
        "getApproval_setupApproval_stages",
        headers,
        new URLSearchParams({
          doc_num: record.request_number,
          doc_type: "OPPORTUNITIES-EOI",
        }),
      ),
      [
        { key: "level_name", label: "Stage" },
        { key: "level_desc", label: "Description" },
        { key: "approval_type", label: "Approval Type" },
        { key: "no_of_approval_req", label: "Required Approvals" },
        { key: "status", label: "Status" },
        { key: "remarks", label: "Remarks" },
      ],
      "stage_id",
    );
  if (tab === "delegation")
    return table(
      await oracle("getProposalDelegationsProposal_id", {
        ...headers,
        object_id: id,
        object_type: "OPPORTUNITIES-EOI",
      }),
      [
        { key: "pid", label: "Person ID" },
        { key: "page_desc", label: "Page" },
        { key: "read_access", label: "Read Access" },
        { key: "edit_access", label: "Edit Access" },
        { key: "start_date", label: "Start Date" },
        { key: "end_date", label: "End Date" },
      ],
      "id",
    );
  return table(
    await oracle("getSharedObjectStatus", {
      ...headers,
      p_obj_id: id,
      p_obj_type: "OPPORTUNITIES-EOI",
    }),
    [
      { key: "object_status", label: "Status" },
      { key: "status_process_mode", label: "Process Mode" },
      { key: "comments", label: "Comments" },
      { key: "created_by_name", label: "Created By" },
      { key: "creation_date", label: "Created On" },
    ],
    "creation_date",
  );
}
const formSchema = z.array(
  z.object({
    formId: z.number(),
    formName: z.string(),
    sections: z.array(
      z.object({
        sectionId: z.number(),
        sectionName: z.string(),
        isVisible: z.string(),
        sectionType: z.string(),
        fields: z
          .array(
            z.object({
              fieldId: z.number(),
              description: z.string(),
              isVisible: z.string(),
              fieldType: z.string(),
              options: z
                .array(
                  z.object({
                    optionId: z.union([z.string(), z.number()]),
                    optionValue: z.string(),
                  }),
                )
                .nullish(),
            }),
          )
          .optional(),
      }),
    ),
  }),
);
const valuesSchema = z.array(
  z.object({
    form_id: z.number(),
    sections: z.array(
      z.object({
        section_id: z.number(),
        fields: z.array(z.object({ field_id: z.number(), value: z.unknown() })),
      }),
    ),
  }),
);
export async function eoiRecordForms(
  id: string,
  tab: "application" | `dynamic-form-${1 | 2 | 3 | 4 | 5}`,
) {
  const { session } = await eoiRecordRead(id, tab);
  const formModule = `OPPORTUNITIES-EOI-${tab.toUpperCase()}`;
  const [definitions, responses] = await Promise.all([
    oracle("getProposalEthical_dynFormsP_ref_module", {
      token: session.token,
      p_id: id,
      p_obj_id: id,
      p_obj_type: "OPPORTUNITIES",
      p_ref_module: formModule,
    }),
    oracle("getProposalEthicaldynFormResponse", {
      P_TOKEN: session.token,
      P_REF_OBJ_ID: id,
      P_REF_MODULE: formModule,
    }),
  ]);
  const forms = formSchema.parse(definitions),
    values = valuesSchema.parse(responses);
  return forms.map((form) => ({
    id: String(form.formId),
    name: form.formName,
    sections: form.sections
      .filter((s) => s.isVisible === "Y")
      .map((section) => ({
        id: String(section.sectionId),
        name: section.sectionName,
        type: section.sectionType,
        fields: (section.fields || [])
          .filter((f) => f.isVisible === "Y")
          .map((field) => {
            const raw = values
              .find((v) => v.form_id === form.formId)
              ?.sections.find((s) => s.section_id === section.sectionId)
              ?.fields.find((f) => f.field_id === field.fieldId)?.value;
            const text =
              typeof raw === "string" || typeof raw === "number"
                ? String(raw)
                : Array.isArray(raw) &&
                    raw.every(
                      (v) => typeof v === "string" || typeof v === "number",
                    )
                  ? raw.join(", ")
                  : "—";
            return {
              id: String(field.fieldId),
              label: field.description,
              type: field.fieldType,
              value:
                field.options?.find((o) => String(o.optionId) === text)
                  ?.optionValue || text,
            };
          }),
      })),
  }));
}
export async function eoiSummary(id: string) {
  const { record, session } = await eoiRecordRead(id, "summary");
  let opportunity: { title: string; summary?: string } | undefined;
  if (record.ref_object_type === "OPPORTUNITIES" && record.ref_object_id) {
    const b = rowsSchema.parse(
      await oracle(
        "getSharedGetOpportunities",
        {
          token: session.token,
          p_order_by: "publication_date",
          p_sort_order: "DESC",
        },
        new URLSearchParams({
          p_where_clause: `("opportunities_id"='${record.ref_object_id}')`,
          p_offset: "0",
          p_limit: "1",
        }),
      ),
    );
    const r = b.items[0];
    if (
      r &&
      String(r.opportunities_id) === String(record.ref_object_id) &&
      typeof r.opp_heading === "string"
    )
      opportunity = {
        title: r.opp_heading,
        summary:
          typeof r.summary === "string"
            ? cleanAnnouncement(r.summary)
            : undefined,
      };
  }
  return {
    reference: record.request_number,
    status: record.status || undefined,
    created: record.creation_date || undefined,
    updated: record.last_update_date || undefined,
    opportunity,
  };
}
