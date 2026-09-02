"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { StandaloneDocumentEditorViewport } from "@/components/DocumentEditorViewport";
import { DocumentPageHeader, type DocumentPageHeaderFact } from "@/components/DocumentPageHeader";
import { DocumentPrintButton } from "@/components/DocumentPrintButton";
import { ScientificWysiwygEditor } from "@/components/ScientificWysiwygEditor";
import type { ScientificDocument } from "@/lib/scientific-document";
import type { DocumentInsertProfile } from "@/lib/document-editor-workbench";
import { scientificDocumentOutline } from "@/lib/document-outline";

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
  hiddenSectionKeys = [],
  insertProfile,
  checklist,
}: {
  initialDocument: ScientificDocument;
  name?: string;
  compact?: boolean;
  documentType?: string;
  identifier?: string | null;
  title?: string | null;
  titlePlaceholder?: string;
  subtitle?: string | null;
  headerFacts?: DocumentPageHeaderFact[];
  leadingContent?: ReactNode;
  hiddenSectionKeys?: string[];
  insertProfile?: DocumentInsertProfile;
  checklist?: boolean;
}) {
  const [document, setDocument] = useState(initialDocument);
  const serialized = useMemo(() => JSON.stringify(document), [document]);
  const outline = useMemo(() => scientificDocumentOutline(document, hiddenSectionKeys), [document, hiddenSectionKeys]);
  const toolbarHostId = `${useId()}-scientific-document-toolbar`;

  return <>
    <input type="hidden" name={name} value={serialized} />
    <StandaloneDocumentEditorViewport
        label={title?.trim() || "Structured scientific document editor"}
        outline={outline}
        toolbar={<><div id={toolbarHostId} className="ln-document-toolbar-host" /><DocumentPrintButton /></>}
      >
        <DocumentPageHeader
          documentType={documentType}
          identifier={identifier}
          title={title}
          titlePlaceholder={titlePlaceholder}
          subtitle={subtitle}
          facts={headerFacts}
        />
        {leadingContent}
        <ScientificWysiwygEditor
          document={document}
          toolbarHostId={toolbarHostId}
          hiddenSectionKeys={hiddenSectionKeys}
          insertProfile={insertProfile}
          checklist={checklist}
          onChange={setDocument}
        />
    </StandaloneDocumentEditorViewport>
  </>;
}
