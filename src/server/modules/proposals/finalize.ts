import { serverFunctions } from "@/server/functions";
import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { proposals } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import { loadAttributes } from "@/server/record/attributes/service";
import { attributeErrors } from "@/features/record/attributes/model";
import { proposalPage } from "./record";

const identity = z.object({
  type: z.enum([
    "PROPOSAL",
    "OUTLINE_PROPOSAL",
    "SUB_PROPOSAL",
    "EXTENSION_PROPOSAL",
  ]),
  id: z.string().regex(/^[1-9]\d{0,14}$/),
});
const request = z.object({ finalize: z.boolean() }).strict();
const status = z.object({
  status: z.string().nullish(),
  lock_module_id: z.number().int().nullish(),
});

export async function setProposalSummaryFinalized(
  type: string,
  id: string,
  raw: unknown,
) {
  const record = identity.parse({ type, id });
  const { finalize } = request.parse(raw);
  const context = await proposalPage(
    record.type,
    record.id,
    "proposals-summary",
  );
  const state = context.finalize;
  if (!state.visible || !state.editable || state.pageId === null)
    throw new AppError(
      "FORBIDDEN",
      "This Proposal Summary cannot be finalized.",
      403,
    );
  if (finalize) {
    // Legacy validates the primary and billing sponsor roles before finalizing Summary.
    const primary = context.summary.sponsors.filter(
      (s) => s.roleCode === "PRM",
    );
    const billing = context.summary.sponsors.filter((s) =>
      s.roleCode.startsWith("BIL"),
    );
    if (primary.length !== 1 || billing.length > 1)
      throw new AppError(
        "BAD_REQUEST",
        "Select one primary funder and at most one billing funder before finalizing.",
        400,
      );
    const rb = await resources();
    for (const field of [
      ...context.summary.piFields,
      ...context.summary.proposalFields,
    ]) {
      if (
        serverFunctions.resources.resourceRequired(
          rb,
          context.bundle,
          "labels",
          field.key,
          false,
        ) &&
        field.value.trim() === ""
      )
        throw new AppError(
          "BAD_REQUEST",
          `${field.label} is required before finalizing.`,
          400,
        );
    }
    if (record.type === "PROPOSAL") {
      const attributes = await loadAttributes({
        host: "proposals-summary",
        objectId: record.id,
      });
      if (
        attributes.visible &&
        Object.keys(
          attributeErrors(attributes.fields, context.summary.attributes, true),
        ).length > 0
      )
        throw new AppError(
          "BAD_REQUEST",
          "Complete the required attributes before finalizing.",
          400,
        );
    }
  }
  const current = status.parse(
    await proposals.lockStatus({
      type: record.type,
      id: record.id,
      pageId: state.pageId,
    }),
  );
  await proposals.setLock({
    body: {
      proposal_id: Number(record.id),
      created_by: context.session.token,
      status: finalize ? "FINALIZE" : "UNLOCK",
      page_id: state.pageId,
      id: current.lock_module_id ?? null,
      module_name: record.type,
    },
  });
  return { finalized: finalize };
}
