import "server-only";
import type { Resources } from "@/server/platform/configuration/resources";
import { serverFunctions } from "@/server/functions";
import type { DueDiligenceRecord } from "../record";

const BUNDLE = "due_diligence";
type Row = [key: string, rb: string, fallback: string, value: string];

/**
 * The record's display model (legacy duediligence-detail-page and its general overview): the panel and the
 * overview's fields, each shown only when its `labels.<key>` is visible; dates stay raw for the browser to format.
 */
export function dueDiligenceShell(r: DueDiligenceRecord, rows: Resources) {
  const t = (group: string, key: string, fallback: string) =>
    serverFunctions.resources.label(rows, BUNDLE, group, key, fallback);
  const shown = (key: string) =>
    serverFunctions.resources.resourceVisible(rows, BUNDLE, "labels", key);
  const cells = (list: Row[]) =>
    list
      .filter(([, rb]) => shown(rb))
      .map(([key, rb, fallback, value]) => ({
        key,
        label: t("labels", rb, fallback),
        value,
        date: ["deadline", "expiry"].includes(key),
      }));
  return {
    id: r.id,
    access: r.access,
    statusCode: r.statusCode,
    canEditSetup:
      r.rights["duediligence-general-overview"]?.edit === true &&
      (r.statusCode === "DRFT" ||
        (r.rights["due-diligence-change-setup"]?.edit === true &&
          r.respondents.every((row) => row.statusCode === "DRFT"))),
    tabs: r.tabs.map((key) => ({
      key,
      name: t(
        "page-name",
        key,
        key === "duediligence-general-overview"
          ? "Setup"
          : key === "duediligence-history"
            ? "History"
            : key === "duediligence-attachments"
              ? "Attachments"
              : key === "duediligence-responses"
                ? "Responses"
                : "Approvals",
      ),
    })),
    panel: cells([
      [
        "number",
        "dd-detail-due-diligence-number",
        "Application Number",
        r.number,
      ],
      ["status", "due-diligence-status", "Status", r.status],
      ["risk", "dd-detail-due-diligence-risk", "Risk", r.risk],
      ["title", "dd-detail-due-diligence-title", "Title", r.title],
      [
        "type",
        "dd-detail-due-diligence-type",
        "Due Diligence Type",
        r.dueDiligenceType,
      ],
      ["org", "dd-detail-org-unit", "Org Unit", r.org],
      ["deadline", "dd-detail-deadline-date", "Deadline Date", r.deadline],
    ]),
    fields: cells([
      ["title", "dd-project-title", "Title", r.title],
      ["type", "application-type", "Due Diligence Type", r.dueDiligenceType],
      ["form-type", "form-type", "Form Type", r.formType],
      ["org", "org-unit", "Org Unit", r.org],
      ["deadline", "deadline-date", "Deadline Date", r.deadline],
      ["expiry", "expiry-date", "Expiry Date", r.expiry],
      ["supervisor", "supervisor", "Supervisor", r.supervisor],
    ]),
    participants: shown("participants")
      ? {
          label: t("labels", "participants", "Participants"),
          people: r.respondents,
        }
      : null,
    labels: {
      list: t("button-labels", "list", "List"),
      overview: t("page-name", "duediligence-general-overview", "Setup"),
      comments: t("button-labels", "comments", "Comments"),
      audit: serverFunctions.resources.resourceVisible(
        rows,
        BUNDLE,
        "button-labels",
        "openAuditTrail",
      )
        ? t("button-labels", "openAuditTrail", "Audit Trail")
        : null,
      auditTitle: t("header-labels", "audit-trail", "Audit Trail"),
      close: t("button-labels", "dd-detail-close", "Close"),
      tabs: t("labels", "dd-pages", "Due Diligence pages"),
      print: t("button-labels", "print", "Print"),
      editSetup: t("button-labels", "edit-setup", "Edit setup"),
      submit: t("button-labels", "submit-for-approval", "Submit for Approval"),
      finalize: t("labels", "finalize", "Finalize"),
      finalized: t("labels", "finalized", "Finalized"),
    },
    referenceLink: {
      link: t("button-labels", "dd-detail-link", "Link"),
      title: t("dialog-titles", "reference-link-to", "Link to reference"),
      type: t("labels", "reference-type", "Reference type"),
      number: t("labels", "reference-id", "Reference number"),
      cancel: t("button-labels", "cancel", "Cancel"),
      submit: t("button-labels", "submit", "Submit"),
    },
    responses: {
      title: t("page-name", "duediligence-responses", "Responses"),
      participants: t("labels", "participants", "Participants"),
      version: t("labels", "responses-version", "Version"),
      edit: t("button-labels", "responses-edit", "Edit response"),
      cancel: t("button-labels", "responses-cancel", "Cancel"),
      save: t("button-labels", "responses-save", "Save response"),
      saved: t("messages", "responses-saved", "Response saved."),
    },
  };
}
export type DueDiligenceShellModel = ReturnType<typeof dueDiligenceShell>;
