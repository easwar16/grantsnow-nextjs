import "server-only";
import { redirect } from "next/navigation";
import { authenticate } from "@/server/session/service";
import { AppError } from "@/lib/errors";
import { safeReturn } from "@/lib/security";
export async function pageIdentity(returnTo: string) {
  try {
    return await authenticate();
  } catch (e) {
    if (e instanceof AppError && e.status === 401)
      redirect(
        `/login?reason=${e.code}&returnTo=${encodeURIComponent(safeReturn(returnTo))}`,
      );
    throw e;
  }
}
