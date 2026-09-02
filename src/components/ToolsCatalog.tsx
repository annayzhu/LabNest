"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Binary,
  Calculator,
  ChartSpline,
  Dna,
  Eye,
  Grid3X3,
  Table2,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import type { LabToolCategory, LabToolManifestItem } from "@/lib/tool-manifest";

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
  calculator: { icon: Calculator, iconClassName: "bg-action-surface text-action", tileClassName: "md:col-span-2 xl:col-span-4" },
  "free-plate-layout": { icon: Table2, iconClassName: "bg-success-surface text-success", tileClassName: "md:col-span-2 xl:col-span-2" },
  "qpcr-plate-layout": { icon: Grid3X3, iconClassName: "bg-info-surface text-info", tileClassName: "xl:col-span-1" },
  "cnv-plate-layout": { icon: Dna, iconClassName: "bg-pale-sand text-clay", tileClassName: "xl:col-span-1" },
  "visualization-studio": { icon: ChartSpline, iconClassName: "bg-action-surface text-action", tileClassName: "md:col-span-2 xl:col-span-2" },
  "qpcr-analysis": { icon: Activity, iconClassName: "bg-info-surface text-info", tileClassName: "xl:col-span-1" },
  "cnv-analysis": { icon: Binary, iconClassName: "bg-pale-sand text-clay", tileClassName: "xl:col-span-1" },
};

const categoryOrder: LabToolCategory[] = ["Planning", "Calculators", "Analysis"];

function ToolPreviewModal({ tool, onClose }: { tool: LabToolManifestItem; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const presentation = toolPresentation[tool.id] ?? defaultToolPresentation;
  const Icon = presentation.icon;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]")];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="ln-tool-modal-layer fixed inset-0 z-[70] grid place-items-center p-3 sm:p-6">
      <button type="button" aria-label="Close tool preview" className="ln-tool-modal-backdrop absolute inset-0 bg-ink/25 backdrop-blur-[2px]" onClick={onClose} />
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`tool-preview-${tool.id}`} className="ln-tool-modal-card relative z-10 w-full max-w-2xl overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface shadow-soft">
        <div className="flex items-start justify-between gap-4 border-b border-hairline p-4 sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--ln-radius-control-lg)] ${presentation.iconClassName}`}>
              <Icon className="h-5 w-5" strokeWidth={1.7} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">{tool.category} · v{tool.version}</p>
              <h2 id={`tool-preview-${tool.id}`} className="mt-1 font-serif text-xl font-medium leading-tight text-ink">{tool.name}</h2>
            </div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--ln-radius-control-md)] border border-hairline bg-warm text-muted hover:text-ink" aria-label="Close preview">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="grid gap-5 p-4 sm:grid-cols-2 sm:p-5">
          <div>
            <h3 className="text-xs font-semibold text-ink">What it does</h3>
            <p className="mt-1.5 text-sm leading-6 text-graphite">{tool.description}</p>
            <p className="mt-3 text-xs leading-5 text-muted">{tool.external ? "Opens as an independent application in a new tab." : "Runs inside the LabNest workspace."}</p>
          </div>
          <dl className="grid content-start gap-3 text-xs">
            <div><dt className="font-semibold text-ink">Input</dt><dd className="mt-1 leading-5 text-graphite">{tool.accepts.join(" · ")}</dd></div>
            <div><dt className="font-semibold text-ink">Output</dt><dd className="mt-1 leading-5 text-graphite">{tool.produces.join(" · ")}</dd></div>
          </dl>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-hairline bg-warm/55 px-4 py-3 sm:px-5">
          <button type="button" onClick={onClose} className="focus-ring h-9 rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-3 text-xs font-medium text-graphite hover:border-border-strong hover:text-ink">Close</button>
          <Link href={tool.launchUrl ?? "#"} target={tool.external ? "_blank" : undefined} rel={tool.external ? "noreferrer" : undefined} className="ln-key-action focus-ring inline-flex h-9 items-center gap-1.5 rounded-[var(--ln-radius-control-md)] border px-3 text-xs font-semibold" onClick={onClose}>
            Open tool <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}

export function ToolsCatalog({ tools }: { tools: LabToolManifestItem[] }) {
  const [previewTool, setPreviewTool] = useState<LabToolManifestItem | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  function openPreview(tool: LabToolManifestItem, trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    setPreviewTool(tool);
  }

  function closePreview() {
    setPreviewTool(null);
    queueMicrotask(() => triggerRef.current?.focus());
  }

  return (
    <>
      <div className="space-y-5">
        {categoryOrder.map((category) => {
          const categoryTools = tools.filter((tool) => tool.category === category);
          return (
            <section key={category} aria-labelledby={`tools-${category.toLowerCase()}`} className="space-y-2">
              <div className="flex items-center gap-3">
                <h2 id={`tools-${category.toLowerCase()}`} className="text-sm font-semibold text-ink">{category}</h2>
                <span className="font-mono text-[10px] tabular-nums text-muted">{categoryTools.length} {categoryTools.length === 1 ? "tool" : "tools"}</span>
                <span className="h-px flex-1 bg-hairline" aria-hidden />
              </div>

              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                {categoryTools.map((tool) => {
                  const presentation = toolPresentation[tool.id] ?? defaultToolPresentation;
                  const Icon = presentation.icon;
                  return (
                    <article key={tool.id} className={`group flex min-h-[156px] flex-col rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-3 transition-colors hover:border-action-border hover:bg-warm ${presentation.tileClassName}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className={`ln-tool-card-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ln-radius-control-lg)] ${presentation.iconClassName}`}><Icon className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden /></div>
                        <span className="font-mono text-[10px] leading-none tabular-nums text-muted">v{tool.version}</span>
                      </div>
                      <div className="mt-3 flex-1">
                        <h3 className="font-serif text-xl font-medium leading-tight tracking-[-0.015em] text-ink">{tool.name}</h3>
                        <p className="mt-1 max-w-[66ch] text-sm leading-5 text-graphite">{tool.description}</p>
                      </div>
                      <div className="mt-3 grid gap-x-2 gap-y-0.5 border-t border-hairline/80 pt-2 text-[11px] leading-4 text-muted sm:grid-cols-[42px_minmax(0,1fr)]">
                        <span className="font-semibold text-graphite">Input</span><span>{tool.accepts.join(" · ")}</span>
                        <span className="font-semibold text-graphite">Output</span><span>{tool.produces.join(" · ")}</span>
                      </div>
                      <div className="mt-2 flex min-h-7 items-end justify-between gap-2">
                        <button type="button" className="ln-tool-preview-trigger focus-ring inline-flex h-7 items-center gap-1.5 rounded-[var(--ln-radius-control-md)] px-1.5 text-[11px] font-semibold text-graphite hover:bg-stone hover:text-ink" onClick={(event) => openPreview(tool, event.currentTarget)}>
                          <Eye className="h-3.5 w-3.5" aria-hidden /> Preview
                        </button>
                        <Link href={tool.launchUrl ?? "#"} target={tool.external ? "_blank" : undefined} rel={tool.external ? "noreferrer" : undefined} aria-label={`Open ${tool.name}${tool.external ? " in a new tab" : ""}`} className="focus-ring flex items-center gap-1.5 rounded-[var(--ln-radius-control-md)] px-1.5 py-1 text-xs font-semibold text-action">
                          Open tool <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      {previewTool ? <ToolPreviewModal tool={previewTool} onClose={closePreview} /> : null}
    </>
  );
}
