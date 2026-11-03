import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { ethics } from "@/server/oracle/api";
import { organizations } from "@/server/platform/configuration/service";
import { ethicsListView } from "./listing";

const rows = z.object({
  items: z.array(
    z.object({
      setup_flow_id: z.coerce.number().int().positive(),
      application_number: z.string(),
      setup_description: z.string().nullish(),
      status: z.string().nullish(),
      org_unit_id: z.coerce.number().int().positive(),
      org_unit_name: z.string().nullish(),
      parent_proposal_id: z.coerce.number().nullish(),
    }),
  ),
});
async function access() {
  const view = await ethicsListView();
  if (!view.actions.recycle || !view.tabs.length)
    throw new AppError(
      "FORBIDDEN",
      "Ethics recycle access has not been granted.",
      403,
    );
}
export async function deletedEthics() {
  await access();
  const [body, orgs] = await Promise.all([
    ethics.deleted(),
    organizations(),
  ]);
  const allowed = new Set(orgs.map((org) => String(org.id)));
  return rows
    .parse(body)
    .items.filter((row) => allowed.has(String(row.org_unit_id)))
    .map((row) => ({
      id: String(row.setup_flow_id),
      number: row.application_number,
      title: row.setup_description ?? "",
      status: row.status ?? "",
      org: row.org_unit_name ?? "",
      canRestore: !row.parent_proposal_id,
    }));
}
export async function restoreEthics(id: string) {
  const recordId = z.coerce.number().int().positive().parse(id);
  const found = (await deletedEthics()).find(
    (row) => row.id === String(recordId) && row.canRestore,
  );
  if (!found)
    throw new AppError(
      "FORBIDDEN",
      "Ethics application not found or access denied.",
      403,
    );
  await ethics.restore({ id: String(recordId) });
  return { restored: true };
}
