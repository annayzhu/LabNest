import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// A push proves itself twice (contract §6): it carries LabNest's push token as a bearer token, and it is signed with
// that token, so a copied body cannot be replayed with another payload.

/** A fresh push token for the bank: 32 random bytes, URL-safe. */
export const newPushToken = () => randomBytes(32).toString("base64url");

/** The X-LabNest-Signature value for a body: `sha256=` and the hex HMAC-SHA256 of the raw body, keyed by the push token. */
export function signPush(body: string, token: string) {
  return `sha256=${createHmac("sha256", token).update(body).digest("hex")}`;
}

/** Whether two secrets are the same, in constant time whatever their lengths. */
export function sameSecret(a: string, b: string) {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

/** The token from an `Authorization: Bearer …` header, or undefined. */
export function bearerToken(header: string | null) {
  return header?.match(/^Bearer\s+(\S+)\s*$/i)?.[1];
}
