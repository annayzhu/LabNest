// Package committed upstream source without editing the source checkout or its releases.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

const source = process.env.QPCR_PLANNER_SOURCE;
if (!source) throw new Error("Set QPCR_PLANNER_SOURCE to the maintained qPCR-Plate-Layout-Planner checkout with npm ci completed.");
const sourceRoot = path.resolve(source);
const commit = execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const staging = await mkdtemp(path.join(tmpdir(), "labnest-qpcr-bundle-"));
const destination = path.resolve("public/tools/qpcr-plate-layout");
const requireSource = createRequire(path.join(sourceRoot, "package.json"));
const JSZip = requireSource("jszip");

try {
  const archive = execFileSync("git", ["-C", sourceRoot, "archive", commit], { maxBuffer: 64 * 1024 * 1024 });
  execFileSync("tar", ["-xf", "-", "-C", staging], { input: archive });
  await symlink(path.join(sourceRoot, "node_modules"), path.join(staging, "node_modules"), "dir");
  execFileSync(process.execPath, ["scripts/build-portable.mjs"], { cwd: staging, stdio: "inherit" });
  execFileSync(process.execPath, ["--test", "tests/portable-html.test.mjs"], { cwd: staging, stdio: "inherit" });

  const portableRoot = path.join(staging, "outputs/portable");
  const [zipName] = (await readdir(portableRoot)).filter((name) => name.endsWith(".zip"));
  const zip = await JSZip.loadAsync(await readFile(path.join(portableRoot, zipName)));
  const entries = {
    "Open_qPCR_Plate_Layout_Planner.html": "index.html",
    "README_CN_EN.txt": "README_CN_EN.txt",
    "VERSION.txt": "VERSION.txt",
    "THIRD_PARTY_LICENSES.txt": "THIRD_PARTY_LICENSES.txt",
  };
  const files = {};
  await mkdir(destination, { recursive: true });
  for (const [input, output] of Object.entries(entries)) {
    let text = await zip.file(`qPCR_Plate_Layout_Planner_Portable/${input}`).async("string");
    // A git archive has no .git directory; restore the known source revision in its version file.
    if (input === "VERSION.txt") text = text.replace("uncommitted", commit);
    await writeFile(path.join(destination, output), text);
    files[output] = { sha256: createHash("sha256").update(text).digest("hex"), bytes: Buffer.byteLength(text) };
  }
  const lockfile = await readFile(path.join(staging, "package-lock.json"));
  await writeFile(path.join(destination, "release.json"), JSON.stringify({
    repository: "https://github.com/annayzhu/qPCR-Plate-Layout-Planner",
    commit,
    source: "git archive of the committed revision; uncommitted files excluded",
    build: "node scripts/build-portable.mjs",
    node: process.version,
    lockfileSha256: createHash("sha256").update(lockfile).digest("hex"),
    files,
  }, null, 2) + "\n");
  console.log(`Bundled qPCR planner ${commit} in ${destination}`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
