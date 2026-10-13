import type { Prisma } from "../generated/prisma/client";
import { AIProviderError } from "./ai";
import { prisma } from "./db";

type SettingsReader = Pick<Prisma.TransactionClient, "aISettings" | "aIProvider">;
/** A request is authorized by one saved revision, not by a captured boolean. */
export function createAIGate(revision: string, provider?: { id: string; revision: string }) {
  async function assertAllowed(reader: SettingsReader = prisma) {
    const settings = await reader.aISettings.findUnique({ where: { id: "default" } });
    if (!settings?.enabled || settings.updatedAt.toISOString() !== revision) {
      throw new AIProviderError("AI 已关闭或设置已改变，本次请求已停止，返回结果未应用。", 403);
    }
    if (provider) {
      const record = await reader.aIProvider.findUnique({ where: { id: provider.id } });
      if (!record?.enabled || record.updatedAt.toISOString() !== provider.revision) {
        throw new AIProviderError("模型服务设置已改变，本次请求已停止。", 403);
      }
    }
  }
  async function lockForPublication(tx: Prisma.TransactionClient) {
    // Serialize publication with a switch update; a completed disable cannot be
    // followed by a transaction publishing a result under an older opt-in.
    await tx.$queryRaw`SELECT id FROM "AISettings" WHERE id='default' FOR SHARE`;
    await assertAllowed(tx);
  }
  const guardedFetch: typeof fetch = async (input, init) => {
    await assertAllowed(); // Includes queued duplicates and connection-test fallbacks.
    const abort = new AbortController();
    let checking = false;
    let failure: unknown;
    const timer = setInterval(async () => {
      if (checking) return;
      checking = true;
      try { await assertAllowed(); }
      catch (error) { failure = error; abort.abort(); }
      finally { checking = false; }
    }, 250);
    try {
      const response = await fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, abort.signal]) : abort.signal });
      // Keep cancellation active while the provider sends the response body too.
      const bytes = await response.arrayBuffer();
      await assertAllowed();
      return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch (error) { throw failure ?? error; }
    finally { clearInterval(timer); }
  };
  return { assertAllowed, lockForPublication, fetch: guardedFetch };
}
