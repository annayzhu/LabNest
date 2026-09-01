import { notFound } from "next/navigation";
import { GitBranchPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ProtocolDocumentEditor } from "@/components/ProtocolDocumentEditor";
import { prisma } from "@/lib/db";
import { normalizeProtocolDocument, protocolDocumentFromLegacy, upgradeProtocolDocumentForEditing } from "@/lib/protocol-document";
import { saveProtocolDocument } from "./actions";
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
  const [version, projects, researchPlans, attachmentLinks] = await Promise.all([
    prisma.protocolVersion.findUnique({
      where: { id: versionId },
      include: { protocol: { include: {
        project: true,
        projectAssociations: { include: { project: true } },
        researchPlans: true,
        versions: {
          orderBy: { revision: "desc" },
          include: {
            experimentLinks: { include: { experiment: true } },
            primaryExperiments: true,
            results: true,
          },
        },
      } } },
    }),
    prisma.project.findMany({ where: { status: "active" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.researchPlan.findMany({
      include: { project: { select: { name: true } } },
      orderBy: [{ project: { name: "asc" } }, { title: "asc" }],
    }),
    prisma.attachmentLink.findMany({
      where: { OR: [{ targetType: "protocol", targetId: id }, { targetType: "protocol_version", targetId: versionId }] },
      include: { attachment: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!version || version.protocolId !== id) notFound();

  const document = upgradeProtocolDocumentForEditing(normalizeProtocolDocument(version.contentJson) ?? protocolDocumentFromLegacy({
    description: version.protocol.description,
    purpose: version.purpose,
    background: version.background,
    materials: asArray<ProtocolMaterial>(version.materialsJson),
    equipment: asArray<ProtocolMaterial>(version.equipmentJson),
    steps: asArray<ProtocolStep>(version.stepsJson),
    resultTemplates: asArray<ResultTemplate>(version.resultTemplatesJson),
    consumptionRules: asArray<ConsumptionRule>(version.consumptionRulesJson),
  }));

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          identifier={`${version.protocol.humanCode ?? "Protocol"} · v${version.displayVersion}`}
          title={version.reviewStage === "reviewed" ? "Edit Protocol as New Revision" : "Edit Protocol"}
          description={version.reviewStage === "reviewed" ? "Reviewed versions are immutable. Saving creates a linked revision and leaves the reviewed source unchanged." : "Edit fixed scientific sections using rich text, structured tables, checklists, media, timers and callouts."}
        />
        {version.reviewStage === "reviewed" ? (
          <div className="flex items-start gap-3 rounded-[10px] border border-sage/45 bg-sage-surface/55 px-4 py-3">
            <GitBranchPlus className="mt-0.5 h-5 w-5 shrink-0 text-moss" aria-hidden />
            <div>
              <h2 className="text-sm font-semibold text-ink">All fields remain editable</h2>
              <p className="mt-1 text-sm leading-6 text-graphite">This reviewed version remains protected. Edit any field below; saving creates a linked revision and preserves the current version.</p>
            </div>
          </div>
        ) : null}
        <ProtocolDocumentEditor
          action={saveProtocolDocument}
          mode="edit"
          protocol={{
            id: version.protocol.id,
            humanCode: version.protocol.humanCode ?? undefined,
            canonicalTitle: version.protocol.canonicalTitle ?? version.protocol.title,
            shortTitle: version.protocol.shortTitle ?? undefined,
            englishTitle: version.protocol.englishTitle ?? undefined,
            availability: version.protocol.availability,
            tags: version.protocol.tags,
            scope: version.protocol.scope,
            projectId: version.protocol.projectId ?? undefined,
            projectName: version.protocol.project?.name,
          }}
          version={{
            id: version.id,
            displayVersion: version.displayVersion,
            reviewStage: version.reviewStage,
            changeSummary: version.changeSummary ?? undefined,
          }}
          initialDocument={document}
          suggestedDisplayVersion={nextDisplayVersion(version.displayVersion)}
          projects={projects}
          researchPlans={researchPlans.map((plan) => ({
            id: plan.id,
            code: plan.code,
            title: plan.title,
            projectId: plan.projectId,
            projectName: plan.project.name,
          }))}
          initialResearchPlanIds={version.protocol.researchPlans.map((link) => link.researchPlanId)}
          initialPrimaryResearchPlanIds={version.protocol.researchPlans.filter((link) => link.isPrimary).map((link) => link.researchPlanId)}
          relevantItems={{
            projects: [...new Map([
              ...(version.protocol.project ? [version.protocol.project] : []),
              ...version.protocol.projectAssociations.map((link) => link.project),
            ].map((project) => [project.id, { id: project.id, label: project.name, href: `/projects/${project.id}` }])).values()],
            experiments: [...new Map(version.protocol.versions.flatMap((protocolVersion) => [
              ...protocolVersion.experimentLinks.map((link) => link.experiment),
              ...protocolVersion.primaryExperiments,
            ]).map((experiment) => [experiment.id, { id: experiment.id, label: `${experiment.runCode} · ${experiment.title}`, href: `/experiments/${experiment.id}` }])).values()],
            results: [...new Map(version.protocol.versions.flatMap((protocolVersion) => protocolVersion.results).map((result) => [result.id, { id: result.id, label: result.title, meta: result.recordStatus, href: `/results/${result.id}` }])).values()],
            attachments: attachmentLinks.map((link) => ({ id: link.id, label: link.attachment.originalFilename, meta: `${Math.max(1, Math.round(link.attachment.size / 1024))} KB`, href: `/api/attachments/${link.attachment.id}` })),
            versions: version.protocol.versions.map((protocolVersion) => ({ id: protocolVersion.id, label: `v${protocolVersion.displayVersion}`, meta: protocolVersion.reviewStage, href: `/protocols/${version.protocol.id}?version=${protocolVersion.id}` })),
          }}
        />
      </div>
    </AppShell>
  );
}
