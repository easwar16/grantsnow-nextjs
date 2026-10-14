import "server-only";
import { z } from "zod";
const metadataSchema = z.object({
  issuer: z.string(),
  authorization_endpoint: z.string().url(),
  token_endpoint: z.string().url(),
  jwks_uri: z.string().url(),
  end_session_endpoint: z.string().url().optional(),
  userinfo_endpoint: z.string().url().optional(),
  response_types_supported: z.array(z.string()),
  code_challenge_methods_supported: z.array(z.string()),
  id_token_signing_alg_values_supported: z.array(z.string()),
  token_endpoint_auth_methods_supported: z.array(z.string()),
});
export function validateMetadata(
  raw: unknown,
  expected: { issuer: URL; endpointOrigin: string; clientAuthMethod: string },
) {
  const metadata = metadataSchema.parse(raw);
  if (metadata.issuer !== expected.issuer.href)
    throw new Error("IDCS metadata issuer differs from the approved issuer.");
  for (const key of [
    "authorization_endpoint",
    "token_endpoint",
    "jwks_uri",
    "end_session_endpoint",
    "userinfo_endpoint",
  ] as const) {
    const value = metadata[key];
    if (!value) continue;
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.origin !== expected.endpointOrigin ||
      url.username ||
      url.password ||
      url.hash
    )
      throw new Error("IDCS metadata endpoint is outside the approved tenant.");
  }
  if (
    !metadata.response_types_supported.includes("code") ||
    !metadata.code_challenge_methods_supported.includes("S256") ||
    !metadata.id_token_signing_alg_values_supported.includes("RS256") ||
    !metadata.token_endpoint_auth_methods_supported.includes(
      expected.clientAuthMethod,
    )
  )
    throw new Error(
      "IDCS metadata does not support the required client protections.",
    );
  return metadata;
}
