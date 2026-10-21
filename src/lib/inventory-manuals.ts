import { MAX_ATTACHMENT_BYTES } from './attachment-limits';

/** A product manual kept on an inventory item: the files a manual comes as. */
export const MANUAL_FILE_PATTERN = /\.(pdf|docx?|txt|md)$/i;

/** Why a chosen file cannot be kept as a manual, or undefined when it can. */
export function manualFileProblem(file: { name: string; size: number }) {
  if (!file.size) return 'Choose the manual file';
  if (!MANUAL_FILE_PATTERN.test(file.name)) return 'A manual can be a PDF, Word, text or Markdown file';
  if (file.size > MAX_ATTACHMENT_BYTES) return 'The file is larger than 25 MB';
}
