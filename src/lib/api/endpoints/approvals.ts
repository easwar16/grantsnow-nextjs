"use client";
import type {
  AddStageSetup,
  ApprovalTreeNode,
  Choice,
  PersonChoice,
  StageUsers,
  WorkflowHistory,
} from "@/features/record/approvals/types";
import { apiUrl, post } from "../http";
import { endpoint } from "../hooks";
import { constants } from "@/lib/constants";

/**
 * A host's approval workflow route: `api` is that route's path under `/api` (e.g. `/opportunities/eoi/12/workflow`),
 * which reads its dialogs by `view` and takes every route write as one POST.
 */
// Reference lists the approval dialogs share (people, the Add Stage choices, approval groups).
/** One stage's approvers and what may change on it. */
export const stageUsers = endpoint<{ api: string; stage: string }, StageUsers>(
  (p) => ({ path: p.api, query: { view: "users", stage: p.stage } }),
);
/** Every held stage-approvers read of the route (the store keys sort `stage` before `view`). */
export const stageUsersKeys = (api: string) => `${apiUrl(api)}?stage=`;
/** The person directory approvers are chosen from. */
export const people = endpoint<string, PersonChoice[]>(
  (api) => ({ path: api, query: { view: "people" } }),
  { ttl: constants.ttl.reference },
);
/** The Add Stage dialog's choices and field gates. */
export const setup = endpoint<string, AddStageSetup>(
  (api) => ({ path: api, query: { view: "setup" } }),
  { ttl: constants.ttl.reference },
);
/** The groups of one approval group type. */
export const groups = endpoint<{ api: string; type: string }, Choice[]>(
  (p) => ({ path: p.api, query: { view: "groups", type: p.type } }),
  { ttl: constants.ttl.reference },
);
/** The route's history table, read beside the route so neither waits for the other. */
export const history = endpoint<string, WorkflowHistory>((api) => ({
  path: api,
  query: { view: "history" },
}));
/** The route as a tree, read when Graph View opens. */
export const graph = endpoint<string, ApprovalTreeNode>((api) => ({
  path: api,
  query: { view: "graph" },
}));
/** WRITES one change to the route; `body` is the route's own request (`op` and its fields). */
export const write = (api: string, body: unknown) =>
  post<{ message?: string }>(api, body);
