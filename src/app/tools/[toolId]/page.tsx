import Link from "next/link";
import { notFound } from "next/navigation";
import { labToolManifest } from "@/lib/tool-manifest";
import { EmbeddedLabTool } from "@/components/EmbeddedLabTool";
const embeddedIds = new Set(["qpcr-plate-layout", "cnv-plate-layout", "qpcr-analysis", "cnv-analysis"]);
export default async function Page({ params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = await params;
  const tool = labToolManifest.find(item => item.id === toolId);
  if (!tool || !embeddedIds.has(toolId)) notFound();
  return <main className="embedded-tool-workspace flex min-h-dvh flex-col bg-surface"><header className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-2"><h1 className="text-base font-semibold">{tool.name}</h1><Link className="focus-ring inline-flex min-h-11 items-center text-sm text-moss" href="/tools">返回工具目录</Link></header><EmbeddedLabTool id={toolId} title={tool.name} fullPage /></main>;
}
