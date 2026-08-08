"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseProtocolDocx } from "@/lib/protocol-docx";

export type ProtocolImportState = { error?: string };

function recordStatusFor(reviewStage: "draft" | "ready_for_review" | "reviewed") {
  if (reviewStage === "reviewed") return "reviewed" as const;
  if (reviewStage === "ready_for_review") return "submitted" as const;
  return "draft" as const;
}

async function nextProtocolCode() {
  const protocols = await prisma.protocol.findMany({
    where: { humanCode: { startsWith: "PRT-" } },
    select: { humanCode: true },
  });
  const highest = protocols.reduce((max, item) => {
    const parsed = Number(item.humanCode?.replace("PRT-", ""));
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 100000);
  return `PRT-${String(highest + 1).padStart(6, "0")}`;
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
    const humanCode = parsed.humanCode ?? await nextProtocolCode();
    const [codeConflict, duplicateSource] = await Promise.all([
      prisma.protocol.findUnique({ where: { humanCode } }),
      prisma.protocolVersion.findFirst({ where: { sourceFileChecksum: parsed.sourceFileChecksum } }),
    ]);
    if (duplicateSource) {
      return { error: `This exact file was already imported as ${duplicateSource.title}.` };
    }
    if (codeConflict) {
      return {
        error: `${humanCode} already belongs to “${codeConflict.canonicalTitle ?? codeConflict.title}”. Resolve the identifier conflict before importing; LabNest will not overwrite it silently.`,
      };
    }

    const recordStatus = recordStatusFor(parsed.reviewStage);
    const protocol = await prisma.protocol.create({
      data: {
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
      },
    });

    revalidatePath("/protocols");
    redirect(`/protocols/${protocol.id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: error instanceof Error ? error.message : "The DOCX file could not be imported." };
  }
}
