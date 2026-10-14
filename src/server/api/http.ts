import "server-only";
import { publicError } from "@/lib/errors";
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}
export function failure(e: unknown) {
  const error = publicError(e);
  return json(
    { error: { code: error.code, message: error.message } },
    error.status,
  );
}
