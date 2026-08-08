import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ProtocolDocumentEditor } from "@/components/ProtocolDocumentEditor";
import { prisma } from "@/lib/db";
import { normalizeProtocolDocument, protocolDocumentFromLegacy } from "@/lib/protocol-document";
import type { ConsumptionRule, ProtocolMaterial, ProtocolStep, ResultTemplate } from "@/lib/types";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function nextDisplayVersion(value: string) {
  const parts = value.split(".").map(Number);
  if (parts.length < 2 || parts.some((part) => !Number.isInteger(part))) return "0.1";
  parts[parts.length - 1] += 1;
  return parts.join(".");
}

export default async function EditProtocolVersionPage({ params }: { params: Promise<{ id: string; versionId: string }> }) {
  const { id, versionId } = await params;
  const version = await prisma.protocolVersion.findUnique({
    where: { id: versionId },
    include: { protocol: true },
  });
  if (!version || version.protocolId !== id) notFound();

  const document = normalizeProtocolDocument(version.contentJson) ?? protocolDocumentFromLegacy({
    description: version.protocol.description,
    purpose: version.purpose,
    background: version.background,
    materials: asArray<ProtocolMaterial>(version.materialsJson),
    equipment: asArray<ProtocolMaterial>(version.equipmentJson),
    steps: asArray<ProtocolStep>(version.stepsJson),
    resultTemplates: asArray<ResultTemplate>(version.resultTemplatesJson),
    consumptionRules: asArray<ConsumptionRule>(version.consumptionRulesJson),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow={`${version.protocol.humanCode ?? "Protocol"} · ${version.displayVersion}`}
          title={version.reviewStage === "reviewed" ? "Create Protocol Revision" : "Edit Protocol"}
          description={version.reviewStage === "reviewed" ? "Reviewed versions are immutable. Saving creates a linked revision and leaves the reviewed source unchanged." : "Edit fixed scientific sections using text, checklist, table, heading, and callout blocks."}
        />
        <ProtocolDocumentEditor
          protocol={{
            id: version.protocol.id,
            canonicalTitle: version.protocol.canonicalTitle ?? version.protocol.title,
            shortTitle: version.protocol.shortTitle ?? undefined,
            englishTitle: version.protocol.englishTitle ?? undefined,
            availability: version.protocol.availability,
            tags: version.protocol.tags,
          }}
          version={{
            id: version.id,
            displayVersion: version.displayVersion,
            reviewStage: version.reviewStage,
            changeSummary: version.changeSummary ?? undefined,
          }}
          initialDocument={document}
          suggestedDisplayVersion={nextDisplayVersion(version.displayVersion)}
        />
      </div>
    </AppShell>
  );
}
