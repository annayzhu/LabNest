export const dynamic = "force-dynamic";
import { AppShell } from "@/components/AppShell";
import { ToolsCatalog } from "@/components/ToolsCatalog";
import { labToolManifest, type LabToolManifestItem } from "@/lib/tool-manifest";

const toolOrder = [
  "free-plate-layout",
  "qpcr-plate-layout",
  "cnv-plate-layout",
  "calculator",
  "visualization-studio",
  "qpcr-analysis",
  "cnv-analysis",
] as const;

export default function ToolsPage() {
  const toolsById = new Map(labToolManifest.map((tool) => [tool.id, tool]));
  const featuredTools = toolOrder
    .map((id) => toolsById.get(id))
    .filter((tool): tool is LabToolManifestItem => Boolean(tool));
  const featuredIds = new Set(featuredTools.map((tool) => tool.id));
  const orderedTools = [
    ...featuredTools,
    ...labToolManifest.filter((tool) => !featuredIds.has(tool.id)),
  ];

  return (
    <AppShell>
      <div className="space-y-5">
        <h1 className="tools-page-title text-[length:var(--ln-page-title-size)] font-semibold leading-[1.25] tracking-[-0.018em] text-ink">
          Tools
        </h1>

        <ToolsCatalog tools={orderedTools} />
      </div>
    </AppShell>
  );
}
