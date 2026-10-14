import { cpSync, existsSync, mkdirSync } from "node:fs";
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
