import { ZodError } from "zod";
import {
  accountData,
  saveAccount,
  proxyPeople,
} from "@/server/account/service";
import { json, failure } from "@/server/api/http";
import { sameOrigin } from "@/lib/security";
import { appOrigin } from "@/server/configuration/environment";
import { AppError } from "@/lib/errors";
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const org = query.get("organization");
    const panel = query.get("panel") || "profile";
    if (!["profile", "preferences", "accessibility"].includes(panel))
      throw new AppError("BAD_REQUEST", "Unknown settings panel.", 400);
    return json(org ? await proxyPeople(org) : await accountData(panel));
  } catch (e) {
    return failure(
      e instanceof ZodError
        ? new AppError("BAD_REQUEST", "Invalid settings values.", 400)
        : e,
    );
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request, appOrigin());
    const reader = request.body?.getReader();
    if (!reader)
      throw new AppError("BAD_REQUEST", "Empty settings request.", 400);
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.length;
      if (bytes > 32768) {
        await reader.cancel();
        throw new AppError(
          "BAD_REQUEST",
          "Settings request is too large.",
          400,
        );
      }
      chunks.push(part.value);
    }
    const all = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      all.set(chunk, offset);
      offset += chunk.length;
    }
    let body: { kind?: string; changes?: unknown };
    try {
      body = JSON.parse(new TextDecoder().decode(all));
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid settings request.", 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new AppError("BAD_REQUEST", "Invalid settings request.", 400);
    if (Object.keys(body).some((k) => !["kind", "changes"].includes(k)))
      throw new AppError("BAD_REQUEST", "Unknown settings field.", 400);
    await saveAccount(body.kind || "", body.changes);
    return json({ saved: true });
  } catch (e) {
    return failure(
      e instanceof ZodError
        ? new AppError("BAD_REQUEST", "Invalid settings values.", 400)
        : e,
    );
  }
}
