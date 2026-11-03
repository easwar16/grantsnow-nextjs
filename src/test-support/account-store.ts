import "server-only";
import { fixtureMode } from "@/server/platform/configuration/environment";
import { AppError } from "@/lib/errors";
const data = new Map<string, Record<string, unknown>>();
export function fixtureSettings(path: string, body?: Record<string, unknown>) {
  if (!fixtureMode())
    throw new AppError("FORBIDDEN", "Fixture settings are disabled.", 403);
  if (body) data.set(path, body);
  return data.get(path);
}
