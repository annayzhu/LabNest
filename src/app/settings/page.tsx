import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function updateAISettings(formData: FormData) {
  "use server";

  const enabled = formData.get("enabled") === "on";
  const attachmentsEnabled = enabled && formData.get("attachmentsEnabled") === "on";
  const defaultProviderId = String(formData.get("defaultProviderId") ?? "").trim() || null;

  await prisma.aISettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      enabled,
      attachmentsEnabled,
      defaultProviderId: enabled ? defaultProviderId : null,
      externalDataPolicy: "explicit_context",
    },
    update: {
      enabled,
      attachmentsEnabled,
      defaultProviderId: enabled ? defaultProviderId : null,
      externalDataPolicy: "explicit_context",
    },
  });

  revalidatePath("/settings");
  revalidatePath("/actions/manual");
}

export default async function SettingsPage() {
  const [settings, providers, referenceConnectors] = await Promise.all([
    prisma.aISettings.upsert({
      where: { id: "default" },
      create: { id: "default", enabled: false, externalDataPolicy: "explicit_context" },
      update: {},
    }),
    prisma.aIProvider.findMany({ orderBy: { name: "asc" } }),
    prisma.referenceConnector.findMany({ orderBy: { displayName: "asc" } }),
  ]);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Configuration"
          title="Settings"
          description="AI is optional and disabled by default. The switch only permits AI workflows; users must still choose the exact text or files sent to an external model."
        />

        <Card>
          <CardHeader
            title="AI access"
            eyebrow="Explicit opt-in"
            action={<Badge tone={settings.enabled ? "success" : "neutral"}>{settings.enabled ? "Enabled" : "Disabled"}</Badge>}
          />
          <CardBody>
            <form action={updateAISettings} className="space-y-5">
              <label className="flex items-start gap-3 rounded-[10px] border border-hairline bg-warm p-4">
                <input name="enabled" type="checkbox" defaultChecked={settings.enabled} className="mt-1 h-4 w-4 accent-[var(--moss)]" />
                <span>
                  <span className="block text-sm font-semibold text-ink">Allow AI-assisted workflows</span>
                  <span className="mt-1 block text-sm leading-6 text-muted">When off, prompt generation and response import return an explicit blocked response. Core LabNest features remain available.</span>
                </span>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Default provider</span>
                  <select name="defaultProviderId" defaultValue={settings.defaultProviderId ?? ""} className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink">
                    <option value="">No default provider</option>
                    {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-3 self-end rounded-[8px] border border-hairline bg-warm px-3 py-3 text-sm text-graphite">
                  <input name="attachmentsEnabled" type="checkbox" defaultChecked={settings.attachmentsEnabled} className="h-4 w-4 accent-[var(--moss)]" />
                  Permit attachments selected by the user
                </label>
              </div>

              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-muted">Data policy: explicit context only. The master switch never authorizes full-project upload.</p>
                <button className="focus-ring h-10 rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm">Save AI settings</button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Model providers" eyebrow="Adapters" />
          <CardBody>
            <DataTable
              rows={providers}
              getRowKey={(row) => row.id}
              emptyMessage="No provider is configured. Manual LabNest workflows are unaffected."
              columns={[
                { key: "provider", header: "Provider", render: (row) => <span className="font-semibold text-ink">{row.name}</span> },
                { key: "type", header: "Type", render: (row) => <Badge tone="sage">{row.type.replaceAll("_", " ")}</Badge> },
                { key: "endpoint", header: "Endpoint", render: (row) => <span className="font-mono text-xs">{row.baseUrl ?? "manual"}</span> },
                { key: "model", header: "Default model", render: (row) => row.defaultModel ?? "—" },
                { key: "enabled", header: "Provider state", render: (row) => <Badge tone={row.enabled ? "success" : "neutral"}>{row.enabled ? "enabled" : "disabled"}</Badge> },
              ]}
            />
          </CardBody>
        </Card>

        <div id="local-backup" className="scroll-mt-20">
          <Card>
            <CardHeader title="Local backup" eyebrow="Portability" />
            <CardBody className="flex flex-wrap items-center justify-between gap-4">
              <p className="max-w-prose text-sm leading-6 text-muted">
                A portable JSON snapshot of every record. Attachment binaries stay in attachment storage; back that directory up alongside this file. Per-module CSV and XLSX exports live in each module&rsquo;s Export view.
              </p>
              <a
                href="/api/exports/backup.json"
                className="focus-ring inline-flex h-10 shrink-0 items-center justify-center rounded-[8px] border border-hairline bg-surface px-4 text-sm font-medium text-moss transition hover:bg-warm"
              >
                Download backup.json
              </a>
            </CardBody>
          </Card>
        </div>

        <Card>
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
