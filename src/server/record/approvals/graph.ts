import "server-only";
import { AppError } from "@/lib/errors";
import type { ApprovalTreeNode } from "@/features/record/approvals/types";

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const display = (value: unknown) =>
  typeof value === "string" || typeof value === "number"
    ? String(value).slice(0, 300)
    : "";

/** Map the VBCS Treant response without passing backend HTML, chart config or identities to the browser. */
export function mapApprovalGraph(raw: unknown, documentNumber: string) {
  const response = record(raw);
  const chart = record(response?.chart);
  const structure = response?.nodeStructure ?? chart?.nodeStructure;
  if (!structure)
    throw new AppError(
      "CONTRACT",
      "Oracle returned an invalid approval graph.",
    );

  let count = 0;
  const node = (value: unknown, depth: number): ApprovalTreeNode => {
    const source = record(value);
    if (!source || depth > 16 || ++count > 100)
      throw new AppError(
        "CONTRACT",
        "Oracle returned an invalid approval graph.",
      );
    const text = record(source.text);
    const data = record(source.data);
    if (
      data?.approval_number != null &&
      String(data.approval_number) !== documentNumber
    )
      throw new AppError(
        "FORBIDDEN",
        "Oracle returned another record's approval graph.",
        403,
      );
    const children = source.children ?? [];
    if (!Array.isArray(children))
      throw new AppError(
        "CONTRACT",
        "Oracle returned an invalid approval graph.",
      );
    return {
      name: display(text?.name),
      title: display(text?.title),
      contact: display(text?.contact),
      status: display(data?.status),
      children: children.map((child) => node(child, depth + 1)),
    };
  };

  if (Array.isArray(structure))
    return {
      name: "Approval Workflow",
      title: "Start",
      contact: "",
      status: "",
      children: structure.map((child) => node(child, 1)),
    } satisfies ApprovalTreeNode;
  return node(structure, 0);
}
