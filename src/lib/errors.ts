export class AppError extends Error {
  constructor(
    public code:
      | "UNAUTHENTICATED"
      | "EXPIRED"
      | "FORBIDDEN"
      | "BUSINESS"
      | "UPSTREAM"
      | "CONTRACT"
      | "BAD_REQUEST"
      | "WRITES_DISABLED",
    message: string,
    public status = 502,
    /** Backend `preventive_action`, plain text, shown beside the message. */
    public action?: string,
  ) {
    super(message);
  }
}
