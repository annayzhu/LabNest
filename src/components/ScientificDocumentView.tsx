import type { ReactNode } from "react";
import { DocumentCanvas } from "@/components/DocumentCanvas";
import { DocumentOutlineWorkbench } from "@/components/DocumentOutlinePanel";
import { ScientificBlockView } from "@/components/ScientificBlockView";
import type { ScientificDocument } from "@/lib/scientific-document";
import { executionSegments } from "@/lib/experiment-document";
import { ExecutionStepLine } from "@/components/ExecutionRecordSteps";

export function ScientificDocumentView({
  document,
  showEmptySections = false,
  title,
  identifier,
  subtitle,
  leadingContent,
  sectionLeading = {},
}: {
  document: ScientificDocument;
  showEmptySections?: boolean;
  title?: string;
  identifier?: string | null;
  subtitle?: string | null;
  leadingContent?: ReactNode;
  /** Live content at the head of a section, by section key (an experiment's samples in 实验设置与样本); such a section always shows. */
  sectionLeading?: Record<string, ReactNode>;
}) {
  const populatedSections = document.sections.filter((section) => section.blocks.length > 0 || sectionLeading[section.key]);
  const displayedSections = showEmptySections ? document.sections : populatedSections;

  const canvas = <DocumentCanvas label={title ?? "Scientific document"}>
      {title ? <header className="document-page-header">
        {identifier ? <p className="record-identifier text-xs font-semibold uppercase text-muted">{identifier}</p> : null}
        <h1 className="document-page-title mt-2 font-serif font-medium leading-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-3 text-sm leading-6 text-muted">{subtitle}</p> : null}
      </header> : null}
      {leadingContent}
      {displayedSections.length ? displayedSections.map((section) => (
        <section key={section.key} id={`section-${section.key}`} className="document-section">
          <header className="mb-5">
            <h2 style={section.titleFontSizePt ? {fontSize: `${section.titleFontSizePt}pt`} : undefined} className={`document-section-title font-serif font-medium ${section.key === "constraints" ? "text-error" : "text-ink"}`}>{section.title}</h2>
          </header>
          <div>
            {sectionLeading[section.key]}
            {section.blocks.length
              ? executionSegments(section.blocks).map((segment) => segment.kind === "block"
                ? <div key={segment.block.id} className="document-block"><ScientificBlockView block={segment.block} /></div>
                : segment.kind === "step"
                  ? <div key={segment.block.id} className="document-block"><ExecutionStepLine execution={segment.block.execution!}>{segment.details.map((block) => <div key={block.id} className="document-block"><ScientificBlockView block={{ ...block, execution: undefined }} /></div>)}</ExecutionStepLine></div>
                  : <details key={segment.blocks[0].id} className="document-block ln-execution-fold"><summary className="focus-ring">{segment.label}</summary>{segment.blocks.map((block) => <div key={block.id} className="document-block"><ScientificBlockView block={block} /></div>)}</details>)
              : sectionLeading[section.key] ? null : <p className="text-sm italic text-muted">Not recorded.</p>}
          </div>
        </section>
      )) : <p className="text-sm text-muted">No structured sections have been recorded yet.</p>}
    </DocumentCanvas>;
  const outline = displayedSections.map((section) => ({ id: `section-${section.key}`, label: section.title }));
  return outline.length ? <DocumentOutlineWorkbench items={outline} className="document-preview-workbench">{canvas}</DocumentOutlineWorkbench> : canvas;
}
