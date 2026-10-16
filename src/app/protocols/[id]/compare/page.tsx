import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ProtocolDiffView } from "@/components/ProtocolDiffView";
import { buttonStyles } from "@/components/ui/Button";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { diffProtocolVersions } from "@/lib/protocol-diff";
import { normalizeProtocolDocument } from "@/lib/protocol-document";
import { formInputClass } from "@/components/forms";
import "@/components/protocol-knowledge.css";

export const dynamic = "force-dynamic";

/** 版本对比: `?a=<older>&b=<newer>`; without them, the two latest versions. */
export default async function ProtocolComparePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: PageSearchParams }) {
  const { id } = await params;
  const query = searchParams ? await searchParams : undefined;
  const protocol = await prisma.protocol.findUnique({ where: { id }, include: { versions: { orderBy: { revision: "desc" }, select: { id: true, displayVersion: true, reviewStage: true, contentJson: true, createdAt: true } } } });
  if (!protocol) notFound();
  const pick = (value: string | undefined, fallback: number) => protocol.versions.find(version => version.id === value) ?? protocol.versions[fallback];
  const b = pick(firstSearchParam(query, "b"), 0), a = pick(firstSearchParam(query, "a"), Math.min(1, protocol.versions.length - 1));
  if (!a || !b) notFound();
  const documents = [a, b].map(version => normalizeProtocolDocument(version.contentJson));
  const diff = documents[0] && documents[1] ? diffProtocolVersions(documents[0], documents[1]) : undefined;
  const label = (version: typeof a) => `v${version.displayVersion}`;
  return <AppShell>
    <div className="space-y-5">
      <PageHeader identifier={protocol.humanCode} title={`${protocol.canonicalTitle ?? protocol.title} · 版本对比`}
        actions={<Link href={`/protocols/${protocol.id}?version=${b.id}`} className={buttonStyles({ size: "md", className: "bg-surface font-medium text-moss hover:bg-warm" })}><ArrowLeft className="h-4 w-4" aria-hidden />返回规程</Link>} />
      <form method="get" className="ln-compare-form" aria-label="选择要对比的版本">
        <label>旧版<select name="a" defaultValue={a.id} className={formInputClass}>{protocol.versions.map(version => <option key={version.id} value={version.id}>{label(version)} · {version.reviewStage}</option>)}</select></label>
        <label>新版<select name="b" defaultValue={b.id} className={formInputClass}>{protocol.versions.map(version => <option key={version.id} value={version.id}>{label(version)} · {version.reviewStage}</option>)}</select></label>
        <button type="submit" className={buttonStyles({ size: "md", variant: "primary" })}>对比</button>
      </form>
      {diff ? <ProtocolDiffView diff={diff} before={label(a)} after={label(b)} /> : <p className="text-sm text-warning" role="status">其中一版是旧格式，无法逐块对比；请先在编辑器中打开并保存为当前格式。</p>}
    </div>
  </AppShell>;
}
