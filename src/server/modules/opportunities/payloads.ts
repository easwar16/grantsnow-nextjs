import "server-only";
import { z } from "zod";
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => !Number.isNaN(Date.parse(d)));
export const opener = z.enum(["finder", "dashboard"]);
export const bookmarkInput = z
  .object({ opportunityId: id, bookmarked: z.boolean() })
  .strict();
export const notesInput = z
  .object({ opportunityId: id, notes: z.string().max(100000) })
  .strict();
// The comment limit is RB-configured, so its maximum is checked by the service.
const comment = z.string().max(20000);
export const shareInput = z.discriminatedUnion("sendTo", [
  z
    .object({
      opportunityId: id,
      sendTo: z.literal("INDIVIDUAL"),
      personIds: z.array(id).min(1).max(500),
      comment,
    })
    .strict(),
  z
    .object({
      opportunityId: id,
      sendTo: z.enum(["ROLE", "GROUP"]),
      sendToValue: z.string().trim().min(1).max(200),
      comment,
    })
    .strict(),
]);
export type ShareInput = z.infer<typeof shareInput>;
/** Apply opens the new application: its Summary from a card, its form from More Info. */
export const applyInput = z
  .object({
    opportunityId: id,
    tab: z.enum(["summary", "application"]).default("summary"),
  })
  .strict();
export const convertInput = z
  .object({
    opener,
    kind: z.enum(["OUTLINE_PROPOSAL", "PROPOSAL"]),
    opportunityId: id,
    piId: id.nullable(),
    orgUnitId: id.nullable(),
    activityType: z.string().max(100).nullable(),
    stage: z.string().max(100).nullable(),
    start: isoDate.or(z.literal("")),
    end: isoDate.or(z.literal("")),
    sponsorId: id.nullable(),
    confidential: z.enum(["Y", "N"]),
    /** Set by the EOI record's convert (an approved application). */
    requestId: id.optional(),
  })
  .strict();
export type ConvertInput = z.infer<typeof convertInput>;
/** The 8516 share as VBCS sends it: people for INDIVIDUAL, otherwise the role or group; the unused key is left out. */
export function sharePayload(i: ShareInput) {
  const target =
    i.sendTo === "INDIVIDUAL"
      ? { pid: i.personIds }
      : { send_to_value: i.sendToValue };
  return [
    {
      obj_ref_id: i.opportunityId,
      business_event: "OPP_SHARE",
      send_to: i.sendTo,
      ...target,
      comments: i.comment.trim() || null,
    },
  ];
}
/** VBCS formatDeadlineDateToArray('SPNS', …): one sponsor deadline per comma-separated date. */
export function sponsorDeadlines(dates: string | null | undefined) {
  return (dates ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter((d) => d !== "")
    .map((d) => ({
      deadline_date: d.slice(0, 10),
      deadline_description: "",
      deadline_type: "SPNS",
    }));
}
/** The first sponsor whose name contains the opportunity's first funder (the original auto-match). */
export function matchSponsor(
  sponsors: { id: number; name: string }[],
  firstFunder: string | undefined,
) {
  const funder = firstFunder?.toLowerCase();
  return funder
    ? (sponsors.find((s) => s.name.toLowerCase().includes(funder)) ?? null)
    : null;
}
export interface ProposalPlan {
  kind: ConvertInput["kind"];
  opportunity: {
    id: number;
    heading: string;
    deadline?: string | null;
    closing?: string | null;
    call?: string | null;
    programme?: string | null;
  };
  pi: {
    personId: number;
    employeeNumber: string | null;
    orgUnitId: number | null;
  } | null;
  activityType: string | null;
  stage: string | null;
  start: string;
  end: string;
  sponsorId: number | null;
  confidential: "Y" | "N";
  createdBy: number;
  currency: string | null;
  /** The approved application converted (the EOI record's convert). */
  requestId?: number;
}
/** The convert's `{proposals}` body, an explicit pick (H1) as the VBCS opportunity convert chains build it. */
export function proposalPayload(p: ProposalPlan) {
  const o = p.opportunity;
  return {
    proposals: {
      proposal_title: o.heading,
      proposal_description: o.heading,
      proposal_status: "DRFT",
      enforce_deadline_y_n: o.closing ? "Y" : "N",
      converted_from_opp_id: o.id,
      proposal_deadlines: sponsorDeadlines(o.deadline || o.closing),
      is_confidential: p.confidential,
      activity_type: p.activityType,
      proposal_stage: p.stage,
      start_date: p.start,
      end_date: p.end,
      proposal_departments: p.pi
        ? [
            {
              exclude_pricing: "N",
              person_id: p.pi.personId,
              employee_number: p.pi.employeeNumber,
              org_unit_id: p.pi.orgUnitId,
              investigator_type: "PI",
            },
          ]
        : [],
      // sponsor_party_id spelled correctly: the VBCS `sponsor_party_idsponsor` typo warned on every match.
      proposal_sponsors: p.sponsorId
        ? [
            {
              prop_sponsors_rltn_id: null,
              sponsor_party_id: p.sponsorId,
              prop_sponsors_rltn_descr: "",
              sponsor_type: "PRM",
              sponsor_priority: 1,
            },
          ]
        : [],
      proposal_type: p.kind,
      created_by: p.createdBy,
      currency_code: p.currency,
      attribute_1: o.call ?? null,
      attribute_2: o.programme ?? null,
      ...(p.requestId !== undefined ? { request_id: p.requestId } : {}),
    },
  };
}
export const dynFormsSchema = z.array(
  z.object({
    formId: z.number(),
    sections: z
      .array(
        z.object({
          sectionId: z.number(),
          fields: z
            .array(
              z.object({
                fieldId: z.number(),
                fieldType: z.string().nullish(),
                defaultValue: z
                  .union([z.string(), z.number()])
                  .nullish()
                  .transform((v) =>
                    v === null || v === undefined ? null : String(v),
                  ),
              }),
            )
            .nullish(),
        }),
      )
      .nullish(),
  }),
);
/** VBCS prepareDynFormValueObj: each form's default response, field by field. */
export function defaultFormResponse(forms: z.infer<typeof dynFormsSchema>) {
  return forms.map((form) => ({
    form_id: form.formId,
    sections: (form.sections ?? []).map((section) => ({
      section_id: section.sectionId,
      fields: (section.fields ?? []).map((field) => ({
        field_id: field.fieldId,
        value:
          field.fieldType === "NUMERIC"
            ? field.defaultValue
              ? Number(field.defaultValue)
              : null
            : ["CHECKBOX", "COMBOBOXMANY", "CHECKLIST"].includes(
                  field.fieldType ?? "",
                )
              ? field.defaultValue
                ? field.defaultValue.split("~~")
                : []
              : (field.defaultValue ?? ""),
      })),
    })),
  }));
}
