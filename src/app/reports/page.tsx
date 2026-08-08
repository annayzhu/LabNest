import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const projects = await prisma.project.findMany({
    include: {
      _count: { select: { researchPlans: true, experiments: true, results: true, entries: true } },
      experiments: { select: { status: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Synthesis"
          title="Reports"
          description="Reports summarize traceable project records. Narrative report editing and export will be built on this project-level source map."
        />
        <Card>
          <CardHeader title="Project report readiness" eyebrow="Compact source coverage" />
          <CardBody>
            <DataTable
              rows={projects}
              getRowKey={(row) => row.id}
              columns={[
                { key: "project", header: "Project", render: (row) => <span className="font-semibold text-ink">{row.name}</span> },
                { key: "plans", header: "Plans", render: (row) => row._count.researchPlans },
                { key: "entries", header: "Entries", render: (row) => row._count.entries },
                { key: "experiments", header: "Experiments", render: (row) => `${row._count.experiments} total · ${row.experiments.filter((item) => item.status === "completed").length} completed` },
                { key: "results", header: "Results", render: (row) => row._count.results },
                { key: "readiness", header: "Readiness", render: (row) => row._count.researchPlans > 0 && row._count.results > 0 ? "Source records available" : "Needs structured records" },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
