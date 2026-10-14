import "server-only";
import * as oidc from "openid-client";
import { oidcSettings } from "@/server/configuration/environment";
import { validateMetadata } from "./metadata";
let configuration: Promise<oidc.Configuration> | undefined;
export function idcs() {
  const settings = oidcSettings();
  configuration ??= (async () => {
    const response = await fetch(settings.discoveryUrl, {
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error("IDCS metadata could not be loaded.");
    const metadata = validateMetadata(await response.json(), settings);
    const authentication =
      settings.clientAuthMethod === "client_secret_basic"
        ? oidc.ClientSecretBasic(settings.clientSecret)
        : oidc.ClientSecretPost(settings.clientSecret);
    const config = new oidc.Configuration(
      metadata,
      settings.clientId,
      {
        client_secret: settings.clientSecret,
        token_endpoint_auth_method: settings.clientAuthMethod,
        id_token_signed_response_alg: "RS256",
      },
      authentication,
    );
    config.timeout = 15;
    oidc.enableNonRepudiationChecks(config);
    return config;
  })().catch((error) => {
    configuration = undefined;
    throw error;
  });
  return configuration;
}
