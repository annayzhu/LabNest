import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ConvertProtocolForm } from "@/components/ConvertProtocolForm";
import { PageHeader } from "@/components/PageHeader";
import { ProtocolDocumentView } from "@/components/ProtocolDocumentView";
import { buttonStyles } from "@/components/ui/Button";
import { prisma } from "@/lib/db";
import { protocolCompatibilityIssue } from "@/lib/protocol-compatibility";
import { conversionSummaryText, convertLegacyProtocol, isLegacyProtocol } from "@/lib/protocol-conversion";
import { storedProtocolDocument } from "@/lib/protocol-document";
import { nextFreeDisplayVersion } from "@/lib/protocol-revision.server";

export const dynamic = "force-dynamic";

/** 转换为步骤块: what an old-format Protocol becomes, shown before anything is saved. */
export default async function ConvertProtocolPage({ params }: { params: Promise<{ id: string; versionId: string }> }) {
  const { id, versionId } = await params;
  const version = await prisma.protocolVersion.findFirst({ where: { id: versionId, protocolId: id }, include: { protocol: { include: { versions: { select: { displayVersion: true, revision: true }, orderBy: { revision: 'desc' } } } } } });
  if (!version) notFound();
  const back = <Link href={`/protocols/${id}/versions/${versionId}/edit`} className={buttonStyles({ size: "md", className: "bg-surface font-medium text-moss hover:bg-warm" })}><ArrowLeft className="h-4 w-4" aria-hidden />返回编辑</Link>;
  const title = version.protocol.canonicalTitle ?? version.protocol.title;
  const issue = protocolCompatibilityIssue(version.contentJson);
  if (issue) return <AppShell><div className="space-y-4"><PageHeader identifier={version.protocol.humanCode} title="转换为步骤块" actions={back} /><p className="text-sm text-warning">{issue}</p></div></AppShell>;
  const document = storedProtocolDocument(version);
  if (!isLegacyProtocol(document)) return <AppShell><div className="space-y-4"><PageHeader identifier={version.protocol.humanCode} title="转换为步骤块" actions={back} /><p className="text-sm text-graphite">v{version.displayVersion} 已经是步骤块，不需要转换。</p></div></AppShell>;
  // Ids here are only for the preview; the saved draft gets its own.
  let n = 0;
  const { document: converted, summary } = convertLegacyProtocol(document, prefix => `${prefix}-preview-${++n}`);
  const latest = version.protocol.versions[0];
  const nextVersion = nextFreeDisplayVersion(latest?.displayVersion ?? version.displayVersion, new Set(version.protocol.versions.map(item => item.displayVersion)));
  const listed = (items: string[]) => `${items.slice(0, 24).join("、")}${items.length > 24 ? ` 等 ${items.length} 个` : ""}`;
  return <AppShell>
    <div className="space-y-5">
      <PageHeader identifier={`${version.protocol.humanCode} · v${version.displayVersion}`} title={`转换为步骤块 · ${title}`} actions={back} />
      <section className="space-y-3 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4" aria-label="转换结果">
        <h2 className="text-sm font-semibold text-ink">{conversionSummaryText(summary)}</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-graphite">
          <li>每个旧步骤成为一个步骤块，下面的清单、段落和表格留在这一步里；{summary.notes ? `步骤之间的 ${summary.notes} 段说明保持为说明。` : "没有步骤之间的说明。"}</li>
          <li>{summary.chips.length ? `识别出的参数块：${listed(summary.chips)}。执行时按参数块显示和记录，可在编辑器里改。` : "没有识别出数值。"}</li>
          {summary.keptAsText.length ? <li>按规格保持为文字：{listed(summary.keptAsText)}（后面跟着管、板、皿、柱等）。</li> : null}
          <li>{summary.formulaRows ? `旧公式表 ${summary.formulaRows} 行并入材料表（名称 / 用量 / 说明）。` : "没有需要并入材料表的公式行。"}{summary.alreadyListed.length ? `已在材料表里的 ${listed(summary.alreadyListed)} 没有重复添加。` : ""}</li>
          <li>{summary.resultTemplates ? `${summary.resultTemplates} 个结果模板保持不变，以“记录：…”显示。` : "没有结果模板。"}</li>
        </ul>
        <ConvertProtocolForm versionId={version.id} nextVersion={nextVersion} />
      </section>
      <ProtocolDocumentView document={converted} title={title} identifier={version.protocol.humanCode} version={`转换预览 · 将存为 v${nextVersion}`} />
    </div>
  </AppShell>;
}
