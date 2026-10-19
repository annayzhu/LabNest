import { MAX_ATTACHMENT_BYTES } from './attachment-limits';
import { createScientificDocument, resultSections } from './scientific-document';

/**
 * 分析结果: a workbook exported from the qPCR or CNV analysis tool becomes a result of the experiment, with the file
 * under 数据与媒体. LabNest keeps the file as it is and reads none of its values; the tool stays the place to analyse.
 */
export const analysisTools = { 'qpcr-analysis': 'qPCR 分析', 'cnv-analysis': 'CNV 分析' } as const;
export type AnalysisTool = keyof typeof analysisTools;
export const isAnalysisTool = (value: string): value is AnalysisTool => Object.hasOwn(analysisTools, value);

/** Why a chosen file cannot be added, or undefined when it can. */
export function workbookProblem(file: { name: string; size: number }) {
  if (!file.size) return '请选择导出的工作簿';
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return '只接受分析工作台导出的 .xlsx、.xls 或 .csv 文件';
  if (file.size > MAX_ATTACHMENT_BYTES) return '文件不能超过 25 MB';
}

/** The result's body: the result sections, with the workbook as a file under 数据与媒体. */
export function analysisResultDocument(attachment: { id: string; name: string; type: string; size: number }, toolLabel: string) {
  const document = createScientificDocument(resultSections);
  document.sections.find(section => section.key === 'data_media')!.blocks.push({
    id: `media-${attachment.id}`, type: 'media', mediaType: 'file', url: `/api/attachments/${attachment.id}`, attachmentId: attachment.id,
    filename: attachment.name, mimeType: attachment.type || undefined, size: attachment.size, caption: `${toolLabel}工作台导出的工作簿（未读取其中数值）`,
  });
  return document;
}
