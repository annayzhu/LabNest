import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MethodDesignStart, MethodSearchSettingsForm } from "@/components/MethodDesignStart";
import { PageHeader } from "@/components/PageHeader";
import { getAIAvailability } from "@/lib/ai-server";
import { prisma } from "@/lib/db";
import { readMethodSearchSettings } from "@/lib/method-sources/index.server";

export const dynamic = "force-dynamic";
const statusLabels: Record<string, string> = { searching: "检索中", comparing: "比较中", drafted: "已生成草稿" };

/** 方案设计: from an experiment goal to a draft Protocol, through what the group and the open databases already know. */
export default async function MethodDesignPage() {
  const [settings, ai, sessions] = await Promise.all([readMethodSearchSettings(), getAIAvailability(), prisma.methodDesignSession.findMany({ orderBy: { createdAt: "desc" }, take: 12, select: { id: true, goal: true, status: true, createdAt: true } })]);
  return <AppShell>
    <div className="space-y-5">
      <PageHeader identifier="方案设计" title="按实验目标设计方案" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4" aria-label="实验目标"><MethodDesignStart /></section>
        <aside className="space-y-3">
          <MethodSearchSettingsForm settings={settings} />
          <p className="ln-design-note px-1">{ai.enabled && ai.connected ? `方法卡由 ${ai.providerName}${ai.model ? ` · ${ai.model}` : ""} 归纳；每条表述都会与原文核对，对不上的标为未核实。` : `未连接模型（${ai.reason ?? "在 AI 设置中开启"}）：仍可检索与抓取原文，方法卡手工填写。`}</p>
        </aside>
      </div>
      {sessions.length ? <section className="space-y-2" aria-label="最近的设计">
        <h2 className="text-sm font-semibold text-ink">最近的设计</h2>
        <ul className="divide-y divide-hairline rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">{sessions.map(session => <li key={session.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm"><Link href={`/protocols/design/${session.id}`} className="font-medium text-moss hover:underline">{session.goal}</Link><span className="text-xs text-muted">{statusLabels[session.status] ?? session.status} · {session.createdAt.toLocaleDateString()}</span></li>)}</ul>
      </section> : null}
    </div>
  </AppShell>;
}
