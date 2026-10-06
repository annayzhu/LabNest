import type { Prisma } from "@/generated/prisma/client";
/** Serialize the small source-reference graph before record/file locks; never lock after a target row. */
export async function lockEntrySourceGraph(tx: Prisma.TransactionClient) {
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(20261006)::text`;
}
