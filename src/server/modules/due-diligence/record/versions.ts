import "server-only";
import { z } from "zod";
import { applications } from "@/server/oracle/api";
import { dueDiligenceRecord } from "../record";

const rows = z.object({
  items: z.array(
    z.object({
      version: z.coerce.number().int().positive(),
      version_desc: z.string(),
    }),
  ),
});
export async function dueDiligenceVersions(id: string, access?: string) {
  const record = await dueDiligenceRecord(id, access);
  if (!record.tabs.includes("duediligence-responses")) return [];
  return rows
    .parse(await applications.versions({ id }))
    .items.sort((a, b) => b.version - a.version)
    .map((row) => ({ value: row.version, label: row.version_desc }));
}
