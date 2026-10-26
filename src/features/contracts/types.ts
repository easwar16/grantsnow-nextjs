import type { ContractQuery } from "./schema";
export interface ContractRow {
  id: string;
  number: string;
  title: string;
  status: string;
  statusCode: string;
  type: string;
  level: string;
  reference: string;
  start: string;
  end: string;
  created: string;
  updated: string;
  deadline: string;
  organization: string;
  assignedTo: string;
}
export interface ContractPage {
  rows: ContractRow[];
  offset: number;
  hasMore: boolean;
  total?: number;
  query: ContractQuery;
}
export interface ContractDetail extends ContractRow {
  document: {
    typeCode: string;
    levelCode: string;
    templateId: string;
    legalId: string;
  };
  createdBy: string;
  updatedBy: string;
  fields: { label: string; value: string; kind: "date" | "text" }[];
  deadlines: {
    type: string;
    description: string;
    date: string;
    reminderDays: string;
  }[];
  usesStandardTemplate: boolean | null;
}
