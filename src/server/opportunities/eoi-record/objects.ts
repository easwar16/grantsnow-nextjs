import "server-only";
import type { HistoryHost } from "@/server/objects/history";
import type { DelegationHost } from "@/server/objects/delegations";
import { eoiRecordRead } from "../record";
import { EOI_MODULE, pageOf } from "./model";
const BUNDLE = "opportunities-eoi";
/** The label keys the EOI history host passes (opportunities-eoi-history-start-page.html:26-47). */
const HISTORY_KEYS: HistoryHost["keys"] = {
  title: ["header-labels", "EOI-status-history"],
  status: ["table-headers", "history-eoi-status"],
  approvalTitle: ["header-labels", "approval-history"],
  approvalName: ["table-headers", "approval-full-name"],
  approvalStatus: ["table-headers", "approval-history-status"],
  approvalStage: ["table-headers", "approval-history-stage"],
  approvalNoData: ["helper-texts", "no-data"],
  statusLabel: ["labels", "history-AOI-status"],
  cancel: ["button-labels", "history-status-cancel"],
  save: ["button-labels", "history-status-save"],
};
/**
 * The History tab as a history host: Add Status and Abandon need edit on their button keys (the host's checkAccess,
 * fail closed); the type is the request's own (`AOIData.request_type`), the transaction its number.
 */
export async function eoiHistoryHost(id: string): Promise<HistoryHost> {
  const { session, user, request, access } = await eoiRecordRead(id, "history");
  const edit = (key: string) => access.roles.get(key)?.edit === true;
  return {
    token: session.token,
    user,
    objectType: request.request_type,
    objectId: id,
    objectNumber: request.request_number,
    approvalType: EOI_MODULE,
    bundle: BUNDLE,
    statusLookup: "PROPOSAL_STATUS",
    statusCode: request.status_code ?? null,
    rights: {
      addStatus: edit("opportunities-eoi-history-add-status"),
      abandon: edit("opportunities-eoi-history-abandon-button"),
    },
    keys: HISTORY_KEYS,
  };
}
/** The Delegation tab as a delegations host; rights are the tab's own page (legacy read `proposals-delegation`). */
export async function eoiDelegationHost(id: string): Promise<DelegationHost> {
  const { session, user, access } = await eoiRecordRead(id, "delegation");
  const rights = access.roles.get(pageOf("delegation"));
  return {
    token: session.token,
    user,
    objectType: EOI_MODULE,
    objectId: id,
    bundle: BUNDLE,
    defaultPage: pageOf("summary"),
    rights: { edit: rights?.edit === true, delete: rights?.delete === true },
  };
}
