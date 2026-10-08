import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, describeEncryptionKey, encryptSecret, isEncryptedSecret } from "./ai-crypto";

const originalKey = process.env.LABNEST_AI_ENCRYPTION_KEY;

describe("ai-crypto", () => {
  beforeEach(() => {
    process.env.LABNEST_AI_ENCRYPTION_KEY = "unit-test-passphrase";
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.LABNEST_AI_ENCRYPTION_KEY;
    else process.env.LABNEST_AI_ENCRYPTION_KEY = originalKey;
  });

  it("round-trips a secret and never stores it in clear text", () => {
    const stored = encryptSecret("sk-live-example-1234");
    expect(stored.startsWith("v1:")).toBe(true);
    expect(stored).not.toContain("sk-live");
    expect(isEncryptedSecret(stored)).toBe(true);
    expect(decryptSecret(stored)).toBe("sk-live-example-1234");
  });

  it("produces a different ciphertext for every call", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("accepts 32-byte hex and base64 keys", () => {
    process.env.LABNEST_AI_ENCRYPTION_KEY = "a".repeat(64);
    expect(describeEncryptionKey()).toEqual({ configured: true, placeholder: false });
    expect(decryptSecret(encryptSecret("hex-key-secret"))).toBe("hex-key-secret");

    process.env.LABNEST_AI_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    expect(decryptSecret(encryptSecret("b64-key-secret"))).toBe("b64-key-secret");
  });

  it("flags the .env.example placeholder", () => {
    process.env.LABNEST_AI_ENCRYPTION_KEY = "replace-with-32-byte-base64-or-hex-key";
    expect(describeEncryptionKey()).toEqual({ configured: true, placeholder: true });
  });

  it("rejects values encrypted under a different key", () => {
    const stored = encryptSecret("secret");
    process.env.LABNEST_AI_ENCRYPTION_KEY = "another-passphrase";
    expect(() => decryptSecret(stored)).toThrow(/re-enter the API key/);
  });

  it("fails clearly when the key is missing", () => {
    delete process.env.LABNEST_AI_ENCRYPTION_KEY;
    expect(describeEncryptionKey().configured).toBe(false);
    expect(() => encryptSecret("x")).toThrow(/LABNEST_AI_ENCRYPTION_KEY/);
  });
});
