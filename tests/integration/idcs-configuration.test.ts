import { beforeEach, afterEach, expect, it, vi } from "vitest";
const metadata = () => ({
  issuer: "https://identity.oraclecloud.com/",
  authorization_endpoint: "https://tenant.example.invalid/oauth2/v1/authorize",
  token_endpoint: "https://tenant.example.invalid/oauth2/v1/token",
  jwks_uri: "https://tenant.example.invalid/admin/v1/SigningCert/jwk",
  response_types_supported: ["code"],
  code_challenge_methods_supported: ["S256"],
  id_token_signing_alg_values_supported: ["RS256"],
  token_endpoint_auth_methods_supported: [
    "client_secret_basic",
    "client_secret_post",
  ],
});
beforeEach(() => {
  vi.resetModules();
  for (const [key, value] of Object.entries({
    IDCS_COMPATIBILITY_CONFIRMED: "true",
    IDCS_ISSUER: "https://identity.oraclecloud.com/",
    IDCS_DISCOVERY_URL:
      "https://tenant.example.invalid/.well-known/openid-configuration",
    IDCS_CLIENT_AUTH_METHOD: "client_secret_basic",
    IDCS_CLIENT_ID: "isolated-test-client",
    IDCS_CLIENT_SECRET: "isolated-test-secret",
    IDCS_SCOPES: "openid profile",
    IDCS_USERNAME_CLAIM: "preferred_username",
  }))
    vi.stubEnv(key, value);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("constructs the real OIDC library with approved tenant metadata and issuer", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(metadata()));
  vi.stubGlobal("fetch", fetch);
  const { idcs } = await import("@/server/auth/oidc");
  const config = await idcs();
  expect(config.serverMetadata().issuer).toBe(
    "https://identity.oraclecloud.com/",
  );
  expect(config.clientMetadata().client_id).toBe("isolated-test-client");
  expect(config.clientMetadata().id_token_signed_response_alg).toBe("RS256");
  expect(fetch.mock.calls[0][0].href).toBe(
    "https://tenant.example.invalid/.well-known/openid-configuration",
  );
  expect(fetch.mock.calls[0][1]).toMatchObject({
    cache: "no-store",
    redirect: "error",
  });
  await idcs();
  expect(fetch).toHaveBeenCalledOnce();
});
it("retries failed metadata requests instead of caching a rejected promise", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response("", { status: 502 }))
    .mockResolvedValueOnce(Response.json(metadata()));
  vi.stubGlobal("fetch", fetch);
  const { idcs } = await import("@/server/auth/oidc");
  await expect(idcs()).rejects.toThrow(/metadata/);
  await expect(idcs()).resolves.toBeDefined();
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("does not construct a configuration from substituted issuer metadata", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ ...metadata(), issuer: "https://evil.example/" }),
      ),
  );
  const { idcs } = await import("@/server/auth/oidc");
  await expect(idcs()).rejects.toThrow(/issuer/);
});
it("supports the explicitly registered client-secret-post method", async () => {
  vi.stubEnv("IDCS_CLIENT_AUTH_METHOD", "client_secret_post");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(metadata())));
  const { idcs } = await import("@/server/auth/oidc");
  const config = await idcs();
  expect(config.clientMetadata().token_endpoint_auth_method).toBe(
    "client_secret_post",
  );
});
