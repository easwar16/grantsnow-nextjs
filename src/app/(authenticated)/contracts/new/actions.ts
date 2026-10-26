"use server";
import { canCreateContract } from "@/server/contracts/service";
import {
  contractAssignees,
  contractDependentChoices,
} from "@/server/contracts/lookups";
import { AppError } from "@/lib/errors";

export async function loadContractFormChoices(input: {
  contractType: string;
  relationType: string;
  orgId: string;
}) {
  if (!(await canCreateContract()))
    throw new AppError(
      "FORBIDDEN",
      "New Contract access has not been granted.",
      403,
    );
  return contractDependentChoices(input);
}

export async function loadContractAssignees() {
  if (!(await canCreateContract()))
    throw new AppError(
      "FORBIDDEN",
      "New Contract access has not been granted.",
      403,
    );
  return contractAssignees();
}
