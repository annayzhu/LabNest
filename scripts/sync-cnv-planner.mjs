// Builds the CNV planner from its repository into public/tools/cnv-plate-layout and records what was built.
// Usage: node scripts/sync-cnv-planner.mjs <path to CNV-Assay-Plate-Layout-Planner>
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const source = process.argv[2];
if (!source) throw new Error("Give the path to the CNV-Assay-Plate-Layout-Planner repository");
const out = path.resolve("public/tools/cnv-plate-layout");
execFileSync(path.join(source, "node_modules/.bin/vite"), ["build", "--base", "./", "--outDir", out, "--emptyOutDir"], { cwd: source, stdio: "inherit" });

const hash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const walk = (dir) => readdirSync(dir).flatMap((name) => { const file = path.join(dir, name); return statSync(file).isDirectory() ? walk(file) : [file]; });
const git = (...args) => execFileSync("git", args, { cwd: source, encoding: "utf8" }).trim();
const files = Object.fromEntries(walk(out).map((file) => [path.relative(out, file), { sha256: hash(file), bytes: statSync(file).size }]));
writeFileSync(path.join(out, "release.json"), `${JSON.stringify({
  repository: "https://github.com/annayzhu/CNV-Assay-Plate-Layout-Planner",
  commit: git("rev-parse", "HEAD"),
  dirty: git("status", "--short") !== "",
  build: "vite build --base ./",
  lockfileSha256: hash(path.join(source, "package-lock.json")),
  files,
}, null, 2)}\n`);
