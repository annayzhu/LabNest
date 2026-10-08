import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Symmetric encryption for stored AI provider credentials.
 *
 * Keys are AES-256-GCM. The server key comes from LABNEST_AI_ENCRYPTION_KEY and may be
 * a 32-byte hex string, a 32-byte base64 string, or any other passphrase (hashed with
 * SHA-256). Stored values look like `v1:<iv>:<tag>:<ciphertext>` with base64 segments.
 */

const FORMAT_VERSION = "v1";
const PLACEHOLDER_KEY = "replace-with-32-byte-base64-or-hex-key";

export type EncryptionKeyStatus = {
  configured: boolean;
  /** True when the `.env.example` placeholder is still in use. */
  placeholder: boolean;
};

function rawKey(): string | undefined {
  const value = process.env.LABNEST_AI_ENCRYPTION_KEY?.trim();
  return value ? value : undefined;
}

export function describeEncryptionKey(): EncryptionKeyStatus {
  const raw = rawKey();
  return { configured: Boolean(raw), placeholder: raw === PLACEHOLDER_KEY };
}

function parseStrictKey(raw: string): Buffer | undefined {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  if (/^[A-Za-z0-9+/]{43}=$/.test(raw)) {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) return decoded;
  }
  return undefined;
}

function resolveKey(): Buffer {
  const raw = rawKey();
  if (!raw) {
    throw new Error(
      "LABNEST_AI_ENCRYPTION_KEY is not set. Add a 32-byte base64 or hex key to .env before saving provider credentials.",
    );
  }
  if (raw === PLACEHOLDER_KEY) {
    throw new Error("LABNEST_AI_ENCRYPTION_KEY uses the public placeholder. Set a private key before storing credentials.");
  }
  return parseStrictKey(raw) ?? createHash("sha256").update(raw, "utf8").digest();
}

export function encryptSecret(plainText: string): string {
  const key = resolveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [FORMAT_VERSION, iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptSecret(payload: string): string {
  const [version, ivPart, tagPart, dataPart] = payload.split(":");
  if (version !== FORMAT_VERSION || !ivPart || !tagPart || !dataPart) {
    throw new Error("Stored credential has an unrecognized format.");
  }
  const key = resolveKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));
  try {
    return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error(
      "Stored credential could not be decrypted. LABNEST_AI_ENCRYPTION_KEY may have changed since it was saved; re-enter the API key.",
    );
  }
}

export function isEncryptedSecret(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith(`${FORMAT_VERSION}:`);
}
