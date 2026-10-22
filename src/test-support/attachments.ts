import "server-only";
import { fixtureMode } from "@/server/configuration/environment";
/**
 * DEVELOPMENT FIXTURE ONLY: an in-memory attachments table for the file flow in fixture mode, where writes never
 * reach Oracle. The OIC fixture store (src/server/api/oic.ts) holds the bytes.
 */
interface Row {
  document_id: number;
  file_name: string;
  file_location: string;
  obj_ref_type: string;
  obj_ref_id: string;
  sec_obj_ref_type: string;
}
const rows: Row[] = [];
let next = 9000;
function guard() {
  if (!fixtureMode())
    throw new Error(
      "Fixture attachments cannot run outside explicit development mode.",
    );
}
export function fixtureAttachments(query?: URLSearchParams) {
  guard();
  return {
    items: rows.filter(
      (r) =>
        r.obj_ref_id === query?.get("p_obj_id") &&
        r.obj_ref_type === query?.get("p_obj_type") &&
        (query?.get("p_sec_obj_type") === null ||
          r.sec_obj_ref_type === query?.get("p_sec_obj_type")),
    ),
  };
}
export function recordFixtureAttachment(body: Record<string, unknown>) {
  guard();
  const row: Row = {
    document_id: ++next,
    file_name: String(body.file_name),
    file_location: String(body.file_location),
    obj_ref_type: String(body.obj_ref_type),
    obj_ref_id: String(body.obj_ref_id),
    sec_obj_ref_type: String(body.sec_obj_ref_type),
  };
  rows.push(row);
  return { attachment_id: row.document_id };
}
export function removeFixtureAttachment(id: string | undefined) {
  guard();
  const i = rows.findIndex((r) => String(r.document_id) === id);
  if (i >= 0) rows.splice(i, 1);
  return {};
}
