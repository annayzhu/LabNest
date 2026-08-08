import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ProtocolAdaptForm } from "@/components/ProtocolAdaptForm";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";

export default async function AdaptProtocolPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: PageSearchParams }) {
  const { id } = await params;
  const query = searchParams ? await searchParams : undefined;
  const requestedVersionId = firstSearchParam(query, "version");
  const [protocol, projects, researchPlans] = await Promise.all([
    prisma.protocol.findUnique({ where: { id }, include: { versions: { orderBy: { revision: "desc" } } } }),
    prisma.project.findMany({ where: { status: "active" }, orderBy: { name: "asc" } }),
    prisma.researchPlan.findMany({ where: { status: { in: ["draft", "active"] } }, orderBy: { title: "asc" } }),
  ]);
  if (!protocol || protocol.scope !== "general") notFound();
  const version = protocol.versions.find((item) => item.id === requestedVersionId) ?? protocol.versions[0];
  if (!version) notFound();

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow={`${protocol.humanCode ?? "General Protocol"} · ${version.displayVersion}`}
          title="Adapt Protocol to Project"
          description="Create a separate Project Protocol with explicit source-version provenance. The General Protocol remains unchanged and reusable."
        />
        <Card>
          <CardHeader title={protocol.canonicalTitle ?? protocol.title} eyebrow="Source General Protocol" />
          <CardBody>
            <ProtocolAdaptForm
              protocolId={protocol.id}
              sourceVersionId={version.id}
              sourceTitle={protocol.canonicalTitle ?? protocol.title}
              projects={projects.map((project) => ({ id: project.id, name: project.name }))}
              researchPlans={researchPlans.map((plan) => ({ id: plan.id, projectId: plan.projectId, code: plan.code ?? undefined, title: plan.title }))}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
