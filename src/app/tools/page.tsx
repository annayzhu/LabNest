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
        <div className="flex flex-col gap-3 border-b border-hairline pb-4 md:flex-row md:items-end md:justify-between">
          <h1 className="tools-page-title font-serif text-[length:var(--ln-page-title-size)] font-medium leading-[1.25] tracking-[-0.012em] text-ink">
            Tools
          </h1>
          <p className="max-w-[68ch] text-sm leading-6 text-graphite md:text-right">
            Planning, calculation, and analysis tools in one compact workspace.
          </p>
        </div>

        <ToolsCatalog tools={orderedTools} />

        <p className="text-xs leading-5 text-muted">
          External applications open in a separate tab. LabNest-managed tools stay in this workspace.
        </p>
      </div>
    </AppShell>
  );
}
