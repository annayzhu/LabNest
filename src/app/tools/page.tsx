import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Binary,
  Calculator,
  ChartSpline,
  Dna,
  Grid3X3,
  Table2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { labToolManifest, type LabToolManifestItem } from "@/lib/tool-manifest";

type ToolPresentation = {
  icon: LucideIcon;
  iconClassName: string;
  tileClassName: string;
};

const defaultToolPresentation: ToolPresentation = {
  icon: Wrench,
  iconClassName: "bg-stone text-fog",
  tileClassName: "xl:col-span-1",
};

const toolPresentation: Partial<Record<string, ToolPresentation>> = {
  calculator: {
    icon: Calculator,
    iconClassName: "bg-action-surface text-action",
    tileClassName: "md:col-span-2 xl:col-span-4",
  },
  "free-plate-layout": {
    icon: Table2,
    iconClassName: "bg-success-surface text-success",
    tileClassName: "md:col-span-2 xl:col-span-2",
  },
  "qpcr-plate-layout": {
    icon: Grid3X3,
    iconClassName: "bg-info-surface text-info",
    tileClassName: "xl:col-span-1",
  },
  "cnv-plate-layout": {
    icon: Dna,
    iconClassName: "bg-pale-sand text-clay",
    tileClassName: "xl:col-span-1",
  },
  "visualization-studio": {
    icon: ChartSpline,
    iconClassName: "bg-action-surface text-action",
    tileClassName: "md:col-span-2 xl:col-span-2",
  },
  "qpcr-analysis": {
    icon: Activity,
    iconClassName: "bg-info-surface text-info",
    tileClassName: "xl:col-span-1",
  },
  "cnv-analysis": {
    icon: Binary,
    iconClassName: "bg-pale-sand text-clay",
    tileClassName: "xl:col-span-1",
  },
};

const toolOrder = [
  "free-plate-layout",
  "qpcr-plate-layout",
  "cnv-plate-layout",
  "calculator",
  "visualization-studio",
  "qpcr-analysis",
  "cnv-analysis",
] as const;

const categoryOrder = ["Planning", "Calculators", "Analysis"] as const;

function formatToolDetails(tool: LabToolManifestItem) {
  return {
    input: tool.accepts.join(" · "),
    output: tool.produces.join(" · "),
  };
}

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
          <PageHeader title="Tools" />
          <p className="max-w-[68ch] text-sm leading-6 text-graphite md:text-right">
            Planning, calculation, and analysis tools in one compact workspace.
          </p>
        </div>

        <div className="space-y-5">
          {categoryOrder.map((category) => {
            const categoryTools = orderedTools.filter((tool) => tool.category === category);

            return (
              <section key={category} aria-labelledby={`tools-${category.toLowerCase()}`} className="space-y-2">
                <div className="flex items-center gap-3">
                  <h2 id={`tools-${category.toLowerCase()}`} className="text-sm font-semibold text-ink">
                    {category}
                  </h2>
                  <span className="font-mono text-[10px] tabular-nums text-muted">
                    {categoryTools.length} {categoryTools.length === 1 ? "tool" : "tools"}
                  </span>
                  <span className="h-px flex-1 bg-hairline" aria-hidden />
                </div>

                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                  {categoryTools.map((tool) => {
                    const presentation = toolPresentation[tool.id] ?? defaultToolPresentation;
                    const Icon = presentation.icon;
                    const details = formatToolDetails(tool);

                    return (
                      <Link
                        key={tool.id}
                        href={tool.launchUrl ?? "#"}
                        target={tool.external ? "_blank" : undefined}
                        rel={tool.external ? "noreferrer" : undefined}
                        aria-label={`Open ${tool.name}${tool.external ? " in a new tab" : ""}`}
                        className={`group focus-ring flex min-h-[156px] flex-col rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-3 transition-colors hover:border-action-border hover:bg-warm ${presentation.tileClassName}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ln-radius-control-lg)] ${presentation.iconClassName}`}>
                            <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden />
                          </div>
                          <span className="font-mono text-[10px] leading-none tabular-nums text-muted">
                            v{tool.version}
                          </span>
                        </div>

                        <div className="mt-3 flex-1">
                          <h3 className="font-serif text-xl font-medium leading-tight tracking-[-0.015em] text-ink">
                            {tool.name}
                          </h3>
                          <p className="mt-1 max-w-[66ch] text-sm leading-5 text-graphite">
                            {tool.description}
                          </p>
                        </div>

                        <div className="mt-3 grid gap-x-2 gap-y-0.5 border-t border-hairline/80 pt-2 text-[11px] leading-4 text-muted sm:grid-cols-[42px_minmax(0,1fr)]">
                          <span className="font-semibold text-graphite">Input</span>
                          <span>{details.input}</span>
                          <span className="font-semibold text-graphite">Output</span>
                          <span>{details.output}</span>
                        </div>

                        <div className="mt-2 flex min-h-6 items-end justify-end text-action">
                          <span className="flex items-center gap-1.5 text-xs font-semibold">
                            Open tool
                            <ArrowUpRight
                              className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                              aria-hidden
                            />
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <p className="text-xs leading-5 text-muted">
          External applications open in a separate tab. LabNest-managed tools stay in this workspace.
        </p>
      </div>
    </AppShell>
  );
}
