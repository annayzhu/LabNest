"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { formActionErrorMessage } from "@/lib/form-actions";
import { protocolCompatibilityIssue } from "@/lib/protocol-compatibility";
import { conversionSummaryText, convertLegacyProtocol, isLegacyProtocol } from "@/lib/protocol-conversion";
import { storedProtocolDocument } from "@/lib/protocol-document";
import { createDraftRevision } from "@/lib/protocol-revision.server";

export type ConvertState = { error?: string };
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

/** 转换为步骤块: the converted Protocol becomes a new draft version; the old version and its Experiments stay as they are. */
export async function convertProtocolVersion(_previous: ConvertState, formData: FormData): Promise<ConvertState> {
  const versionId = String(formData.get("versionId") ?? "");
  let target: { protocolId: string; versionId: string };
  try {
    target = await prisma.$transaction(async tx => {
      const source = await tx.protocolVersion.findUnique({ where: { id: versionId }, include: { protocol: true } });
      if (!source) throw new Error("规程版本不存在");
      // Unreadable content would fall back to the old columns and the draft would silently lose what was written.
      const issue = protocolCompatibilityIssue(source.contentJson);
      if (issue) throw new Error(issue);
      await tx.$queryRaw`SELECT id FROM "Protocol" WHERE id=${source.protocolId} FOR UPDATE`;
      const document = storedProtocolDocument(source);
      if (!isLegacyProtocol(document)) throw new Error("这一版已经是步骤块，不需要转换");
      const { document: converted, summary } = convertLegacyProtocol(document, prefix => `${prefix}-${randomUUID()}`);
      const { version, displayVersion } = await createDraftRevision(tx, source, converted, conversionSummaryText(summary));
      // Activity entries print their fields as text: keep them flat.
      await tx.activityLog.create({ data: { action: "protocol_converted_to_step_blocks", targetType: "protocol", targetId: source.protocolId, metadataJson: json({
        sourceVersionId: source.id, savedVersionId: version.id, displayVersion, steps: summary.steps, chips: summary.chips.length, formulaRows: summary.formulaRows,
      }) } });
      return { protocolId: source.protocolId, versionId: version.id };
    });
    revalidatePath(`/protocols/${target.protocolId}`);
  } catch (error) {
    return { error: formActionErrorMessage(error, "未能转换，请重试") };
  }
  redirect(`/protocols/${target.protocolId}/versions/${target.versionId}/edit`);
}
