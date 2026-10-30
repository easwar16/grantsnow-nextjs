"use client";
import {
  serializeQuery,
  type ProposalQuery,
} from "@/features/modules/proposals/schemas";
import type { ProposalPage } from "@/features/modules/proposals/types";
import type {
  ChoiceGroup,
  ChoiceGroupResult,
} from "@/features/modules/proposals/lookups";
import { apiUrl, get, post, OFFLINE, type ApiResult } from "../http";
import { endpoint } from "../hooks";
import { constants } from "@/lib/constants";

/** One of the listing's choice groups (held reference lists), read once the page shows. */
export const choices = endpoint<ChoiceGroup, ChoiceGroupResult>(
  (group) => ({ path: "/proposals/choices", query: { group } }),
  { ttl: constants.ttl.session },
);

/** One listing page for the query (its `page` / `pageSize`); the server builds the where clause. */
export const page = (q: ProposalQuery, signal?: AbortSignal) =>
  get<ProposalPage>(
    "/proposals",
    Object.fromEntries(new URLSearchParams(serializeQuery(q))),
    signal,
  );
export const setSummaryFinalized = (
  type: string,
  id: string,
  finalize: boolean,
) =>
  post<{ finalized: boolean }>(`/proposals/${type}/${id}/finalize`, {
    finalize,
  });
export const saveSummaryEdit = (
  type: string,
  id: string,
  input: {
    title: string;
    description: string;
    tags: string;
    opportunityTitle: string;
    opportunityUrl: string;
    activityType: string;
    proposalStage: string;
    proposalType: string;
    category: string;
    confidential: string;
    assignedTo: number | null;
    piPersonId?: number;
    startDate: string;
    endDate: string;
    costModel: number;
    version?: {
      newVersion: boolean;
      description: string;
      retainCosting: "RETAIN" | "NO_RETAIN" | null;
    };
    attributes?: Record<string, string | number | string[] | null>;
    deadlines?: {
      id: number | null;
      type: string;
      date: string | null;
      description: string;
    }[];
    sponsors?: {
      relationId: number | null;
      partyId: number;
      roleCode: string;
      priority: number;
    }[];
    collaboratorFlag?: "Y" | "N";
    collaborators?: {
      relationId: number | null;
      collaboratorId: number;
      roleCode: string;
      description: string;
      costingEnabled: boolean;
    }[];
    subprojectFlag?: "Y" | "N";
    subprojects?: {
      relationId: number | null;
      personId: number;
      orgUnitId: number;
      employeeNumber: string;
      typeCode: string;
      excludePricing: boolean;
    }[];
  },
) => post<{ saved: true }>(`/proposals/${type}/${id}/edit`, input);
export const ai = (type: string, id: string, kind: "summary" | "comparison") =>
  get<{ html: string }>(`/proposals/${type}/${id}/ai`, { kind });
export const costingAnalysis = (type: string, id: string, query: string) =>
  post<{
    rows: Record<string, string | number | boolean | null>[];
    chart: { name: string; types: string[] };
  }>(`/proposals/${type}/${id}/fec-summary`, { query });
export const viability = (type: string, id: string) =>
  get<{ columns: string[]; rows: Record<string, string>[] }>(
    `/proposals/${type}/${id}/budget/viability`,
  );
export const quickCostOptions = (type: string, id: string, kind: string) =>
  get<{
    versionId: number;
    sections: { value: string; label: string }[];
    roles: { value: string; label: string }[];
    categories: { value: string; label: string }[];
    items: { category: string; value: string; label: string }[];
    people: { value: string; label: string }[];
  }>(`/proposals/${type}/${id}/budget/quick-cost`, { kind });
export const saveQuickCost = (
  type: string,
  id: string,
  input: {
    kind:
      | "quick"
      | "staff"
      | "student"
      | "pool-tech"
      | "non-staff"
      | "research-partner";
    versionId: number;
    rows: {
      section: string;
      category: string;
      item: string;
      description: string;
      personId: number | null;
      startDate: string;
      endDate: string;
      units: number;
      cost: number | null;
    }[];
  },
) =>
  post<{ saved: boolean }>(`/proposals/${type}/${id}/budget/quick-cost`, input);

export async function printReport(
  type: string,
  id: string,
  code: string,
  currency: string,
): Promise<ApiResult<{ blob: Blob; filename: string }>> {
  try {
    const response = await fetch(apiUrl(`/proposals/${type}/${id}/print`), {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, currency }),
    });
    if (response.ok) {
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename =
        /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? "report.pdf";
      return { ok: true, data: { blob: await response.blob(), filename } };
    }
    const body = await response.json();
    return { ok: false, error: body.error ?? OFFLINE };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

export interface StaffContact {
  fullName: string;
  employeeNumber: string;
  email: string;
  orgUnit: string;
  position: string;
  school: string;
  address: string;
}

export const staffContact = endpoint<
  { type: string; id: string; costHeaderId: string; versionId: number | null },
  StaffContact
>((p) => ({
  path: `/proposals/${p.type}/${p.id}/budget/staff/${p.costHeaderId}/contact`,
  query: p.versionId ? { version: p.versionId } : undefined,
}));
