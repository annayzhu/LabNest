import { afterEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { newClientMutationId } from "./client-mutation-id";

afterEach(() => vi.unstubAllGlobals());
it("generates distinct UUIDv4 mutation IDs on LAN HTTP without randomUUID", () => {
  vi.stubGlobal("crypto", { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) });
  const ids = Array.from({ length: 100 }, () => newClientMutationId());
  expect(new Set(ids).size).toBe(100);
  expect(ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))).toBe(true);
});
