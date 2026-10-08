import { revalidatePath } from "next/cache";
import Link from "next/link";
import { AiProviderForm, type AiProviderFormValues } from "@/components/AiProviderForm";
import { AiProviderTestButton } from "@/components/AiProviderTestButton";
import { AppShell } from "@/components/AppShell";
import { formInputClass, formLabelClass } from "@/components/forms";
import { PageHeader } from "@/components/PageHeader";
import {AppearanceSettings} from "@/components/AppearanceSettings";

import { TypographySettingsPanel } from "@/components/TypographySettingsPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { isConnectedProviderType, providerTypeLabels, type AIProviderType } from "@/lib/ai";
import { describeEncryptionKey } from "@/lib/ai-crypto";
import { prisma } from "@/lib/db";
import { deleteAIProvider, setAIProviderEnabled } from "./actions";

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

export default async function SettingsPage({ searchParams }: { searchParams?: Promise<{ provider?: string }> }) {
  const editingProviderId = (await searchParams)?.provider;
  const [settings, providers, referenceConnectors] = await Promise.all([
    prisma.aISettings.upsert({
      where: { id: "default" },
      create: { id: "default", enabled: false, externalDataPolicy: "explicit_context" },
      update: {},
    }),
    prisma.aIProvider.findMany({ orderBy: { name: "asc" } }),
    prisma.referenceConnector.findMany({ orderBy: { displayName: "asc" } }),
  ]);
  const encryptionKey = describeEncryptionKey();
  const editingProvider = providers.find((provider) => provider.id === editingProviderId);
  const providerFormValues: AiProviderFormValues | undefined = editingProvider
    ? {
        id: editingProvider.id,
        name: editingProvider.name,
        type: editingProvider.type as AIProviderType,
        baseUrl: editingProvider.baseUrl ?? "",
        defaultModel: editingProvider.defaultModel ?? "",
        enabled: editingProvider.enabled,
        hasStoredKey: Boolean(editingProvider.apiKeyEncrypted),
      }
    : undefined;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          description="Choose how LabNest looks and manage optional system capabilities."
        />

        <nav aria-label="设置分类" className="sticky top-0 z-10 flex flex-wrap gap-x-5 border-b border-hairline bg-surface py-2 text-sm">{[["appearance","外观"],["typography","字体排版"],["ai-access","AI"],["providers","模型服务"],["local-backup","备份"],["connectors","文献连接"]].map(([id,label])=><a key={id} href={`#${id}`} className="focus-ring inline-flex min-h-11 items-center text-moss">{label}</a>)}</nav>
        <Card>
          <CardHeader title="Appearance / 外观" />
          <CardBody className="space-y-5"><AppearanceSettings /></CardBody>
        </Card>

        <Card id="typography">
          <CardHeader title="Typography / 字体排版" />
          <CardBody><TypographySettingsPanel /></CardBody>
        </Card>

        <Card id="ai-access">
          <CardHeader
            title="AI access"
            eyebrow="Explicit opt-in"
            action={<Badge tone={settings.enabled ? "success" : "neutral"}>{settings.enabled ? "Enabled" : "Disabled"}</Badge>}
          />
          <CardBody>
            <form action={updateAISettings} className="space-y-5">
              <label className="flex items-start gap-3 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-warm p-4">
                <input name="enabled" type="checkbox" defaultChecked={settings.enabled} className="mt-1 h-4 w-4 accent-[var(--moss)]" />
                <span>
                  <span className="block text-sm font-semibold text-ink">Allow AI-assisted workflows</span>
                  <span className="mt-1 block text-sm leading-6 text-muted">When off, prompt generation and response import return an explicit blocked response. Core LabNest features remain available.</span>
                </span>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className={formLabelClass}>Default provider</span>
                  <select name="defaultProviderId" defaultValue={settings.defaultProviderId ?? ""} className={formInputClass}>
                    <option value="">No default provider</option>
                    {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-3 self-end rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm px-3 py-3 text-sm text-graphite">
                  <input name="attachmentsEnabled" type="checkbox" defaultChecked={settings.attachmentsEnabled} className="h-4 w-4 accent-[var(--moss)]" />
                  Permit attachments selected by the user
                </label>
              </div>

              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-muted">Data policy: explicit context only. The master switch never authorizes full-project upload.</p>
                <Button type="submit" variant="primary" size="lg">Save AI settings</Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card id="providers">
          <CardHeader title="Model providers" eyebrow="Adapters" />
          <CardBody className="space-y-6">
            {!encryptionKey.configured || encryptionKey.placeholder ? (
              <p className="rounded-[var(--ln-radius-panel-inner)] border border-warning/40 bg-warning-surface p-3 text-sm leading-6 text-ink">
                {encryptionKey.configured
                  ? "LABNEST_AI_ENCRYPTION_KEY still holds the .env.example placeholder. Set a private 32-byte key before storing real API keys."
                  : "LABNEST_AI_ENCRYPTION_KEY is not set. API keys cannot be stored until it is configured."}
              </p>
            ) : null}
            <DataTable
              rows={providers}
              getRowKey={(row) => row.id}
              emptyMessage="No provider is configured. Manual LabNest workflows are unaffected."
              columns={[
                { key: "provider", header: "Provider", render: (row) => <span className="font-semibold text-ink">{row.name}{settings.defaultProviderId === row.id ? <Badge tone="sage" className="ml-2">default</Badge> : null}</span> },
                { key: "type", header: "Type", render: (row) => <Badge tone="sage">{providerTypeLabels[row.type as AIProviderType] ?? row.type.replaceAll("_", " ")}</Badge> },
                { key: "endpoint", header: "Endpoint", render: (row) => <span className="font-mono text-xs">{row.baseUrl ?? (isConnectedProviderType(row.type) ? "default" : "manual")}</span> },
                { key: "model", header: "Default model", render: (row) => row.defaultModel ?? "—" },
                { key: "credential", header: "Credential", render: (row) => isConnectedProviderType(row.type) ? <Badge tone={row.apiKeyEncrypted ? "success" : "warning"}>{row.apiKeyEncrypted ? "stored" : "missing"}</Badge> : <span className="text-xs text-muted">none</span> },
                { key: "enabled", header: "Provider state", render: (row) => <Badge tone={row.enabled ? "success" : "neutral"}>{row.enabled ? "enabled" : "disabled"}</Badge> },
                {
                  key: "actions",
                  header: "Actions",
                  render: (row) => (
                    <div className="flex flex-wrap items-start gap-2">
                      {isConnectedProviderType(row.type) && row.apiKeyEncrypted ? <AiProviderTestButton providerId={row.id} /> : null}
                      <Link href={`/settings?provider=${row.id}#providers`} className="focus-ring inline-flex h-8 items-center rounded-[var(--ln-radius-control-lg)] border border-hairline px-3 text-xs font-medium text-moss hover:bg-warm">Edit</Link>
                      <form action={setAIProviderEnabled}>
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="enabled" value={row.enabled ? "false" : "true"} />
                        <Button type="submit" size="sm">{row.enabled ? "Disable" : "Enable"}</Button>
                      </form>
                      {row.type !== "manual_copy_paste" ? (
                        <form action={deleteAIProvider}>
                          <input type="hidden" name="id" value={row.id} />
                          <Button type="submit" size="sm" variant="destructive">Delete</Button>
                        </form>
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />
            <div className="rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-warm p-4">
              <h3 className="text-sm font-semibold text-ink">{providerFormValues ? `Edit provider · ${providerFormValues.name}` : "Add a connected provider"}</h3>
              <p className="mt-1 mb-4 text-xs leading-5 text-muted">Keys are encrypted with LABNEST_AI_ENCRYPTION_KEY before they are stored and are only decrypted on the server for a request. Only explicit entry text is ever sent to the model.</p>
              <AiProviderForm key={providerFormValues?.id ?? "new"} provider={providerFormValues} />
            </div>
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
                className="focus-ring inline-flex h-10 shrink-0 items-center justify-center rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface px-4 text-sm font-medium text-moss transition hover:bg-warm"
              >
                Download backup.json
              </a>
            </CardBody>
          </Card>
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
