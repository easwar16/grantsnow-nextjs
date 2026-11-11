import "server-only";
import { z } from "zod";
import { applications } from "@/server/oracle/api";
import { ethicsRecord } from "../record";

const rows = z.object({
  items: z.array(
    z.object({
      version: z.coerce.number().int().positive(),
      version_desc: z.string(),
    }),
  ),
});
export async function ethicsVersions(id: string, access?: string) {
  await ethicsRecord(id, access);
  return rows
    .parse(await applications.versions({ id }))
    .items.sort((a, b) => b.version - a.version)
    .map((row) => ({ value: row.version, label: row.version_desc }));
}
