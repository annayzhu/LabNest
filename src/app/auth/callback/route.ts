import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { CHATGPT_CALLBACK_PATH, CHATGPT_PENDING_COOKIE, ChatGPTSignInError, finishChatGPTSignIn, loopbackPort, openPendingSignIn, readRegistration, storeChatGPTSignIn } from "@/lib/chatgpt-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where OpenAI returns a Sign in with ChatGPT (the loopback address it allows). The pending sign-in in the cookie must
 * match; the sign-in is then exchanged, verified and saved, and the browser goes back to the AI page it started from.
 */
export async function GET(request: NextRequest) {
  const host = request.headers.get("host");
  const port = loopbackPort(host);
  if (!port || host !== `127.0.0.1:${port}`) return new Response("Not found", { status: 404 });

  const pending = openPendingSignIn(decodeURIComponent(request.cookies.get(CHATGPT_PENDING_COOKIE)?.value ?? ""));
  const returnTo = pending?.returnTo ?? `http://127.0.0.1:${port}`;
  let reason = "signed-in";
  try {
    const provider = pending?.providerId ? await prisma.aIProvider.findUnique({ where: { id: pending.providerId } }) : null;
    const previous = provider?.type === "chatgpt_subscription" ? readRegistration(provider.apiKeyEncrypted) : undefined;
    const result = await finishChatGPTSignIn(request.nextUrl.searchParams, pending, previous);
    if (!await storeChatGPTSignIn(result, provider?.id)) reason = "signed-in-no-models";
    revalidatePath("/ai");
  } catch (error) {
    reason = error instanceof ChatGPTSignInError ? error.reason : /LABNEST_AI_ENCRYPTION_KEY/.test(String(error)) ? "encryption" : "failed";
  }
  return new Response(null, { status: 303, headers: {
    location: `${returnTo}/ai?chatgpt=${reason}#providers`,
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
    "set-cookie": `${CHATGPT_PENDING_COOKIE}=; Path=${CHATGPT_CALLBACK_PATH}; HttpOnly; SameSite=Lax; Max-Age=0`,
  } });
}
