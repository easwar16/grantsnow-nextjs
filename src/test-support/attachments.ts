import "server-only";
import { fixtureMode } from "@/server/platform/configuration/environment";
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
  description: string;
  document_type: string;
  file_size: string;
  created_by_name: string;
  creation_date: string;
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
    description: String(body.description ?? ""),
    document_type: String(body.document_type ?? ""),
    file_size: String(body.file_size ?? ""),
    created_by_name: "Fixture User",
    creation_date: new Date().toISOString(),
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
/** The record's external links (getPre_awardLinks / postPre_awardLinks / deletePre_awardLinks), in memory. */
interface Link {
  link_id: number;
  link_title: string;
  link_url: string;
  obj_ref_id: string;
  obj_ref_type: string;
  is_confidential: string;
}
const links: Link[] = [];
export function fixtureLinks(query?: URLSearchParams) {
  guard();
  return {
    items: links.filter(
      (l) =>
        l.obj_ref_id === query?.get("p_obj_id") &&
        l.obj_ref_type === query?.get("p_obj_type"),
    ),
  };
}
export function recordFixtureLink(body: Record<string, unknown>) {
  guard();
  const link: Link = {
    link_id: ++next,
    link_title: String(body.link_title),
    link_url: String(body.link_url),
    obj_ref_id: String(body.obj_ref_id),
    obj_ref_type: String(body.obj_ref_type),
    is_confidential: String(body.is_confidential ?? "N"),
  };
  links.push(link);
  return { link_id: link.link_id };
}
export function removeFixtureLink(id: number) {
  guard();
  const i = links.findIndex((l) => l.link_id === id);
  if (i >= 0) links.splice(i, 1);
  return {};
}
