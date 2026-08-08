import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ProtocolDocumentEditor } from "@/components/ProtocolDocumentEditor";
import { createProtocolDocument } from "@/app/protocols/new/actions";
import { prisma } from "@/lib/db";
import { createProtocolTemplateDocument } from "@/lib/protocol-document";

export const dynamic = "force-dynamic";

export default async function NewProtocolPage() {
  const [projects, researchPlans] = await Promise.all([
    prisma.project.findMany({ where: { status: "active" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.researchPlan.findMany({
      include: { project: { select: { name: true } } },
      orderBy: [{ project: { name: "asc" } }, { title: "asc" }],
    }),
  ]);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Controlled method"
          title="New Protocol"
          description="Create a complete scientific method using fixed sections, rich text, structured tables, timers and review governance."
        />
        <ProtocolDocumentEditor
          action={createProtocolDocument}
          mode="create"
          protocol={{ canonicalTitle: "", availability: "draft", tags: [], scope: "general" }}
          version={{ displayVersion: "0.1", reviewStage: "draft", changeSummary: "Initial version." }}
          initialDocument={createProtocolTemplateDocument()}
          projects={projects}
          researchPlans={researchPlans.map((plan) => ({
            id: plan.id,
            code: plan.code,
            title: plan.title,
            projectId: plan.projectId,
            projectName: plan.project.name,
          }))}
        />
      </div>
    </AppShell>
  );
}
