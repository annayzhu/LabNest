import type { ReactNode } from "react";
import { DocumentCanvas } from "@/components/DocumentCanvas";
import { DocumentOutlineWorkbench } from "@/components/DocumentOutlinePanel";
import { ScientificBlockView } from "@/components/ScientificBlockView";
import type { ScientificDocument } from "@/lib/scientific-document";

export function ScientificDocumentView({
  document,
  showEmptySections = false,
  title,
  identifier,
  subtitle,
  leadingContent,
  sectionContent = {},
  hideDerivedSections = [],
}: {
  document: ScientificDocument;
  showEmptySections?: boolean;
  title?: string;
  identifier?: string | null;
  subtitle?: string | null;
  leadingContent?: ReactNode;
  sectionContent?: Record<string, ReactNode>;
  hideDerivedSections?: string[];
}) {
  const populatedSections = document.sections.filter((section) => section.blocks.length > 0 || sectionContent[section.key]);
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
            {sectionContent[section.key]}
            {section.blocks.length
              ? section.blocks.filter(block => !hideDerivedSections.includes(section.key) || !block.id.startsWith('run-derived:')).map((block) => <div key={block.id} className="document-block"><ScientificBlockView block={block} /></div>)
              : !sectionContent[section.key] ? <p className="text-sm italic text-muted">Not recorded.</p> : null}
          </div>
        </section>
      )) : <p className="text-sm text-muted">No structured sections have been recorded yet.</p>}
    </DocumentCanvas>;
  const outline = displayedSections.map((section) => ({ id: `section-${section.key}`, label: section.title }));
  return outline.length ? <DocumentOutlineWorkbench items={outline} className="document-preview-workbench">{canvas}</DocumentOutlineWorkbench> : canvas;
}
