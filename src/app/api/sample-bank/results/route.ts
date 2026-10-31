import type { Prisma } from "@/generated/prisma/client";
import { decryptSecret } from "@/lib/ai-crypto";
import { prisma } from "@/lib/db";
import { MAX_RECORDS_PER_PUSH, SAMPLE_BANK_CONTRACT, type sampleBankErrorCodes } from "@/lib/sample-bank/contract";
import { parseResultPush } from "@/lib/sample-bank/connector";
import { afterPush } from "@/lib/sample-bank/push";
import { bearerToken, sameSecret, signPush } from "@/lib/sample-bank/signature";

export const runtime = "nodejs";

/**
 * Where the sample bank pushes search results (contract §4, S18, S21). A push must carry LabNest's push token and be
 * signed with it, belong to a search LabNest sent to that bank, and come from the bank's own source. Pages are kept
 * as received; a page sent twice is taken once. Every refusal is logged, without the body.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return refuse(401, "unauthorized", "A push needs LabNest's push token.");
  const connections = await prisma.sampleBankConnection.findMany({ where: { inboundTokenEncrypted: { not: null } }, select: { id: true, source: true, enabled: true, inboundTokenEncrypted: true } });
  const connection = connections.find((candidate) => {
    try { return sameSecret(decryptSecret(candidate.inboundTokenEncrypted!), token); } catch { return false; }
  });
  if (!connection) return refuse(401, "unauthorized", "This push token is not one LabNest gave out.");
  if (!sameSecret(request.headers.get("x-labnest-signature") ?? "", signPush(body, token))) return refuse(401, "unauthorized", "The push signature does not match its body.", connection.id);
  if (!connection.enabled) return refuse(403, "unauthorized", "The sample bank connection is turned off in LabNest.", connection.id);

  let json: unknown;
  try { json = JSON.parse(body); } catch { return refuse(400, "invalid_request", "The push is not JSON.", connection.id); }
  const records = (json as { records?: unknown })?.records;
  if (Array.isArray(records) && records.length > MAX_RECORDS_PER_PUSH) return refuse(413, "too_many_records", `One push carries at most ${MAX_RECORDS_PER_PUSH} records.`, connection.id);
  let push: ReturnType<typeof parseResultPush>;
  try { push = parseResultPush(json); } catch (error) { return refuse(400, "invalid_request", error instanceof Error ? error.message : "The push does not follow the contract.", connection.id); }

  const search = await prisma.sampleBankSearch.findUnique({ where: { requestId: push.requestId }, select: { id: true, connectionId: true } });
  if (!search || search.connectionId !== connection.id) return refuse(404, "unknown_request", "LabNest did not send this request.", connection.id, push.requestId);
  const foreign = push.records.find((record) => record.source !== connection.source);
  if (foreign) return refuse(400, "invalid_request", `This bank's records come from ${connection.source}, not ${foreign.source}.`, connection.id, push.requestId);

  const duplicate = await prisma.$transaction(async (tx) => {
    // One page at a time per search, so two copies of a page arriving together are still taken once.
    await tx.$queryRaw`SELECT 1 FROM "SampleBankSearch" WHERE id = ${search.id} FOR UPDATE`;
    const current = await tx.sampleBankSearch.findUniqueOrThrow({ where: { id: search.id }, select: { status: true, pageCount: true, pagesReceived: true, total: true, bankRequestId: true } });
    const next = afterPush(current, push);
    if (next.duplicate) return true;
    if (push.records.length) {
      await tx.sampleBankRecord.createMany({
        data: push.records.map((record) => ({ searchId: search.id, page: push.page, source: record.source, externalId: record.externalId, record: record as Prisma.InputJsonValue })),
        skipDuplicates: true,
      });
    }
    await tx.sampleBankSearch.update({
      where: { id: search.id },
      data: {
        status: next.status, pageCount: next.pageCount, pagesReceived: next.pagesReceived, total: next.total,
        ...(push.bankRequestId && !current.bankRequestId ? { bankRequestId: push.bankRequestId } : {}),
        ...(push.error ? { error: push.error } : {}),
        ...(next.status === "complete" || next.status === "failed" ? { completedAt: new Date() } : {}),
      },
    });
    await tx.activityLog.create({ data: { action: "sample_bank_push", targetType: "sample_bank_search", targetId: search.id, metadataJson: { page: push.page, pageCount: push.pageCount, records: push.records.length, status: push.status } } });
    return false;
  });
  return Response.json({ contract: SAMPLE_BANK_CONTRACT, requestId: push.requestId, page: push.page, received: true, ...(duplicate ? { duplicate: true } : {}) });
}

async function refuse(status: number, code: (typeof sampleBankErrorCodes)[number], message: string, connectionId?: string, requestId?: string) {
  await prisma.activityLog.create({
    data: { action: "sample_bank_push_refused", targetType: "sample_bank_connection", targetId: connectionId ?? "unknown", metadataJson: { code, message, requestId: requestId ?? null } },
  }).catch(() => undefined);
  return Response.json({ contract: SAMPLE_BANK_CONTRACT, ...(requestId ? { requestId } : {}), error: { code, message } }, { status });
}
