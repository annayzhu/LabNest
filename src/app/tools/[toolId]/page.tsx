import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { labToolManifest } from "@/lib/tool-manifest";
import { EmbeddedLabTool } from "@/components/EmbeddedLabTool";
const embeddedIds = new Set(["qpcr-plate-layout", "cnv-plate-layout", "qpcr-analysis", "cnv-analysis"]);
export default async function Page({ params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = await params;
  const tool = labToolManifest.find(item => item.id === toolId);
  if (!tool || !embeddedIds.has(toolId)) notFound();
  return <AppShell><div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-lg font-semibold">{tool.name}</h1><Link className="focus-ring inline-flex min-h-11 items-center text-sm text-moss" href="/tools">返回工具目录</Link></div><EmbeddedLabTool id={toolId} title={tool.name} /></div></AppShell>;
}
