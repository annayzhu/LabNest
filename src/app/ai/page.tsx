import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { AISettingsPanel } from "@/components/AISettingsPanel";
import { AiProviderForm, type AiProviderFormValues, type ChatGPTSignInEntry } from "@/components/AiProviderForm";
import { AiProviderTestButton } from "@/components/AiProviderTestButton";
import { ChatGPTModelForm } from "@/components/ChatGPTModelForm";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { isConnectedProviderType, providerTypeLabels, type AIProviderType } from "@/lib/ai";
import { describeEncryptionKey } from "@/lib/ai-crypto";
import { visionFromSettings, type AIProviderRecord } from "@/lib/ai-server";
import { chatGPTSignInMessages, loopbackPort, readRegistration, type ChatGPTModel } from "@/lib/chatgpt-auth";
import { prisma } from "@/lib/db";
import { localeCookieName, resolveAppLocale, translateUiText } from "@/lib/i18n";
import { deleteAIProvider, setAIProviderEnabled, signOutOfChatGPT } from "../settings/actions";

export const dynamic = "force-dynamic";
// The tab title is outside the page translator.
export async function generateMetadata(): Promise<Metadata> {
  return { title: translateUiText("AI settings · LabNest", resolveAppLocale((await cookies()).get(localeCookieName)?.value)) };
}
export default async function AIPage({ searchParams }: { searchParams?: Promise<{ provider?: string; saved?: string; chatgpt?: string }> }) {
  const query = await searchParams;
  let providers, settings;
  try {
    [providers, settings] = await Promise.all([
      prisma.aIProvider.findMany({ orderBy: { name: "asc" }, include: { session: { select: { modelsJson: true } } } }),
      prisma.aISettings.findUnique({ where: { id: "default" }, select: { defaultProviderId: true, visionProviderId: true } }),
    ]);
  }
  catch { return <AppShell><PageHeader title="AI settings" description="Model connections and AI feature settings." /><p role="alert" className="mt-4 text-sm text-error">Cannot read the connection settings; saved settings are unchanged.<Link prefetch={false} className="focus-ring ml-2 underline" href="/ai">Try again</Link></p></AppShell>; }
  const editing = providers.find(provider => provider.id === query?.provider && provider.type !== "chatgpt_subscription");
  const values: AiProviderFormValues | undefined = editing ? { id: editing.id, revision: editing.updatedAt.toISOString(), name: editing.name, type: editing.type as AiProviderFormValues["type"], baseUrl: editing.baseUrl ?? "", defaultModel: editing.defaultModel ?? "", enabled: editing.enabled, hasStoredKey: Boolean(editing.apiKeyEncrypted) } : undefined;
  const encryption = describeEncryptionKey();
  // OpenAI returns a ChatGPT sign-in only to 127.0.0.1, so elsewhere the page says where to open it instead.
  const host = (await headers()).get("host");
  const chatGPT: ChatGPTSignInEntry = loopbackPort(host) ? { href: "/api/ai/chatgpt/start" } : { localUrl: `http://127.0.0.1:${host?.match(/:(\d{1,5})$/)?.[1] ?? "3001"}/ai` };
  const outcome = query?.chatgpt ? chatGPTSignInMessages[query.chatgpt as keyof typeof chatGPTSignInMessages] : undefined;
  // Which card does what: the default service, and the one that reads pictures (chosen, or the default when it can see).
  const record = (id?: string | null) => providers.find(provider => provider.id === id) as AIProviderRecord | undefined;
  const defaultId = settings?.defaultProviderId;
  const picturesId = visionFromSettings({ enabled: true, defaultProvider: record(defaultId) ?? null, visionProvider: record(settings?.visionProviderId) ?? null }).providerId;
  const roles = (id: string) => <>{id === defaultId ? <Badge tone="sage">Default</Badge> : null}{id === picturesId ? <Badge tone="info">Reads pictures</Badge> : null}</>;

  const services = <section id="providers" className="scroll-mt-20 space-y-3 border-t border-hairline pt-4" aria-label="Model services">
    <h2 className="text-base font-semibold text-ink">Model services</h2>
    {query?.saved ? <p role="status" className="text-sm text-muted">Model service settings saved</p> : null}
    {outcome ? <p role={outcome.ok ? "status" : "alert"} className={outcome.ok ? "text-sm text-muted" : "rounded-[var(--ln-radius-control-lg)] bg-error-surface p-3 text-sm text-error"}>{outcome.message}</p> : null}
    {!encryption.configured || encryption.placeholder ? <p className="text-sm text-warning">Configure the server encryption key first to store API keys safely.</p> : null}
    {providers.length === 0 ? <p className="text-sm text-muted">No model service yet. Add one below.</p> : <div className="grid gap-3 md:grid-cols-2">
      {providers.map(provider => provider.type === "chatgpt_subscription" ? <ChatGPTServiceCard key={provider.id} provider={provider} roles={roles(provider.id)} /> : <KeyServiceCard key={provider.id} provider={provider} roles={roles(provider.id)} />)}
    </div>}
    {/* Collapsed once services exist; open to add the first one or to edit. */}
    <details id="add-service" open={!providers.length || Boolean(values)} className="group scroll-mt-20 rounded-[var(--ln-radius-panel-inner)] border border-hairline">
      <summary className="focus-ring flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden"><Plus className="h-4 w-4 text-muted transition-transform group-open:rotate-45" aria-hidden />{values ? `Edit model service · ${values.name}` : "New model service"}</summary>
      <div className="space-y-3 border-t border-hairline p-3"><p className="text-xs leading-5 text-muted">Keys stay encrypted on the server and are never shown on the page. Saving the setup does not connect to the model.</p><AiProviderForm key={values?.id ?? "new"} provider={values} chatGPT={chatGPT} /></div>
    </details>
  </section>;

  return <AppShell><div className="mx-auto max-w-5xl space-y-5">
    <PageHeader title="AI settings" />
    <p className="text-sm text-muted">Model connections and AI feature settings. Suggestions waiting for you are shown on each entry and experiment.</p>
    <AISettingsPanel providers={providers.map(({ id, name }) => ({ id, name }))} services={services} />
  </div></AppShell>;
}

/** One model service: name, role and state; what it is; where it connects; then its buttons, the one that removes it on the right. */
function ServiceCard({ id, name, badges, meta, detail, children, actions, remove }: { id: string; name: string; badges: ReactNode; meta: string; detail: ReactNode; children?: ReactNode; actions: ReactNode; remove?: ReactNode }) {
  return <article data-provider-row={id} className="flex min-w-0 flex-col gap-2 rounded-[var(--ln-radius-panel-inner)] border border-hairline p-3">
    <div className="flex flex-wrap items-center gap-2"><h3 className="min-w-0 flex-1 break-words text-sm font-semibold">{name}</h3>{badges}</div>
    <p className="text-xs text-muted">{meta}</p>
    {detail}
    {children}
    <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">{actions}{remove ? <div className="ml-auto">{remove}</div> : null}</div>
  </article>;
}

type KeyProviderRow = { id: string; name: string; type: string; enabled: boolean; baseUrl: string | null; defaultModel: string | null; apiKeyEncrypted: string | null; updatedAt: Date };

/** A service reached with an API key (or manual copy and paste, which has none). */
function KeyServiceCard({ provider, roles }: { provider: KeyProviderRow; roles: ReactNode }) {
  const connected = isConnectedProviderType(provider.type);
  const label = providerTypeLabels[provider.type as AIProviderType];
  return <ServiceCard id={provider.id} name={provider.name}
    badges={<>{roles}{connected && !provider.apiKeyEncrypted ? <Badge tone="warning">No key saved</Badge> : null}<Badge tone={provider.enabled ? "neutral" : "warning"}>{provider.enabled ? "Service enabled" : "Service disabled"}</Badge></>}
    meta={provider.defaultModel ? `${label} · ${provider.defaultModel}` : label}
    detail={<p className="break-all font-mono text-xs text-muted">{provider.baseUrl ?? (connected ? "Default service URL" : "Manual mode")}</p>}
    actions={<>
      {connected && provider.apiKeyEncrypted ? <AiProviderTestButton inline providerId={provider.id} revision={provider.updatedAt.toISOString()} enabled={provider.enabled} /> : null}
      <Link prefetch={false} href={`/ai?provider=${provider.id}#add-service`} className={buttonStyles({ size: "sm" })}>Edit</Link>
      <form action={setAIProviderEnabled}><input type="hidden" name="id" value={provider.id} /><input type="hidden" name="enabled" value={provider.enabled ? "false" : "true"} /><Button type="submit" size="sm">{provider.enabled ? "Disable service" : "Enable service"}</Button></form>
    </>}
    remove={provider.type !== "manual_copy_paste" ? <form action={deleteAIProvider}><input type="hidden" name="id" value={provider.id} /><Button type="submit" size="sm" variant="destructive">Delete</Button></form> : undefined} />;
}

type ChatGPTProviderRow = { id: string; name: string; enabled: boolean; defaultModel: string | null; reasoningEffort: string | null; apiKeyEncrypted: string | null; updatedAt: Date; session: { modelsJson: unknown } | null };

/** A ChatGPT subscription service: the signed-in account and its models, signing in again and out instead of a key form. */
function ChatGPTServiceCard({ provider, roles }: { provider: ChatGPTProviderRow; roles: ReactNode }) {
  const account = readRegistration(provider.apiKeyEncrypted);
  const models = Array.isArray(provider.session?.modelsJson) ? provider.session.modelsJson as ChatGPTModel[] : [];
  const signedIn = Boolean(provider.session && account);
  return <ServiceCard id={provider.id} name={provider.name}
    badges={<>{roles}<Badge tone={provider.enabled && signedIn ? "neutral" : "warning"}>{!signedIn ? "Sign in again" : provider.enabled ? "Service enabled" : "Service disabled"}</Badge></>}
    meta={[providerTypeLabels.chatgpt_subscription, provider.defaultModel, provider.reasoningEffort].filter(Boolean).join(" · ")}
    detail={<p className="text-xs text-muted">{signedIn ? "Uses your ChatGPT plan; no API key." : "The ChatGPT sign-in has ended; sign in again to keep using this service."}</p>}
    actions={<>
      {signedIn ? <AiProviderTestButton inline providerId={provider.id} revision={provider.updatedAt.toISOString()} enabled={provider.enabled} usageNote="Sends one short test message, which counts toward the ChatGPT plan’s usage." /> : null}
      <a href={`/api/ai/chatgpt/start?provider=${provider.id}`} className={buttonStyles({ size: "sm", variant: signedIn ? "secondary" : "primary" })}>Sign in again</a>
      <form action={setAIProviderEnabled}><input type="hidden" name="id" value={provider.id} /><input type="hidden" name="enabled" value={provider.enabled ? "false" : "true"} /><Button type="submit" size="sm">{provider.enabled ? "Disable service" : "Enable service"}</Button></form>
    </>}
    remove={<form action={signOutOfChatGPT}><input type="hidden" name="id" value={provider.id} /><Button type="submit" size="sm" variant="destructive">Sign out of ChatGPT</Button></form>}>
    {signedIn && models.length ? <ChatGPTModelForm key={provider.updatedAt.toISOString()} providerId={provider.id} models={models} model={provider.defaultModel} effort={provider.reasoningEffort} /> : null}
  </ServiceCard>;
}
