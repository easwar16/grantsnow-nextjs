"use client";
import {
  serializeQuery,
  type ProposalQuery,
} from "@/features/modules/proposals/schemas";
import type { ProposalPage } from "@/features/modules/proposals/types";
import { get } from "../http";

/** One listing page for the query (its `page` / `pageSize`); the server builds the where clause. */
export const page = (q: ProposalQuery, signal?: AbortSignal) =>
  get<ProposalPage>(
    "/proposals",
    Object.fromEntries(new URLSearchParams(serializeQuery(q))),
    signal,
  );
