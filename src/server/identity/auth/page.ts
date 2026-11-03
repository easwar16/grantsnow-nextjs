import "server-only";
import { redirect } from "next/navigation";
import { authenticate } from "@/server/identity/session/service";
import { AppError } from "@/lib/errors";
import { functions } from "@/lib/functions";

export async function pageIdentity(returnTo: string) {
  try {
    return await authenticate();
  } catch (e) {
    if (e instanceof AppError && e.status === 401)
      redirect(
        `/login?reason=${e.code}&returnTo=${encodeURIComponent(functions.security.safeReturn(returnTo))}`,
      );
    throw e;
  }
}
