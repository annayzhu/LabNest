import { prisma } from "@/lib/db";
import { downloadResponse, formatExportTimestamp } from "@/lib/export";

export const runtime = "nodejs";

export async function GET() {
  const protocols = await prisma.protocol.findMany({
    include: {
      project: true,
      researchPlans: { include: { researchPlan: true } },
      versions: { orderBy: { revision: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return downloadResponse(
    JSON.stringify({ exportedAt: new Date().toISOString(), protocols }, null, 2),
    `labnest-protocols-${formatExportTimestamp()}.json`,
    "application/json; charset=utf-8",
  );
}
