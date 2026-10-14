import { cpSync, existsSync, mkdirSync } from "node:fs";
const destination = ".next/standalone";
if (!existsSync(`${destination}/server.js`))
  throw new Error("Standalone build is missing.");
mkdirSync(`${destination}/.next`, { recursive: true });
cpSync(".next/static", `${destination}/.next/static`, { recursive: true });
if (existsSync("public"))
  cpSync("public", `${destination}/public`, { recursive: true });
