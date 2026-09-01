"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { DocumentCanvas } from "@/components/DocumentCanvas";
import { DocumentPageHeader, type DocumentPageHeaderFact } from "@/components/DocumentPageHeader";
import { DocumentOutlineWorkbench } from "@/components/DocumentOutlinePanel";
import { DocumentPrintButton } from "@/components/DocumentPrintButton";
import { ScientificWysiwygEditor } from "@/components/ScientificWysiwygEditor";
import type { ScientificContentBlock, ScientificDocument } from "@/lib/scientific-document";
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
  allowedBlockTypes,
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
  allowedBlockTypes?: readonly ScientificContentBlock["type"][];
}) {
  const [document, setDocument] = useState(initialDocument);
  const serialized = useMemo(() => JSON.stringify(document), [document]);
  const outline = useMemo(() => scientificDocumentOutline(document, hiddenSectionKeys), [document, hiddenSectionKeys]);
  const toolbarHostId = `${useId()}-scientific-document-toolbar`;

  return <>
    <input type="hidden" name={name} value={serialized} />
    <DocumentOutlineWorkbench items={outline}>
      <DocumentCanvas
        label={title?.trim() || "Structured scientific document editor"}
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
          allowedBlockTypes={allowedBlockTypes}
          onChange={setDocument}
        />
      </DocumentCanvas>
    </DocumentOutlineWorkbench>
  </>;
}
