import { prisma } from "@/lib/db";
import { downloadResponse, formatExportTimestamp } from "@/lib/export";

export const runtime = "nodejs";

export async function GET() {
  const [
    projects,
    entries,
    experiments,
    protocols,
    entities,
    sampleProfiles,
    inventoryLocations,
    inventoryItems,
    inventoryTransactions,
    results,
    procurementInquiries,
    purchaseRequests,
    attachments,
    sequences,
    itemLinks,
    proposedActions,
    aiProviders,
    referenceConnectors,
  ] = await Promise.all([
    prisma.project.findMany(),
    prisma.entry.findMany(),
    prisma.experiment.findMany({ include: { steps: true, protocolRun: true } }),
    prisma.protocol.findMany({ include: { versions: true } }),
    prisma.entity.findMany(),
    prisma.sampleProfile.findMany({ include: { events: true } }),
    prisma.inventoryLocation.findMany(),
    prisma.inventoryItem.findMany(),
    prisma.inventoryTransaction.findMany(),
    prisma.result.findMany(),
    prisma.procurementInquiry.findMany({ include: { quoteLines: true } }),
    prisma.purchaseRequest.findMany(),
    prisma.attachment.findMany({ include: { links: true } }),
    prisma.sequence.findMany({ include: { features: true } }),
    prisma.itemLink.findMany(),
    prisma.proposedAction.findMany(),
    prisma.aIProvider.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        baseUrl: true,
        defaultModel: true,
        capabilitiesJson: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.referenceConnector.findMany(),
  ]);

  const backup = {
    app: "LabNest",
    version: 1,
    exportedAt: new Date().toISOString(),
    note: "File binaries are not embedded; attachment metadata includes storagePath for local recovery.",
    data: {
      projects,
      entries,
      experiments,
      protocols,
      entities,
      sampleProfiles,
      inventoryLocations,
      inventoryItems,
      inventoryTransactions,
      results,
      procurementInquiries,
      purchaseRequests,
      attachments,
      sequences,
      itemLinks,
      proposedActions,
      aiProviders,
      referenceConnectors,
    },
  };

  return downloadResponse(
    JSON.stringify(backup, null, 2),
    `labnest-backup-${formatExportTimestamp()}.json`,
    "application/json; charset=utf-8",
  );
}
