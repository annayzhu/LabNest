import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { AISettingsPanel } from "@/components/AISettingsPanel";
import { AiProviderForm, type AiProviderFormValues } from "@/components/AiProviderForm";
import { AiProviderTestButton } from "@/components/AiProviderTestButton";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { isConnectedProviderType, providerTypeLabels, type AIProviderType } from "@/lib/ai";
import { describeEncryptionKey } from "@/lib/ai-crypto";
import { prisma } from "@/lib/db";
import { localeCookieName, resolveAppLocale, translateUiText } from "@/lib/i18n";
import { deleteAIProvider, setAIProviderEnabled } from "../settings/actions";

export const dynamic = "force-dynamic";
// The tab title is outside the page translator.
export async function generateMetadata(): Promise<Metadata> {
  return { title: translateUiText("AI settings · LabNest", resolveAppLocale((await cookies()).get(localeCookieName)?.value)) };
}
export default async function AIPage({ searchParams }: { searchParams?: Promise<{ provider?: string; saved?: string }> }) {
  const query = await searchParams;
  let providers;
  try { providers = await prisma.aIProvider.findMany({ orderBy: { name: "asc" } }); }
  catch { return <AppShell><PageHeader title="AI settings" description="Model connections and AI feature settings." /><p role="alert" className="mt-4 text-sm text-error">Cannot read the connection settings; saved settings are unchanged.<Link prefetch={false} className="focus-ring ml-2 underline" href="/ai">Try again</Link></p></AppShell>; }
  const editing = providers.find(provider => provider.id === query?.provider);
  const values: AiProviderFormValues | undefined = editing ? { id: editing.id, revision: editing.updatedAt.toISOString(), name: editing.name, type: editing.type as AIProviderType, baseUrl: editing.baseUrl ?? "", defaultModel: editing.defaultModel ?? "", enabled: editing.enabled, hasStoredKey: Boolean(editing.apiKeyEncrypted) } : undefined;
  const encryption = describeEncryptionKey();
  return <AppShell><div className="mx-auto max-w-5xl space-y-5">
    <PageHeader title="AI settings" />
    <p className="text-sm text-muted">Model connections and AI feature settings. Suggestions waiting for you are shown on each entry and experiment.</p>
    <AISettingsPanel providers={providers.map(({ id, name }) => ({ id, name }))} />
    <section id="providers" className="scroll-mt-20 space-y-3 border-t border-hairline pt-4" aria-label="Connection settings">
      <h2 className="text-sm font-semibold text-ink">Connection settings</h2>
      {query?.saved ? <p role="status" className="text-sm text-muted">Model service settings saved</p> : null}
      {!encryption.configured || encryption.placeholder ? <p className="text-sm text-warning">Configure the server encryption key first to store API keys safely.</p> : null}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 space-y-3">
          {providers.length === 0 ? <p className="text-sm text-muted">No model service configured yet. Add one alongside or below.</p> : providers.map(provider => <article key={provider.id} data-provider-row={provider.id} className="space-y-2 rounded-[var(--ln-radius-panel-inner)] border border-hairline p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="break-words text-sm font-semibold">{provider.name}</h3><Badge tone={provider.enabled ? "neutral" : "warning"}>{provider.enabled ? "Service enabled" : "Service disabled"}</Badge></div>
            <p className="text-xs text-muted">{provider.defaultModel ? `${providerTypeLabels[provider.type as AIProviderType]} · ${provider.defaultModel}` : providerTypeLabels[provider.type as AIProviderType]}</p>
            <p className="break-all font-mono text-xs text-muted">{provider.baseUrl ?? (isConnectedProviderType(provider.type) ? "Default service URL" : "Manual mode")}</p>
            <p className="text-xs text-muted">{isConnectedProviderType(provider.type) ? (provider.apiKeyEncrypted ? "Key saved · test the connection by hand" : "No key saved yet") : "No API key needed"}</p>
            <div className="flex flex-wrap items-start gap-2">
              {isConnectedProviderType(provider.type) && provider.apiKeyEncrypted ? <AiProviderTestButton providerId={provider.id} revision={provider.updatedAt.toISOString()} enabled={provider.enabled} /> : null}
              <Link prefetch={false} href={`/ai?provider=${provider.id}#providers`} className="focus-ring inline-flex h-8 items-center rounded-[var(--ln-radius-control-lg)] border border-hairline px-3 text-xs text-moss">Edit</Link>
              <form action={setAIProviderEnabled}><input type="hidden" name="id" value={provider.id} /><input type="hidden" name="enabled" value={provider.enabled ? "false" : "true"} /><Button type="submit" size="sm">{provider.enabled ? "Disable service" : "Enable service"}</Button></form>
              {provider.type !== "manual_copy_paste" ? <form action={deleteAIProvider}><input type="hidden" name="id" value={provider.id} /><Button type="submit" size="sm" variant="destructive">Delete</Button></form> : null}
            </div>
          </article>)}
        </div>
        <div className="min-w-0 space-y-3"><h3 className="text-sm font-semibold">{values ? `Edit model service · ${values.name}` : "New model service"}</h3><p className="text-xs leading-5 text-muted">Keys stay encrypted on the server and are never shown on the page. Saving the setup does not connect to the model.</p><AiProviderForm key={values?.id ?? "new"} provider={values} /></div>
      </div>
    </section>
  </div></AppShell>;
}
