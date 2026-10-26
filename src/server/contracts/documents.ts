import "server-only";
import ExcelJS from "exceljs";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { contractRead } from "@/server/oracle/api/contracts";
import { catalogue } from "@/server/oracle/api";
import { formGlobals } from "@/server/record/dynamic-form/globals";
import {
  fileNameProblem,
  requireStorage,
} from "@/server/record/attachments/service";
import { oicDownload } from "@/server/oic/connection";
import { contractActiveVersion, loadContract } from "./service";

const tag = z.object({
  column_name: z.string().max(200),
  column_tag: z.string().max(200),
  description: z.string().max(1000).nullish(),
});
const tags = z.object({ items: z.array(tag).max(10000) });
const template = z.object({
  file_name: z.string(),
  legal_id: z.union([z.string(), z.number()]),
});
const templates = z.union([z.object({ items: z.array(template) }), template]);
const folder = /^[A-Za-z0-9_-]{1,80}$/;

export type ContractDocumentKind = "tags" | "template" | "contract";

/** Downloads are derived from the scoped record and Oracle metadata, never a browser-supplied storage path. */
export async function contractDocument(id: string, kind: ContractDocumentKind) {
  const contract = await loadContract(id);
  if (kind === "tags") {
    const rows = tags.parse(await catalogue.contracts.getGetPlaceholderTags()).items;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Placeholder Variables");
    sheet.addRow(["column_name", "column_tag", "description"]);
    for (const item of rows)
      sheet.addRow([item.column_name, item.column_tag, item.description ?? ""]);
    const bytes = await workbook.xlsx.writeBuffer();
    return {
      bytes: new Uint8Array(bytes),
      fileName: "Placeholder Variables.xlsx",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  requireStorage();
  const instance = (await formGlobals()).instance;
  if (!instance)
    throw new AppError("UPSTREAM", "File storage is not configured.", 503);
  let fileName: string;
  let legalId: string;
  let group: "CONTRACT_TEMPLATE" | "CONTRACTS";
  if (kind === "template") {
    if (!contract.usesStandardTemplate || !contract.document.typeCode)
      throw new AppError(
        "BAD_REQUEST",
        "This Contract has no standard template.",
        400,
      );
    const raw = templates.parse(
      await contractRead("getContractsGetContractTemplateName", {
        contract_type: contract.document.typeCode,
        contract_level: contract.document.levelCode,
        template_id: contract.document.templateId,
      }),
    );
    const found = "items" in raw ? raw.items[0] : raw;
    if (!found)
      throw new AppError(
        "BAD_REQUEST",
        "No standard template is available.",
        404,
      );
    fileName = found.file_name;
    legalId = String(found.legal_id);
    group = "CONTRACT_TEMPLATE";
  } else {
    const active = await contractActiveVersion(id);
    if (!active?.name)
      throw new AppError(
        "BAD_REQUEST",
        "No Contract document is available.",
        404,
      );
    fileName = active.name;
    legalId = contract.document.legalId;
    group = "CONTRACTS";
  }
  if (!folder.test(legalId) || fileNameProblem(fileName))
    throw new AppError(
      "CONTRACT",
      "Oracle returned invalid document metadata.",
    );
  const { bytes } = await oicDownload(
    `${instance}/${legalId}/${group}/${fileName}`,
  );
  return {
    bytes,
    fileName,
    contentType:
      kind === "template"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : fileName.toLowerCase().endsWith(".pdf")
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
}
