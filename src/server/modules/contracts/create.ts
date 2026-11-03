import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { canCreateContract } from "./service";
import { contractAssignees, contractDependentChoices } from "./lookups";

async function requireCreate() {
  if (!(await canCreateContract()))
    throw new AppError(
      "FORBIDDEN",
      "New Contract access has not been granted.",
      403,
    );
}
const code = z.string().max(80).default("");
const choicesQuery = z.object({
  contractType: code,
  relationType: code,
  orgId: z
    .string()
    .regex(/^\d{0,15}$/)
    .default(""),
});
/** New Contract's template and relation-item choices for the picked type, relation and org unit. */
export async function newContractChoices(q: URLSearchParams) {
  await requireCreate();
  const input = choicesQuery.safeParse(Object.fromEntries(q));
  if (!input.success)
    throw new AppError("BAD_REQUEST", "Invalid contract choices request.", 400);
  return contractDependentChoices(input.data);
}
/** New Contract's Assigned To people. */
export async function newContractAssignees() {
  await requireCreate();
  return contractAssignees();
}
