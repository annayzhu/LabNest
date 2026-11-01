import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { keepAttachment } from './attachment-files';
import { resolveAttachmentPath } from './attachments';
import { prisma } from './db';
import { checkAnchoredRecognition } from './protocol-anchor-check';
import type { SourcePage } from './protocol-anchors';
import { convertLegacyProtocol, isLegacyProtocol, type ConversionSummary } from './protocol-conversion';
import { projectProtocolDocument, type ProtocolDocument } from './protocol-document';
import { createDraftProtocol } from './protocol-draft.server';
import { checkRecognition, habitTextProtocol, RECOGNITION_PROMPT_VERSION, type RecognitionCheck } from './protocol-recognition';
import type { Outline, RecognitionScope } from './protocol-recognition-scope';
import { readSourceFile, type SourceText } from './protocol-source-text.server';

const newId = (prefix: string) => `${prefix}-${randomUUID()}`;

/** What the recognition page shows: the source, how it was read, the check, and the Protocol it gives. */
export type RecognitionView = {
  sourceId: string; fileName: string; kind: SourceText['kind']; pages?: number; chars: number; warnings: string[];
  /** rules: read as written, no AI; ai: organized by the model; edited: the author's own changes to the text (`model` stays when they edited an AI draft). */
  mode: 'rules' | 'ai' | 'edited';
  habitText: string; check?: RecognitionCheck; summary: ConversionSummary; document: ProtocolDocument; title?: string;
  model?: string; attempts?: number;
  /** template-v1 for a draft organized with source positions (or the author's edit of one); its check reads the cited lines. */
  promptVersion?: string;
  /** The source as the positions number it, for the page's source pane; sent with drafts that carry positions. */
  sourcePages?: SourcePage[];
  /** The first pass and the author's choice, kept so the scope can be changed and an edited draft checked the same way. */
  outline?: Outline; scope?: RecognitionScope;
  /** Characters of the source sent in the second pass (each batch counted). */
  sentChars?: number;
};

/** The uploaded or pasted source, kept as an attachment so every later step reads the same original. */
export const keepRecognitionSource = (file: File) => keepAttachment(file, { targetType: 'protocol_recognition', targetId: randomUUID(), linkType: 'recognition_source' });

/** A kept source and its text; only files kept for recognition can be read this way. */
export async function loadRecognitionSource(sourceId: string) {
  const attachment = await prisma.attachment.findFirst({ where: { id: sourceId, links: { some: { linkType: 'recognition_source' } } } });
  if (!attachment) throw new Error('The original file is missing; upload it again');
  const bytes = new Uint8Array(await readFile(resolveAttachmentPath(attachment.storagePath)));
  return { sourceId, fileName: attachment.originalFilename, source: await readSourceFile(attachment.originalFilename, bytes) };
}
type Loaded = Awaited<ReturnType<typeof loadRecognitionSource>>;

/** A Word file already written as step blocks (one exported from LabNest) is shown as it is. */
function summaryOf(document: ProtocolDocument): ConversionSummary {
  const projection = projectProtocolDocument(document);
  return { steps: projection.steps.length, notes: 0, chips: (document.systems?.parameters ?? []).map(parameter => parameter.id), keptAsText: [],
    systems: (document.systems?.dimensions ?? []).map(dimension => `${dimension.label}：${dimension.options.map(option => option.label).join(' / ')}`),
    conditions: [], formulaRows: 0, alreadyListed: [], resultTemplates: projection.resultTemplates.length, recordLines: 0 };
}

const describe = (loaded: Loaded) => ({ sourceId: loaded.sourceId, fileName: loaded.fileName, kind: loaded.source.kind, pages: loaded.source.pages, chars: loaded.source.text.length, warnings: loaded.source.warnings });

/** Read as written, no AI: a Word file by its own reading, any other text by the habit layout. */
export function readAsWritten(source: SourceText, makeId = newId) {
  if (!source.document) return habitTextProtocol(source.text, makeId);
  const { document, summary } = isLegacyProtocol(source.document) ? convertLegacyProtocol(source.document, makeId) : { document: source.document, summary: summaryOf(source.document) };
  return { document, summary, title: source.title };
}

// Pictures read one by one are paged with form feeds; the text the author may edit shows them as line breaks.
export const rulesView = (loaded: Loaded): RecognitionView => ({ ...describe(loaded), mode: 'rules', habitText: loaded.source.text.replace(/\f/g, '\n'), ...readAsWritten(loaded.source) });

type Organized = Pick<RecognitionView, 'model' | 'attempts' | 'promptVersion' | 'outline' | 'scope' | 'sentChars'>;

/**
 * A draft's check: one organized with positions (template-v1, or the author's edit of it) against the lines it cites,
 * with the pages read as its scope; any other text (a source read as written, then edited) line by line against the whole.
 */
function checkDraft(loaded: Loaded, habitText: string, extra: Organized = {}): RecognitionCheck {
  if (extra.promptVersion !== RECOGNITION_PROMPT_VERSION) return checkRecognition(habitText, loaded.source.text);
  return checkAnchoredRecognition(habitText, loaded.source.sourcePages, { scopePages: extra.scope?.pages, verbatim: extra.scope?.language === 'source' });
}

/** An organized text (the model's, or the author's edit of it), checked line by line and read as a Protocol. */
export function textView(loaded: Loaded, habitText: string, mode: 'ai' | 'edited', extra: Organized = {}): RecognitionView {
  const anchored = extra.promptVersion === RECOGNITION_PROMPT_VERSION;
  return { ...describe(loaded), mode, habitText, check: checkDraft(loaded, habitText, extra), ...habitTextProtocol(habitText, newId), ...extra, ...(anchored ? { sourcePages: loaded.source.sourcePages } : {}) };
}

/**
 * The reading becomes a new draft Protocol: the kept source is linked to its version, and an AI or edited draft records
 * where it came from, the prompt version, and how many lines the check could not find in the original.
 */
export async function saveRecognition(input: { sourceId: string; mode: RecognitionView['mode']; habitText: string; title?: string; model?: string; promptVersion?: string; scope?: RecognitionScope }) {
  const loaded = await loadRecognitionSource(input.sourceId);
  const extra = { promptVersion: input.promptVersion, scope: input.scope };
  const view = input.mode === 'rules' ? rulesView(loaded) : textView(loaded, input.habitText, input.mode, extra);
  const title = input.title?.trim() || view.title || loaded.fileName.replace(/\.[^.]+$/, '');
  // An author's edit of a model's draft is still AI work: it keeps the model, the prompt version and the AI source type.
  const ai = input.mode === 'ai' || (input.mode === 'edited' && Boolean(input.model));
  const edited = input.mode === 'edited' ? '并经人工修改' : '';
  const unverified = view.check?.unverified ?? 0;
  const promptVersion = input.promptVersion === RECOGNITION_PROMPT_VERSION ? RECOGNITION_PROMPT_VERSION : undefined;
  const document: ProtocolDocument = input.mode === 'rules' ? view.document : { ...view.document, provenance: { ...view.document.provenance, fromExperimentIds: view.document.provenance?.fromExperimentIds ?? [],
    recognition: { sourceAttachmentId: loaded.sourceId, ...(ai && input.model ? { model: input.model } : {}), ...(ai && promptVersion ? { promptVersion } : {}), unverified, recognizedAt: new Date().toISOString() } } };
  const sourceType = ai ? 'ai_recognized' as const : loaded.source.kind === 'docx' && input.mode === 'rules' ? 'docx_import' as const : 'manual' as const;
  const changeSummary = ai ? `AI 识别整理${edited}（${input.model ?? '模型'}，${unverified} 行未在原文找到），来源：${loaded.fileName}` : `按写法读取${edited}，来源：${loaded.fileName}`;
  return prisma.$transaction(async tx => {
    const { protocol, version } = await createDraftProtocol(tx, { title, document, sourceType, changeSummary, tags: [ai ? 'AI 识别' : '导入'] });
    await tx.attachmentLink.create({ data: { attachmentId: loaded.sourceId, targetType: 'protocol_version', targetId: version.id, linkType: 'recognition_source' } });
    // Activity entries print their fields as text: keep them flat.
    await tx.activityLog.create({ data: { action: 'protocol_recognition_saved', targetType: 'protocol', targetId: protocol.id, metadataJson: { versionId: version.id, sourceId: loaded.sourceId, fileName: loaded.fileName, mode: input.mode, model: input.model ?? null, promptVersion: promptVersion ?? null, unverified, steps: view.summary.steps } } });
    return { protocolId: protocol.id, versionId: version.id };
  });
}
