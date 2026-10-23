import { z } from "zod";
export const recordIdentity = z.object({
  type: z.enum([
    "PROPOSAL",
    "OUTLINE_PROPOSAL",
    "SUB_PROPOSAL",
    "EXTENSION_PROPOSAL",
  ]),
  id: z.string().regex(/^[1-9]\d{0,14}$/),
});
export type RecordIdentity = z.infer<typeof recordIdentity>;
export interface SummaryField {
  key: string;
  label: string;
  value: string;
  kind: "text" | "date";
}
export interface ProposalSummary {
  id: string;
  type: string;
  reference: string;
  title: string;
  status: string;
  fields: SummaryField[];
}
