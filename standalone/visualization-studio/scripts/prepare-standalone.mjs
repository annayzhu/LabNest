import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const standaloneRoot = resolve(projectRoot, ".next/standalone");

if (!existsSync(resolve(standaloneRoot, "server.js"))) {
  throw new Error("The Next.js standalone server was not generated. Confirm output: 'standalone' in next.config.ts.");
}

mkdirSync(resolve(standaloneRoot, ".next"), { recursive: true });
cpSync(resolve(projectRoot, ".next/static"), resolve(standaloneRoot, ".next/static"), { recursive: true, force: true });

const publicDirectory = resolve(projectRoot, "public");
if (existsSync(publicDirectory)) {
  cpSync(publicDirectory, resolve(standaloneRoot, "public"), { recursive: true, force: true });
}

console.log("Prepared .next/standalone with static assets.");
