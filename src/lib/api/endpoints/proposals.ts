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
import { get } from "../http";
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
