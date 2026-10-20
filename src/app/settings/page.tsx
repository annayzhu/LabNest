import { redirect } from "next/navigation";
import { SettingsAILink } from "@/components/SettingsAILink";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import {AppearanceSettings} from "@/components/AppearanceSettings";

import { TypographySettingsPanel } from "@/components/TypographySettingsPanel";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { BackupPanel } from "@/components/BackupPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams?: Promise<{ provider?: string }> }) {
  const editingProviderId = (await searchParams)?.provider;
  if (editingProviderId) redirect(`/ai?provider=${encodeURIComponent(editingProviderId)}#providers`);
  const referenceConnectors = await prisma.referenceConnector.findMany({ orderBy: { displayName: "asc" } });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          description="Choose how LabNest looks and manage optional system capabilities."
        />

        <SettingsAILink />
        <nav aria-label="设置分类" className="sticky top-0 z-10 flex flex-wrap gap-x-5 border-b border-hairline bg-surface py-2 text-sm">{[["appearance","外观"],["typography","字体排版"],["local-backup","备份"],["connectors","文献连接"]].map(([id,label])=><a key={id} href={`#${id}`} className="focus-ring inline-flex min-h-11 items-center text-moss">{label}</a>)}</nav>
        <Card>
          <CardHeader title="Appearance / 外观" />
          <CardBody className="space-y-5"><AppearanceSettings /></CardBody>
        </Card>

        <Card id="typography">
          <CardHeader title="Typography / 字体排版" />
          <CardBody><TypographySettingsPanel /></CardBody>
        </Card>

        <div id="local-backup" className="scroll-mt-20">
          <BackupPanel />
        </div>

        <Card id="connectors">
          <CardHeader title="Literature connectors" eyebrow="External libraries" />
          <CardBody>
            <DataTable
              rows={referenceConnectors}
              getRowKey={(row) => row.id}
              emptyMessage="No reference connector configured."
              columns={[
                { key: "name", header: "Connector", render: (row) => <span className="font-semibold text-ink">{row.displayName}</span> },
                { key: "provider", header: "Provider", render: (row) => <Badge tone="sage">{row.provider}</Badge> },
                { key: "scope", header: "Scope", render: (row) => row.libraryScope ?? "not set" },
                { key: "enabled", header: "State", render: (row) => <Badge tone={row.enabled ? "success" : "neutral"}>{row.enabled ? "enabled" : "disabled"}</Badge> },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
