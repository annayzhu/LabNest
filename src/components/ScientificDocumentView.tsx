import type { ReactNode } from "react";
import { DocumentCanvas } from "@/components/DocumentCanvas";
import { DocumentPrintButton } from "@/components/DocumentPrintButton";
import { ScientificBlockView } from "@/components/ScientificBlockView";
import type { ScientificDocument } from "@/lib/scientific-document";

export function ScientificDocumentView({
  document,
  showEmptySections = false,
  title,
  identifier,
  subtitle,
  leadingContent,
}: {
  document: ScientificDocument;
  showEmptySections?: boolean;
  title?: string;
  identifier?: string | null;
  subtitle?: string | null;
  leadingContent?: ReactNode;
}) {
  const populatedSections = document.sections.filter((section) => section.blocks.length > 0);
  const displayedSections = showEmptySections ? document.sections : populatedSections;

  return (
    <DocumentCanvas toolbar={<DocumentPrintButton />} label={title ?? "Scientific document"}>
      {title ? <header className="mb-10 border-b border-hairline pb-6">
        {identifier ? <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted">{identifier}</p> : null}
        <h1 className="document-page-title mt-2 font-serif font-medium leading-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-3 text-sm leading-6 text-muted">{subtitle}</p> : null}
      </header> : null}
      {leadingContent}
      {displayedSections.length ? displayedSections.map((section) => (
        <section key={section.key} className="document-section">
          <header className="mb-5">
            <h2 className={`document-section-title font-serif font-medium ${section.key === "constraints" ? "text-error" : "text-ink"}`}>{section.title}</h2>
          </header>
          <div>
            {section.blocks.length
              ? section.blocks.map((block) => <div key={block.id} className="document-block"><ScientificBlockView block={block} /></div>)
              : <p className="text-sm italic text-muted">Not recorded.</p>}
          </div>
        </section>
      )) : <p className="text-sm text-muted">No structured sections have been recorded yet.</p>}
    </DocumentCanvas>
  );
}
