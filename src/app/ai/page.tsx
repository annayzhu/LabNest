import Link from "next/link";
import type { Metadata } from "next";
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
import { deleteAIProvider, setAIProviderEnabled } from "../settings/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI 设置 · LabNest" };
export default async function AIPage({ searchParams }: { searchParams?: Promise<{ provider?: string; saved?: string }> }) {
  const query = await searchParams;
  let providers;
  try { providers = await prisma.aIProvider.findMany({ orderBy: { name: "asc" } }); }
  catch { return <AppShell><PageHeader title="AI 设置" description="模型连接与 AI 功能设置。" /><p role="alert" className="mt-4 text-sm text-error">无法读取连接设置，已保存的设置未改变。<Link prefetch={false} className="focus-ring ml-2 underline" href="/ai">重试</Link></p></AppShell>; }
  const editing = providers.find(provider => provider.id === query?.provider);
  const values: AiProviderFormValues | undefined = editing ? { id: editing.id, revision: editing.updatedAt.toISOString(), name: editing.name, type: editing.type as AIProviderType, baseUrl: editing.baseUrl ?? "", defaultModel: editing.defaultModel ?? "", enabled: editing.enabled, hasStoredKey: Boolean(editing.apiKeyEncrypted) } : undefined;
  const encryption = describeEncryptionKey();
  return <AppShell><div className="mx-auto max-w-5xl space-y-5">
    <PageHeader title="AI 设置" />
    <p className="text-sm text-muted">模型连接与 AI 功能设置。待确认的建议在各条记录和实验里查看。</p>
    <AISettingsPanel providers={providers.map(({ id, name }) => ({ id, name }))} />
    <section id="providers" className="scroll-mt-20 space-y-3 border-t border-hairline pt-4" aria-label="连接设置">
      <h2 className="text-sm font-semibold text-ink">连接设置</h2>
      {query?.saved ? <p role="status" className="text-sm text-muted">模型服务设置已保存</p> : null}
      {!encryption.configured || encryption.placeholder ? <p className="text-sm text-warning">需先配置服务器加密密钥，才能安全保存 API 密钥。</p> : null}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 space-y-3">
          {providers.length === 0 ? <p className="text-sm text-muted">尚未配置模型服务。可在右侧或下方添加。</p> : providers.map(provider => <article key={provider.id} data-provider-row={provider.id} className="space-y-2 rounded-[var(--ln-radius-panel-inner)] border border-hairline p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="break-words text-sm font-semibold">{provider.name}</h3><Badge tone={provider.enabled ? "neutral" : "warning"}>{provider.enabled ? "服务已启用" : "服务已停用"}</Badge></div>
            <p className="text-xs text-muted">{providerTypeLabels[provider.type as AIProviderType]}{provider.defaultModel ? ` · ${provider.defaultModel}` : ""}</p>
            <p className="break-all font-mono text-xs text-muted">{provider.baseUrl ?? (isConnectedProviderType(provider.type) ? "默认服务地址" : "手动模式")}</p>
            <p className="text-xs text-muted">{isConnectedProviderType(provider.type) ? (provider.apiKeyEncrypted ? "密钥已保存 · 连接需手动测试" : "尚未保存密钥") : "无需 API 密钥"}</p>
            <div className="flex flex-wrap items-start gap-2">
              {isConnectedProviderType(provider.type) && provider.apiKeyEncrypted ? <AiProviderTestButton providerId={provider.id} revision={provider.updatedAt.toISOString()} enabled={provider.enabled} /> : null}
              <Link prefetch={false} href={`/ai?provider=${provider.id}#providers`} className="focus-ring inline-flex h-8 items-center rounded-[var(--ln-radius-control-lg)] border border-hairline px-3 text-xs text-moss">编辑</Link>
              <form action={setAIProviderEnabled}><input type="hidden" name="id" value={provider.id} /><input type="hidden" name="enabled" value={provider.enabled ? "false" : "true"} /><Button type="submit" size="sm">{provider.enabled ? "停用" : "启用"}</Button></form>
              {provider.type !== "manual_copy_paste" ? <form action={deleteAIProvider}><input type="hidden" name="id" value={provider.id} /><Button type="submit" size="sm" variant="destructive">删除</Button></form> : null}
            </div>
          </article>)}
        </div>
        <div className="min-w-0 space-y-3"><h3 className="text-sm font-semibold">{values ? `编辑模型服务 · ${values.name}` : "添加模型服务"}</h3><p className="text-xs leading-5 text-muted">密钥沿用服务器加密保存，页面不会回显。保存配置不会连接模型。</p><AiProviderForm key={values?.id ?? "new"} provider={values} /></div>
      </div>
    </section>
  </div></AppShell>;
}
