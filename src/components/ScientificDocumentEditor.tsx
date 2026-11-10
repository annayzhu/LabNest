"use client";

import { ToolRecordIntegration } from "./ToolRecordIntegration";
import type { ToolOwner } from "@/lib/tool-workflow";
import { useId, useMemo, useState, type ReactNode } from "react";
import { StandaloneDocumentEditorViewport } from "@/components/DocumentEditorViewport";
import { DocumentPageHeader, type DocumentPageHeaderFact } from "@/components/DocumentPageHeader";
import { DocumentPrintButton } from "@/components/DocumentPrintButton";
import { ScientificDayAddons, ScientificSectionAddons, ScientificWysiwygEditor } from "@/components/ScientificWysiwygEditor";
import type { EditorDayRuns } from "@/lib/scientific-tiptap";
import type { ScientificDocument } from "@/lib/scientific-document";
import type { DocumentInsertProfile } from "@/lib/document-editor-workbench";
import { scientificDocumentOutline } from "@/lib/document-outline";

const noAddons: Record<string, ReactNode> = {};

/**
 * One continuous scientific document editor. The hidden field intentionally
 * remains the original ScientificDocument schema so existing actions, exports,
 * print views, and stored records do not need a database migration.
 */
export function ScientificDocumentEditor({
  initialDocument,
  name = "contentJson",
  documentType,
  identifier,
  title,
  titlePlaceholder,
  subtitle,
  headerFacts,
  leadingContent,
  trailingContent,
  titleEditor,
  hiddenSectionKeys = [],
  insertProfile,
  checklist,
  sectionAddons,
  dayAddons,
  days,
  toolOwner,
}: {
  initialDocument: ScientificDocument;
  toolOwner?: ToolOwner;
  name?: string;
  compact?: boolean;
  documentType?: string;
  identifier?: string | null;
  title?: string | null;
  titlePlaceholder?: string;
  subtitle?: string | null;
  headerFacts?: DocumentPageHeaderFact[];
  leadingContent?: ReactNode;
  trailingContent?: ReactNode;
  titleEditor?: ReactNode;
  hiddenSectionKeys?: string[];
  insertProfile?: DocumentInsertProfile;
  checklist?: boolean;
  /** Read-only content at the top of a section, keyed by section key. */
  sectionAddons?: Record<string, ReactNode>;
  /** The days of 执行记录 and what each shows above its writing (Q427). */
  days?: EditorDayRuns;
  dayAddons?: Record<string, ReactNode>;
}) {
  const [document, setDocument] = useState(initialDocument);
  const serialized = useMemo(() => JSON.stringify(document), [document]);
  const outline = useMemo(() => scientificDocumentOutline(document, hiddenSectionKeys), [document, hiddenSectionKeys]);
  const actionsHostId = `${useId()}-scientific-document-actions`;

  const content = <>
    <input type="hidden" name={name} value={serialized} />
    <StandaloneDocumentEditorViewport
        label={title?.trim() || "Structured scientific document editor"}
        outline={outline}
        toolbar={<><div id={actionsHostId} className="ln-document-actions-host" /><DocumentPrintButton /></>}
      >
        <DocumentPageHeader
          documentType={documentType}
          identifier={identifier}
          title={title}
          titlePlaceholder={titlePlaceholder}
          titleEditor={titleEditor}
          subtitle={subtitle}
          facts={headerFacts}
        />
        {leadingContent}
        <ScientificSectionAddons.Provider value={sectionAddons ?? noAddons}><ScientificDayAddons.Provider value={dayAddons ?? noAddons}>
          <ScientificWysiwygEditor
            days={days}
            document={document}
            actionsHostId={actionsHostId}
            hiddenSectionKeys={hiddenSectionKeys}
            insertProfile={insertProfile}
            checklist={checklist}
            onChange={setDocument}
          />
        </ScientificDayAddons.Provider></ScientificSectionAddons.Provider>
        {trailingContent}
    </StandaloneDocumentEditorViewport>
  </>;
  return toolOwner ? <ToolRecordIntegration owner={toolOwner} title={title} document={document} onChange={setDocument}>{content}</ToolRecordIntegration> : content;
}
