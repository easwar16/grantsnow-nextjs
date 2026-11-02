import {
  copyFileSync,
  cpSync,
  existsSync,
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
  copyFileSync(`.env.${target}`, `${destination}/.env.production`);
  console.log(`Standalone build configured for ${target} (.env.${target}).`);
}
