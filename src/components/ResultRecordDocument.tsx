import { DocumentCanvas } from "@/components/DocumentCanvas";
import { DocumentOutlineWorkbench } from "@/components/DocumentOutlinePanel";
import { ResultTemplateView } from "@/components/ResultTemplateView";
import { ScientificBlockView } from "@/components/ScientificBlockView";
import { scientificBlockHasContent } from "@/lib/cell-editor";
import { normalizeResultTemplate } from "@/lib/result-templates";
import type { ScientificDocument } from "@/lib/scientific-document";
import { resultDocumentWithLegacyValues } from "@/lib/result-document";

type ResultDatasetDocumentItem = {
  id: string;
  name: string;
  sourceFileName: string | null;
  storageMode: string;
  templateDatasetKey: string | null;
  validationStatus: string;
  columnsJson: unknown;
  previewJson: unknown;
};

type ResultAttachmentDocumentItem = {
  id: string;
  linkType: string;
  attachment: { originalFilename: string; size: number };
};

export function ResultRecordDocument({
  title,
  qualityStatus,
  template,
  values,
  validationStatus,
  validation,
  datasets,
  attachments,
  document,
  numericValue,
  unit,
  textValue,
  notes,
  legacyValuesPromoted = false,
}: {
  title: string;
  qualityStatus: string;
  template?: unknown;
  values: unknown;
  validationStatus: string;
  validation: unknown;
  datasets: ResultDatasetDocumentItem[];
  attachments: ResultAttachmentDocumentItem[];
  document: ScientificDocument;
  numericValue?: number | null;
  unit?: string | null;
  textValue?: string | null;
  notes?: string | null;
  legacyValuesPromoted?: boolean;
}) {
  const normalizedTemplate = template ? normalizeResultTemplate(template) : undefined;
  const displayDocument = legacyValuesPromoted ? document : resultDocumentWithLegacyValues(document, { numericValue, unit, textValue, notes });
  const narrativeSections = displayDocument.sections.map((section) => ({
    ...section,
    blocks: section.blocks.filter(scientificBlockHasContent),
  })).filter((section) => section.blocks.length);
  const expectedArtifacts = normalizedTemplate?.artifacts ?? [];
  const hasFileIndex = datasets.length > 0 || attachments.length > 0 || expectedArtifacts.length > 0;

  const outline = [
    ...(normalizedTemplate ? [{ id: "section-result-template", label: "Result template" }] : []),
    ...narrativeSections.map((section) => ({ id: `section-${section.key}`, label: section.title })),
    ...(hasFileIndex ? [{ id: "section-result-files", label: "Result files" }] : []),
  ];
  const canvas = <DocumentCanvas className="result-record-document" label={title}>
    <header className="document-page-header">
      <h1 className="document-page-title font-serif font-medium leading-tight text-ink">{title}</h1>
      {qualityStatus !== "pass" || validationStatus !== "valid" ? <p className="mt-1 text-[10px] text-muted">Quality: {qualityStatus.replaceAll("_", " ")} · Template: {validationStatus.replaceAll("_", " ")}</p> : null}
    </header>

    {normalizedTemplate ? <section id="section-result-template"><ResultTemplateView template={normalizedTemplate} values={values} validationStatus={validationStatus} validation={validation} datasets={datasets} includeEmptyFields compactDocument /></section> : null}

    {narrativeSections.map((section) => <section key={section.key} id={`section-${section.key}`} className="document-section">
      <header><h2 className="document-section-title font-serif font-medium text-ink">{section.title}</h2></header>
      <div>{section.blocks.map((block) => <div key={block.id} className="document-block"><ScientificBlockView block={block} /></div>)}</div>
    </section>)}

    {hasFileIndex ? <section id="section-result-files" className="document-section">
      <header><h2 className="document-section-title font-serif font-medium text-ink">Result files</h2></header>
      <ul className="divide-y divide-hairline text-xs">
        {datasets.map((dataset) => <li key={dataset.id} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,1fr)_auto]"><span><strong className="font-medium text-ink">{dataset.name}</strong><span className="ml-2 text-muted">{dataset.sourceFileName ?? dataset.storageMode.replaceAll("_", " ")}</span></span><span className="text-muted">table data · {dataset.validationStatus.replaceAll("_", " ")}</span></li>)}
        {attachments.map((link) => <li key={link.id} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,1fr)_auto]"><strong className="min-w-0 break-all font-medium text-ink">{link.attachment.originalFilename}</strong><span className="text-muted">{link.linkType.startsWith("template_artifact:") ? link.linkType.slice("template_artifact:".length) : "supporting file"} · {(link.attachment.size / 1024).toFixed(1)} KB</span></li>)}
        {expectedArtifacts.filter((artifact) => !attachments.some((link) => link.linkType === `template_artifact:${artifact.key}`)).map((artifact) => <li key={artifact.key} className="grid gap-1 py-2 text-muted sm:grid-cols-[minmax(0,1fr)_auto]"><span>{artifact.label}</span><span>{artifact.required ? "required · not recorded" : "optional · not recorded"}</span></li>)}
      </ul>
    </section> : null}
  </DocumentCanvas>;
  return outline.length ? <DocumentOutlineWorkbench items={outline} className="document-preview-workbench">{canvas}</DocumentOutlineWorkbench> : canvas;
}
