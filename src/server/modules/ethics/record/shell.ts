import "server-only";
import type { Resources } from "@/server/platform/configuration/resources";
import { serverFunctions } from "@/server/functions";
import type { EthicsRecord } from "../record";

const BUNDLE = "ethics";
type Row = [key: string, rb: string, fallback: string, value: string];

/**
 * The record's display model (legacy ethics-detail-page and its general overview): the panel and the
 * overview's fields, each shown only when its `labels.<key>` is visible; dates stay raw for the browser to format.
 */
export function ethicsShell(r: EthicsRecord, rows: Resources) {
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
    tabs: r.tabs.map((key) => ({
      key,
      name: t(
        "page-name",
        key,
        key === "ethics-general-overview"
          ? "General Overview"
          : key === "ethics-history"
            ? "History"
            : key === "ethics-attachments"
              ? "Attachments"
              : key === "ethics-responses"
                ? "Responses"
                : "Approvals",
      ),
    })),
    panel: cells([
      ["number", "ethics-detail-ethics-number", "Application Number", r.number],
      ["status", "ethics-detail-ethics-status", "Status", r.status],
      ["risk", "ethics-detail-ethics-risk", "Risk", r.risk],
      ["title", "ethics-detail-ethics-title", "Title", r.title],
      ["type", "ethics-detail-ethics-type", "Ethics Type", r.ethicsType],
      ["org", "ethics-detail-org-unit", "Org Unit", r.org],
      ["deadline", "ethics-detail-deadline-date", "Deadline Date", r.deadline],
    ]),
    fields: cells([
      ["title", "setup-project-title", "Title", r.title],
      ["type", "application-type", "Ethics Type", r.ethicsType],
      ["form-type", "form-type", "Form Type", r.formType],
      ["org", "org-unit", "Org Unit", r.org],
      ["deadline", "deadline-date", "Deadline Date", r.deadline],
      ["expiry", "expiry-date", "Expiry Date", r.expiry],
    ]),
    labels: {
      list: t("button-labels", "list", "List"),
      overview: t("page-name", "ethics-general-overview", "General Overview"),
      tabs: "Ethics pages",
    },
  };
}
export type EthicsShellModel = ReturnType<typeof ethicsShell>;
