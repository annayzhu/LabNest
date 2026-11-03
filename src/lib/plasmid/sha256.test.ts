import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sha256, sha256Hex } from "./sha256";

const hex = (bytes: Uint8Array) => Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
const reference = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("SHA-256 without crypto.subtle (plain HTTP on the LAN)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("matches the standard digest around every padding boundary and on a large file", () => {
    for (const length of [0, 1, 3, 55, 56, 57, 63, 64, 65, 119, 120, 128, 1000]) {
      const bytes = Uint8Array.from({ length }, (_, index) => (index * 31 + length) & 0xff);
      expect(hex(sha256(bytes)), `${length} bytes`).toBe(reference(bytes));
    }
    const large = Uint8Array.from({ length: 3_000_017 }, (_, index) => (index * 2654435761) >>> 24);
    expect(hex(sha256(large))).toBe(reference(large));
    expect(hex(sha256(new TextEncoder().encode("abc")))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("falls back when the page has no crypto.subtle", async () => {
    const bytes = new TextEncoder().encode("GATTACA");
    const secure = await sha256Hex(bytes);
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
    expect(globalThis.crypto.subtle).toBeUndefined();
    expect(await sha256Hex(bytes)).toBe(secure);
  });
});
