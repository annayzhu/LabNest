import type { NextRequest } from "next/server";
import { describeEncryptionKey } from "@/lib/ai-crypto";
import { beginChatGPTSignIn, CHATGPT_CALLBACK_PATH, CHATGPT_PENDING_COOKIE, loopbackPort, readRegistration, readTokens, sealPendingSignIn } from "@/lib/chatgpt-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const toAI = (reason: string) => new Response(null, { status: 303, headers: { location: `/ai?chatgpt=${reason}#providers`, "cache-control": "no-store" } });

/**
 * Starts Sign in with ChatGPT from the AI page (`?provider=` signs an existing service in again). OpenAI returns only to
 * 127.0.0.1, so a page opened as localhost first moves there and comes back to where it started afterwards.
 */
export async function GET(request: NextRequest) {
  const host = request.headers.get("host");
  const port = loopbackPort(host);
  if (!port) return toAI("loopback");
  const encryption = describeEncryptionKey();
  if (!encryption.configured || encryption.placeholder) return toAI("encryption");

  const here = `http://127.0.0.1:${port}`;
  if (host !== `127.0.0.1:${port}`) {
    const next = new URLSearchParams(request.nextUrl.searchParams);
    next.set("from", `http://${host}`);
    return new Response(null, { status: 303, headers: { location: `${here}/api/ai/chatgpt/start?${next}`, "cache-control": "no-store" } });
  }
  // Come back only to this computer's own address for the same server.
  const from = request.nextUrl.searchParams.get("from");
  const returnTo = from && loopbackPort(from.replace(/^http:\/\//, "")) === port && /^http:\/\/[^/]+$/.test(from) ? from : here;

  const providerId = request.nextUrl.searchParams.get("provider");
  let existing: Parameters<typeof beginChatGPTSignIn>[2];
  if (providerId) {
    const provider = await prisma.aIProvider.findUnique({ where: { id: providerId }, include: { session: true } });
    const registration = provider?.type === "chatgpt_subscription" ? readRegistration(provider.apiKeyEncrypted) : undefined;
    if (!provider || !registration) return toAI("failed");
    existing = { providerId: provider.id, registration, idToken: provider.session ? readTokens(provider.session.tokensEncrypted)?.idToken : undefined };
  }

  try {
    const { pending, url } = await beginChatGPTSignIn(port, returnTo, existing);
    return new Response(null, { status: 303, headers: {
      location: url,
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "set-cookie": `${CHATGPT_PENDING_COOKIE}=${encodeURIComponent(sealPendingSignIn(pending))}; Path=${CHATGPT_CALLBACK_PATH}; HttpOnly; SameSite=Lax; Max-Age=600`,
    } });
  } catch {
    return toAI("network");
  }
}
