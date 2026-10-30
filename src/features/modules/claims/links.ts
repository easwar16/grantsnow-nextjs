/** A fund's record (legacy viewFundInquiry: appFundId), on its Summary tab. */
export function fundHref(appFundId: string) {
  return `/claims/funds-inquiry/${appFundId}/summary`;
}
