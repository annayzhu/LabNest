import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      IMAGES: {
        input() {
          throw new Error("image optimization is not used by this demo");
        },
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the isolated LabNest demo", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>LabNest Demo<\/title>/i);
  assert.match(html, /LabNest Demo/);
  assert.match(html, /DEMO-PRJ-001/);
  assert.match(html, /DEMO-EXP-20260815-01/);
  assert.match(html, /DEMO DATA/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/i);
});

test("keeps the demo source isolated from the real LabNest database path", async () => {
  const [page, layout, packageJson, hosting, viteConfig] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
  ]);

  const combined = `${page}\n${layout}\n${packageJson}\n${hosting}\n${viteConfig}`;
  assert.doesNotMatch(
    combined,
    /@prisma\/client|DATABASE_URL|PrismaClient|src\/lib\/db|drizzle-kit|D1Database/,
  );
  assert.match(hosting, /"project_id": "appgprj_6a8000ef8cd081919938c2371c037530"/);
  assert.match(page, /localStorage/);
});
