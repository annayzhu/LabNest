import "server-only";
import { prisma } from "@/lib/db";
import type { ManualRelevantLink } from "@/lib/protocol-relevant-items";

export async function assertManualRelevantLinksExist(links: ManualRelevantLink[]) {
  const ids = (type: ManualRelevantLink["type"]) => links.filter((item) => item.type === type).map((item) => item.id);
  const [projects, experiments, results, attachments] = await Promise.all([
    prisma.project.count({ where: { id: { in: ids("project") } } }),
    prisma.experiment.count({ where: { id: { in: ids("experiment") } } }),
    prisma.result.count({ where: { id: { in: ids("result") } } }),
    prisma.attachment.count({ where: { id: { in: ids("attachment") } } }),
  ]);
  if (projects + experiments + results + attachments !== links.length) {
    throw new Error("One or more linked records no longer exist. Refresh the page and try again.");
  }
}
