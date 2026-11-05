import {
  cpSync,
  existsSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import { parseEnv } from "node:util";
const output =
  process.env.GRANTSNOW_BUILD_CHECK === "true" ? ".next-check" : ".next";
const destination = `${output}/standalone`;
if (!existsSync(`${destination}/server.js`))
  throw new Error("Standalone build is missing.");
mkdirSync(`${destination}/${output}`, { recursive: true });
cpSync(`${output}/static`, `${destination}/${output}/static`, {
  recursive: true,
});
if (existsSync("public"))
  cpSync("public", `${destination}/public`, { recursive: true });
// The environment this build targets: GRANTSNOW_ENV from the shell or build arg (blank counts as unset), else from `.env`.
const target =
  process.env.GRANTSNOW_ENV ||
  (existsSync(".env")
    ? parseEnv(readFileSync(".env", "utf8")).GRANTSNOW_ENV
    : undefined);
if (target) {
  if (!["dev", "demo", "uat", "stage", "prod"].includes(target))
    throw new Error(
      `GRANTSNOW_ENV must be dev, demo, uat, stage or prod, not "${target}".`,
    );
  if (!existsSync(`.env.${target}`))
    throw new Error(`GRANTSNOW_ENV=${target} but .env.${target} is missing.`);
  // The server loads .env.production beside server.js at start-up; variables set on the container still win.
  // .env.<env> also holds the secrets, which reach the container only at run time (deploy --env-file), so the image,
  // which goes to the registry, is baked without them.
  // Passwords, secrets and tokens, the ORDS clients and service user, the OIC user (see scripts/docker.sh secrets).
  const secretKey =
    /(?:SECRET|PASSWORD|BEARER|_USER|USERNAME|^ORDS_[A-Z]+_CLIENT_ID)$/;
  const secret = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=/;
  const baked = readFileSync(`.env.${target}`, "utf8")
    .split("\n")
    .filter((line) => !secretKey.test(line.match(secret)?.[1] ?? ""))
    .join("\n");
  const left = Object.keys(parseEnv(baked)).filter((key) =>
    secretKey.test(key),
  );
  if (left.length)
    throw new Error(
      `Secrets would be baked into the image: ${left.join(", ")}.`,
    );
  writeFileSync(`${destination}/.env.production`, baked);
  console.log(`Standalone build configured for ${target} (.env.${target}).`);
}
