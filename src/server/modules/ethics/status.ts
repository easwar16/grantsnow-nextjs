import "server-only";
import { globalVariables } from "@/server/platform/configuration/formatting";

/** VBCS fetchGlobalMetadata assigns EDITABLE_STATUS as a comma-separated list. */
export async function ethicsEditableStatus(status: string) {
  if (!status) return false;
  const globals = await globalVariables();
  const configured = globals.find((row) => row.var_key === "EDITABLE_STATUS")?.var_value;
  const statuses = typeof configured === "string" && configured.trim()
    ? configured.split(",").map((part) => part.trim())
    : ["DRFT"];
  return statuses.includes(status);
}
