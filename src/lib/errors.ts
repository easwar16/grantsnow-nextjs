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
export function publicError(error: unknown): {
  code: string;
  message: string;
  status: number;
  action?: string;
} {
  if (!(error instanceof AppError))
    return {
      code: "UPSTREAM",
      message:
        "The service is unavailable. Please retry or contact your administrator.",
      status: 502,
    };
  const { code, message, status, action } = error;
  return action ? { code, message, status, action } : { code, message, status };
}
