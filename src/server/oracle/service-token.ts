import "server-only";
import { z } from "zod";

type Client = { id: string; secret: string };
type Held = { token: string; until: number };
const reply = z.object({
  access_token: z.string().min(1),
  expires_in: z.coerce.number().positive(),
});
// Route handlers and pages are separate module instances; one token per schema is shared through globalThis.
const held = ((
  globalThis as { __gnOrdsTokens?: Map<string, Promise<Held>> }
).__gnOrdsTokens ??= new Map());

/** A cached ORDS client-credentials token for one schema root, fetched once and renewed a minute before expiry. */
export async function serviceToken(root: URL, client: Client) {
  const key = `${root.href} ${client.id}`;
  const cached = held.get(key);
  if (cached) {
    const value = await cached.catch(() => undefined);
    if (value && value.until > Date.now()) return value.token;
    if (held.get(key) === cached) held.delete(key);
  }
  let pending = held.get(key);
  if (!pending) {
    pending = fetchToken(root, client);
    held.set(key, pending);
    pending.catch(() => held.get(key) === pending && held.delete(key));
  }
  return (await pending).token;
}

/** Forget a schema's token (Oracle answered 401), so the next call fetches a fresh one. */
export function dropServiceToken(root: URL, client: Client) {
  held.delete(`${root.href} ${client.id}`);
}

async function fetchToken(root: URL, client: Client): Promise<Held> {
  const response = await fetch(new URL("oauth/token", root), {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${client.id}:${client.secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new Error(`ORDS token request failed: HTTP ${response.status}.`);
  const { access_token, expires_in } = reply.parse(await response.json());
  return {
    token: access_token,
    until: Date.now() + Math.max(expires_in - 60, 0) * 1000,
  };
}
