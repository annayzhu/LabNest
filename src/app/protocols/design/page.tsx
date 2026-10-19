import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MethodDesignStart, MethodSearchSettingsForm } from "@/components/MethodDesignStart";
import { PageHeader } from "@/components/PageHeader";
import { getAIAvailability } from "@/lib/ai-server";
import { prisma } from "@/lib/db";
import { readMethodSearchSettings } from "@/lib/method-sources/index.server";

export const dynamic = "force-dynamic";
const statusLabels: Record<string, string> = { searching: "Searching methods", comparing: "Comparing methods", drafted: "Draft generated" };

/** 方案设计: from an experiment goal to a draft Protocol, through what the group and the open databases already know. */
export default async function MethodDesignPage() {
  const [settings, ai, sessions] = await Promise.all([readMethodSearchSettings(), getAIAvailability(), prisma.methodDesignSession.findMany({ orderBy: { createdAt: "desc" }, take: 12, select: { id: true, goal: true, status: true, createdAt: true } })]);
  return <AppShell>
    <div className="space-y-5">
      <PageHeader identifier="Method design" title="Design a Protocol from an experiment goal" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4" aria-label="Experiment goal"><MethodDesignStart /></section>
        <aside className="space-y-3">
          <MethodSearchSettingsForm settings={settings} />
          <p className="ln-design-note px-1">{ai.enabled && ai.connected ? `Method cards are summarized by ${ai.providerName}${ai.model ? ` · ${ai.model}` : ""}; every statement is checked against the original, and those that don’t match are marked unverified.` : `No model connected (${ai.reason ?? "turn it on in AI settings"}): you can still search and fetch the original texts, and fill in method cards by hand.`}</p>
        </aside>
      </div>
      {sessions.length ? <section className="space-y-2" aria-label="Recent designs">
        <h2 className="text-sm font-semibold text-ink">Recent designs</h2>
        <ul className="divide-y divide-hairline rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">{sessions.map(session => <li key={session.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm"><Link href={`/protocols/design/${session.id}`} className="font-medium text-moss hover:underline">{session.goal}</Link><span className="text-xs text-muted">{statusLabels[session.status] ?? session.status} · {session.createdAt.toLocaleDateString()}</span></li>)}</ul>
      </section> : null}
    </div>
  </AppShell>;
}
