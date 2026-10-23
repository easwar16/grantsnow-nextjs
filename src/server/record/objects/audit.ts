import "server-only";
import { z } from "zod";
import { objects } from "@/server/oracle/api";
import { label, resources } from "@/server/platform/configuration/resources";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { dateTimeDisplay } from "@/lib/format";
import { idPart } from "@/lib/ids";
import { AppError } from "@/lib/errors";
import {
  AUDIT_EVENTS,
  type AuditEntry,
  type AuditView,
} from "@/features/record/objects/panel-types";
import { panelHost } from "./panels";

/**
 * The audit trail (each detail page's `getObjectAuditsSDP`): backend-written and read-only, one page of the record,
 * filtered by event on the server (`p_event`, empty for ALL as the tab chain sets it).
 */
const eventSchema = z.enum(AUDIT_EVENTS);

export async function auditView(q: URLSearchParams): Promise<AuditView> {
  const event = eventSchema.safeParse(q.get("event") ?? "ALL");
  if (!event.success)
    throw new AppError("BAD_REQUEST", "Invalid audit event.", 400);
  const [host, rows, format] = await Promise.all([
    panelHost(q, "read"),
    resources(),
    displayFormat(),
  ]);
  const audits = await objects.audits({
    objectType: host.objectType,
    objectId: host.objectId,
    page: host.page,
    event: event.data === "ALL" ? "" : event.data,
  });
  const seen = new Map<string, number>();
  const items = audits.map((a): AuditEntry => {
    // An entry has no id: its time and event name it, a repeat takes a count.
    const base = idPart(`${a.date_time}-${a.event}`);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return {
      key: n === 1 ? base : `${base}-${n}`,
      event: a.event,
      name: a.name,
      // Legacy shows date_time verbatim; the configured format applies where it parses.
      at: a.date_time ? dateTimeDisplay(a.date_time, format) : "",
      fields: (a.field_values ?? []).map((f) => ({
        name: f.field_name,
        value: f.field_value,
        old: f.old_value,
      })),
    };
  });
  return {
    items,
    // Legacy reads this from the proposal bundle on every host; the host's own bundle is the intent.
    noData: label(
      rows,
      host.bundle,
      "helper-texts",
      "eoi-no-data",
      "No data to display.",
    ),
  };
}
