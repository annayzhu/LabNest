import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";
import { normalizeResultTemplate, validateResultRecord } from "./result-templates";

export async function refreshResultValidation(resultId: string) {
  const [result, attachmentLinks] = await Promise.all([
    prisma.result.findUnique({
      where: { id: resultId },
      select: {
        id: true,
        templateSnapshotJson: true,
        valuesJson: true,
        templateInstanceKey: true,
        datasets: { select: { templateDatasetKey: true, validationStatus: true } },
      },
    }),
    prisma.attachmentLink.findMany({
      where: { targetType: "result", targetId: resultId },
      select: { linkType: true },
    }),
  ]);
  if (!result) throw new Error("Result not found while refreshing validation.");
  const template = normalizeResultTemplate(result.templateSnapshotJson);
  const artifactKeys = attachmentLinks.flatMap((link) => link.linkType.startsWith("template_artifact:")
    ? [link.linkType.slice("template_artifact:".length)]
    : []);
  const validation = validateResultRecord({
    template: result.templateSnapshotJson,
    values: result.valuesJson,
    instanceKey: result.templateInstanceKey,
    datasetStatuses: result.datasets,
    artifactKeys,
  });
  await prisma.result.update({
    where: { id: result.id },
    data: {
      validationStatus: validation.status,
      validationJson: validation as unknown as Prisma.InputJsonValue,
      viewSpecJson: (template.view ?? {}) as Prisma.InputJsonValue,
    },
  });
  return validation;
}
