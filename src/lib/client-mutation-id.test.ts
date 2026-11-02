import { afterEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { newClientMutationId } from "./client-mutation-id";

afterEach(() => vi.unstubAllGlobals());
it("generates distinct UUIDv4 mutation IDs on LAN HTTP without randomUUID", () => {
  vi.stubGlobal("crypto", { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) });
  const ids = Array.from({ length: 100 }, () => newClientMutationId());
  expect(new Set(ids).size).toBe(100);
  expect(ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))).toBe(true);
});

// Phones open LabNest at a plain-HTTP LAN address, where browsers leave crypto.randomUUID out. Only server-only
// files may call it; code a browser loads uses newClientMutationId.
it("keeps crypto.randomUUID out of code a browser can load", () => {
  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? (entry.name === "generated" ? [] : files(full)) : /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
  const offenders = files(path.join(process.cwd(), "src"))
    .filter((file) => !file.endsWith(".server.ts") && !file.endsWith("client-mutation-id.ts"))
    .filter((file) => /\bcrypto\.randomUUID\(/.test(readFileSync(file, "utf8")))
    .map((file) => path.relative(process.cwd(), file));
  expect(offenders).toEqual([]);
});
