import { expect, it } from "vitest";
import { validateMetadata } from "@/server/auth/metadata";
const expected = {
  issuer: new URL("https://identity.oraclecloud.com/"),
  endpointOrigin: "https://tenant.example.invalid",
  clientAuthMethod: "client_secret_basic",
};
const valid = () => ({
  issuer: expected.issuer.href,
  authorization_endpoint: `${expected.endpointOrigin}:443/oauth2/v1/authorize`,
  token_endpoint: `${expected.endpointOrigin}/oauth2/v1/token`,
  jwks_uri: `${expected.endpointOrigin}/admin/v1/SigningCert/jwk`,
  end_session_endpoint: `${expected.endpointOrigin}/oauth2/v1/userlogout`,
  response_types_supported: ["code"],
  code_challenge_methods_supported: ["S256"],
  id_token_signing_alg_values_supported: ["RS256"],
  token_endpoint_auth_methods_supported: [
    "client_secret_basic",
    "client_secret_post",
  ],
});
it("accepts tenant endpoints with the separately approved Oracle issuer", () => {
  expect(validateMetadata(valid(), expected).issuer).toBe(expected.issuer.href);
});
it("rejects metadata issuer substitution", () => {
  expect(() =>
    validateMetadata({ ...valid(), issuer: expected.endpointOrigin }, expected),
  ).toThrow(/issuer/);
});
it.each([
  "authorization_endpoint",
  "token_endpoint",
  "jwks_uri",
  "end_session_endpoint",
  "userinfo_endpoint",
])("rejects substituted %s origin", (key) => {
  expect(() =>
    validateMetadata(
      { ...valid(), [key]: "https://evil.example/endpoint" },
      expected,
    ),
  ).toThrow(/tenant/);
});
it.each([
  "http://tenant.example.invalid/token",
  "https://user:secret@tenant.example.invalid/token",
  "https://tenant.example.invalid/token#fragment",
])("rejects unsafe endpoint %s", (url) => {
  expect(() =>
    validateMetadata({ ...valid(), token_endpoint: url }, expected),
  ).toThrow();
});
it.each([
  "response_types_supported",
  "code_challenge_methods_supported",
  "id_token_signing_alg_values_supported",
  "token_endpoint_auth_methods_supported",
])("fails closed without %s", (key) => {
  expect(() => validateMetadata({ ...valid(), [key]: [] }, expected)).toThrow(
    /protections/,
  );
});
