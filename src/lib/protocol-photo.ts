/**
 * 照片转写: pictures of a manual or a handwritten Protocol become text, one request per picture, and that text goes
 * through the same reading, AI layout and line check as any pasted text. The pictures themselves are never stored: they
 * live in the page while it is open and in memory while one request runs.
 */
export const MAX_PHOTOS = 50;
/** The longest side a picture is shrunk to before it is sent: sharp enough for print, small enough to upload on a phone. */
export const PHOTO_LONG_EDGE = 2000;
export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** What the model writes for a page with nothing legible, and for a word it cannot make out. */
export const NO_TEXT = '【没有可读文字】';
export const UNCLEAR = '【看不清】';

export const photoPrompt = {
  system: [
    '你是实验室文档的转写助手。图片是一页试剂说明书，或一页打印、手写的实验规程。',
    '规则：',
    '1. 逐字转写图片上能看清的文字，保持原来的顺序、编号和换行；原文是什么语言就写什么语言，不翻译。',
    '2. 表格每一行写成一行，单元格之间用“ | ”隔开。',
    `3. 看不清的字或数值写成“${UNCLEAR}”，不要猜，不要补充，不要推算任何数值。`,
    '4. 页眉、页脚、页码、水印不用转写。',
    `5. 图片上没有可读文字时，只输出“${NO_TEXT}”。`,
    '6. 只输出转写出的文字，不要解释，不要总结，不要代码块。',
  ].join('\n'),
  user: '请转写这一页。',
};

/** The model's answer as plain text: a fence or a lead-in line dropped. */
export function cleanTranscript(text: string) {
  return text.replace(/```[a-z]*\n?/gi, '').replace(/^\s*(?:以下是|转写结果|转写如下)[^\n]*[：:]\s*\n/, '').trim();
}

export const hasText = (transcript: string) => Boolean(transcript.trim()) && transcript.trim() !== NO_TEXT;

/** The pages in the order the author set, joined into one text; a page with nothing legible is left out. */
export function joinTranscripts(pages: { text: string }[]) {
  return pages.map(page => page.text.trim()).filter(hasText).join('\n\n');
}

/** How many `UNCLEAR` marks a text carries: the author checks each against the picture. */
export const unclearCount = (text: string) => text.split(UNCLEAR).length - 1;

/** A file name for the kept text: where the words came from, and that the pictures were not kept. */
export const photoSourceName = (count: number) => `照片转写（${count} 张，照片未存档）.txt`;

/** The size a picture is drawn at: its longest side at most `edge`, never enlarged. */
export function fitWithin(width: number, height: number, edge = PHOTO_LONG_EDGE) {
  const scale = Math.min(1, edge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Why a picture cannot be sent, or undefined when it can. */
export function photoProblem(file: { type: string; size: number }) {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return '只支持 JPEG、PNG 或 WebP 图片';
  if (!file.size) return '图片是空的';
  if (file.size > MAX_PHOTO_BYTES) return '图片太大（上传前会自动缩小，仍超过 6 MB）';
}
