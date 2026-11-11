// No imports: the API files that use this would otherwise import the client through roles.ts and form a cycle.
/**
 * The held reads that carry a record's rights or status (roles, the EOI request, the award): every write that can move
 * a record's status, rights or finalized pages drops them, so tabs and gates never show the old state.
 */
export const recordStateReads = [
  "getSecurityUser_roles",
  "getDynamicFormsGetRequestDetails",
  "getPost_awardsAwardDetails",
] as const;
