import { DocumentCanvas } from "@/components/DocumentCanvas";
import { DocumentPrintButton } from "@/components/DocumentPrintButton";
import { ResultTemplateView } from "@/components/ResultTemplateView";
import { ScientificBlockView } from "@/components/ScientificBlockView";
import { scientificBlockHasContent } from "@/lib/cell-editor";
import { normalizeResultTemplate } from "@/lib/result-templates";
import type { ScientificDocument } from "@/lib/scientific-document";

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
  resultType,
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
}: {
  title: string;
  resultType: string;
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
}) {
  const normalizedTemplate = template ? normalizeResultTemplate(template) : undefined;
  const narrativeSections = document.sections.map((section) => ({
    ...section,
    blocks: section.blocks.filter(scientificBlockHasContent),
  })).filter((section) => section.blocks.length);
  const hasSupplementalValues = numericValue !== null && numericValue !== undefined || Boolean(textValue || notes);
  const expectedArtifacts = normalizedTemplate?.artifacts ?? [];
  const hasFileIndex = datasets.length > 0 || attachments.length > 0 || expectedArtifacts.length > 0;

  return <DocumentCanvas
    className="result-record-document"
    toolbar={<><span className="mr-auto text-xs text-muted">完整结果 · 打印或另存为 PDF</span><DocumentPrintButton label="Print / PDF" showLabel /></>}
    label={title}
  >
    <header className="document-page-header">
      <p className="document-page-kicker text-xs font-semibold uppercase tracking-[0.12em] text-muted">{resultType}</p>
      <h1 className="document-page-title mt-2 font-serif font-medium leading-tight text-ink">{title}</h1>
      <p className="mt-2 text-xs text-muted">Quality: {qualityStatus.replaceAll("_", " ")} · Template: {validationStatus.replaceAll("_", " ")}</p>
    </header>

    {normalizedTemplate ? <ResultTemplateView template={normalizedTemplate} values={values} validationStatus={validationStatus} validation={validation} datasets={datasets} includeEmptyFields /> : null}

    {hasSupplementalValues ? <section className="document-section">
      <header><h2 className="document-section-title font-serif font-medium text-ink">Additional result values</h2></header>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {numericValue !== null && numericValue !== undefined ? <div><dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Primary numeric outcome</dt><dd className="mt-1 text-sm text-ink">{numericValue}{unit ? ` ${unit}` : ""}</dd></div> : null}
        {textValue ? <div><dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Summary</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-ink">{textValue}</dd></div> : null}
        {notes ? <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Notes</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-ink">{notes}</dd></div> : null}
      </dl>
    </section> : null}

    {narrativeSections.map((section) => <section key={section.key} className="document-section">
      <header><h2 className="document-section-title font-serif font-medium text-ink">{section.title}</h2></header>
      <div>{section.blocks.map((block) => <div key={block.id} className="document-block"><ScientificBlockView block={block} /></div>)}</div>
    </section>)}

    {hasFileIndex ? <section className="document-section">
      <header><h2 className="document-section-title font-serif font-medium text-ink">Result files</h2></header>
      <ul className="divide-y divide-hairline text-xs">
        {datasets.map((dataset) => <li key={dataset.id} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,1fr)_auto]"><span><strong className="font-medium text-ink">{dataset.name}</strong><span className="ml-2 text-muted">{dataset.sourceFileName ?? dataset.storageMode.replaceAll("_", " ")}</span></span><span className="text-muted">table data · {dataset.validationStatus.replaceAll("_", " ")}</span></li>)}
        {attachments.map((link) => <li key={link.id} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,1fr)_auto]"><strong className="min-w-0 break-all font-medium text-ink">{link.attachment.originalFilename}</strong><span className="text-muted">{link.linkType.startsWith("template_artifact:") ? link.linkType.slice("template_artifact:".length) : "supporting file"} · {(link.attachment.size / 1024).toFixed(1)} KB</span></li>)}
        {expectedArtifacts.filter((artifact) => !attachments.some((link) => link.linkType === `template_artifact:${artifact.key}`)).map((artifact) => <li key={artifact.key} className="grid gap-1 py-2 text-muted sm:grid-cols-[minmax(0,1fr)_auto]"><span>{artifact.label}</span><span>{artifact.required ? "required · not recorded" : "optional · not recorded"}</span></li>)}
      </ul>
    </section> : null}
  </DocumentCanvas>;
}
