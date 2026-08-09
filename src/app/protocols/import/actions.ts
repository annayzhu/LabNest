"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseProtocolDocx } from "@/lib/protocol-docx";
import { isUnfilledProtocolDocxTemplateTitle } from "@/lib/protocol-docx-template";
import { isValidRecordCode, reserveRecordCode } from "@/lib/record-codes";
import { checkResultTemplate } from "@/lib/result-templates";

export type ProtocolImportState = { error?: string };

function recordStatusFor(reviewStage: "draft" | "ready_for_review" | "reviewed") {
  if (reviewStage === "reviewed") return "reviewed" as const;
  if (reviewStage === "ready_for_review") return "submitted" as const;
  return "draft" as const;
}

export async function importProtocolDocx(
  _previousState: ProtocolImportState,
  formData: FormData,
): Promise<ProtocolImportState> {
  const file = formData.get("docx");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a DOCX file." };
  if (!file.name.toLowerCase().endsWith(".docx")) return { error: "Only .docx files are supported." };
  if (file.size > 20 * 1024 * 1024) return { error: "The DOCX file must be 20 MB or smaller." };

  try {
    const parsed = await parseProtocolDocx(file);
    if (isUnfilledProtocolDocxTemplateTitle(parsed.canonicalTitle)) {
      return { error: "Replace the template Protocol title before importing." };
    }
    if (parsed.reviewStage !== "draft") {
      const templateErrors = parsed.resultTemplates.flatMap((template) => checkResultTemplate(template).errors);
      if (templateErrors.length) return { error: `Reviewed Protocols require complete Result Templates: ${templateErrors.join(" ")}` };
    }
    const suppliedHumanCode = parsed.humanCode?.trim().toUpperCase();
    if (suppliedHumanCode && !isValidRecordCode("protocol", suppliedHumanCode)) {
      return { error: "Protocol code must use PRT- followed by at least six digits." };
    }
    const [codeConflict, duplicateSource] = await Promise.all([
      suppliedHumanCode ? prisma.protocol.findUnique({ where: { humanCode: suppliedHumanCode } }) : Promise.resolve(null),
      prisma.protocolVersion.findFirst({ where: { sourceFileChecksum: parsed.sourceFileChecksum } }),
    ]);
    if (duplicateSource) {
      return { error: `This exact file was already imported as ${duplicateSource.title}.` };
    }
    if (codeConflict) {
      return {
        error: `${suppliedHumanCode} already belongs to “${codeConflict.canonicalTitle ?? codeConflict.title}”. Resolve the identifier conflict before importing; LabNest will not overwrite it silently.`,
      };
    }

    const recordStatus = recordStatusFor(parsed.reviewStage);
    const protocol = await prisma.$transaction(async (transaction) => {
      const humanCode = suppliedHumanCode ?? await reserveRecordCode(transaction, "protocol");
      const created = await transaction.protocol.create({ data: {
        humanCode,
        title: parsed.canonicalTitle,
        canonicalTitle: parsed.canonicalTitle,
        englishTitle: parsed.englishTitle,
        description: parsed.description,
        scope: "general",
        availability: parsed.availability,
        recordStatus,
        tags: parsed.tags,
        versions: {
          create: {
            revision: 1,
            displayVersion: parsed.displayVersion,
            reviewStage: parsed.reviewStage,
            recordStatus,
            title: `${parsed.canonicalTitle} v${parsed.displayVersion}`,
            purpose: parsed.purpose,
            background: parsed.background,
            materialsJson: parsed.materials,
            equipmentJson: parsed.equipment,
            stepsJson: parsed.steps,
            resultTemplatesJson: parsed.resultTemplates,
            consumptionRulesJson: parsed.consumptionRules,
            contentJson: JSON.parse(JSON.stringify(parsed.document)),
            changeSummary: "Imported from the supplied Protocol DOCX template.",
            sourceType: "docx_import",
            sourceFileName: parsed.sourceFileName,
            sourceFileChecksum: parsed.sourceFileChecksum,
            sourceImportedAt: new Date(),
          },
        },
      }, include: { versions: { select: { id: true } } } });
      await transaction.activityLog.create({ data: {
        action: "import_docx",
        targetType: "protocol",
        targetId: created.id,
        metadataJson: { humanCode, protocolVersionId: created.versions[0]?.id, sourceFileName: parsed.sourceFileName, sourceFileChecksum: parsed.sourceFileChecksum },
      } });
      return created;
    });

    revalidatePath("/protocols");
    redirect(`/protocols/${protocol.id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: error instanceof Error ? error.message : "The DOCX file could not be imported." };
  }
}
