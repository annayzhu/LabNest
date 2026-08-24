import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { once } from "node:events";

const projectRoot = process.cwd();
const requiredFiles = JSON.parse(readFileSync(resolve(projectRoot, ".next/required-server-files.json"), "utf8"));
const basePath = requiredFiles.config?.basePath ?? "";

if (!basePath) {
  throw new Error("Deployment smoke requires a build-time basePath so prefixed assets are exercised.");
}

const port = 33119;
const origin = `http://127.0.0.1:${port}`;
const output = [];
const server = spawn(process.execPath, [resolve(projectRoot, ".next/standalone/server.js")], {
  cwd: projectRoot,
  env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

server.stdout.on("data", (chunk) => output.push(chunk.toString()));
server.stderr.on("data", (chunk) => output.push(chunk.toString()));

async function fetchWhenReady(url) {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.ok) return response;
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw lastError ?? new Error(`Timed out requesting ${url}`);
}

try {
  const pageResponse = await fetchWhenReady(`${origin}${basePath}/`);
  if (pageResponse.url !== `${origin}${basePath}/`) throw new Error(`Unexpected canonical page URL: ${pageResponse.url}`);
  const html = await pageResponse.text();
  if (!html.includes("Visualization Studio")) throw new Error("Standalone HTML is missing the application title.");

  const assetPaths = [...html.matchAll(/(?:src|href)="([^"]*\/_next\/[^"]+)"/g)].map((match) => match[1]);
  if (assetPaths.length === 0) throw new Error("Standalone HTML did not expose any Next.js assets.");
  if (assetPaths.some((assetPath) => !assetPath.startsWith(`${basePath}/_next/`))) {
    throw new Error(`An asset is missing the ${basePath} prefix.`);
  }

  const assetResponse = await fetchWhenReady(`${origin}${assetPaths[0]}`);
  const asset = await assetResponse.arrayBuffer();
  if (asset.byteLength === 0) throw new Error("The prefixed production asset was empty.");
  console.log(`Verified standalone page ${basePath}/ and ${assetPaths.length} prefixed assets.`);
} catch (error) {
  throw new Error(`${error instanceof Error ? error.message : String(error)}\n${output.join("")}`);
} finally {
  server.kill("SIGTERM");
  if (server.exitCode === null) await once(server, "exit");
}
