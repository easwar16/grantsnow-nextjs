export class AppError extends Error {
  constructor(
    public code:
      | "UNAUTHENTICATED"
      | "EXPIRED"
      | "FORBIDDEN"
      | "BUSINESS"
      | "UPSTREAM"
      | "CONTRACT"
      | "BAD_REQUEST",
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}
export function publicError(error: unknown) {
  return error instanceof AppError
    ? { code: error.code, message: error.message, status: error.status }
    : {
        code: "UPSTREAM",
        message:
          "The service is unavailable. Please retry or contact your administrator.",
        status: 502,
      };
}
