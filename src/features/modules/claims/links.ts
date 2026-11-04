/** A fund's record (legacy viewFundInquiry: appFundId), on its Summary tab. */
export function fundHref(appFundId: string) {
  return `/claims/funds-inquiry/${appFundId}/summary`;
}
/** A unit application's record (legacy viewClaimInquiry: appId), on its Summary tab. */
export function unitHref(appId: string) {
  return `/claims/unit-inquiry/${appId}/summary`;
}
