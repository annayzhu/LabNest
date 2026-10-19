import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { ParsedStructuredFile } from "./structured-files";

// A process-local fallback invalidates previews after restart, rather than accepting unsigned confirmations.
const processSecrets = globalThis as typeof globalThis & { protocolImportConfirmationSecret?: Buffer };
const fallbackSecret = processSecrets.protocolImportConfirmationSecret ??= randomBytes(32);
function signature(payload: string) {
  return createHmac("sha256", process.env.LABNEST_AI_ENCRYPTION_KEY || fallbackSecret).update(payload).digest("hex");
}
function binding(parsed: ParsedStructuredFile, expiresAt: number) {
  return JSON.stringify({ module: parsed.module, format: parsed.format, fileName: parsed.fileName, checksum: parsed.checksum, decisions: parsed.protocolDecisions, mapping: parsed.mapping, expiresAt });
}
export function createImportConfirmation(parsed: ParsedStructuredFile) {
  const expiresAt = Date.now() + 30 * 60 * 1000;
  return `${expiresAt}.${signature(binding(parsed, expiresAt))}`;
}
export function matchesImportConfirmation(parsed: ParsedStructuredFile, token: string) {
  if (token.split(".").length !== 2) return false;
  const [expiry, digest] = token.split(".");
  const expiresAt = Number(expiry);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now() || !/^[a-f0-9]{64}$/.test(digest ?? "")) return false;
  return timingSafeEqual(Buffer.from(signature(binding(parsed, expiresAt)), "hex"), Buffer.from(digest, "hex"));
}
