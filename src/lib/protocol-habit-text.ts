import { recordLine } from './protocol-conversion';
import { sectionFromHeading } from './protocol-docx';
import { createEmptyProtocolDocument, protocolSectionKeys, richTextPlainText, type ProtocolContentBlock, type ProtocolDocument, type ProtocolSectionKey } from './protocol-document';

/**
 * Text written by habit, typed, pasted or laid out by the AI: "标题：…", the sections by their usual names, material
 * lines "- 名称 | 用量 | 说明", then steps and results as written. The document it gives is what `convertLegacyProtocol`
 * turns into step blocks, chips and result templates. Text with no section heading at all is read as steps.
 */
export function habitTextToDocument(text: string): { document: ProtocolDocument; title?: string } {
  const document = createEmptyProtocolDocument();
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  let title: string | undefined, current: ProtocolSectionKey | undefined, id = 0;
  // Lines before any heading are the description only when a Steps heading comes later; otherwise they are steps.
  const opening: ProtocolSectionKey = lines.some(line => headingOf(line, undefined)?.key === 'steps') ? 'description' : 'steps';
  const materials: string[][] = [];
  const add = (line: string) => {
    current ??= opening;
    // "记录：…" and "每个样本：…" are what to record: they open the results even inside Steps.
    if (current === 'steps' && recordLine.test(line)) current = 'result_templates';
    const cells = current === 'material' ? line.match(materialLine) : null;
    if (cells) { materials.push([cells[1], ...cells[2].split(/\s*[|｜\t]\s*/)].map(cell => cell.trim())); return; }
    document.sections.find(section => section.key === current)!.blocks.push({ id: `${current}-line-${++id}`, type: 'text', text: line });
  };
  // Without a "标题：" line, a short first line that reads like a name ("XX 总 RNA 提取试剂盒 使用说明书") is the title.
  const named = lines.some(line => /^(?:标题|title)\s*[：:]/i.test(line));
  if (!named && lines[0] && lines[0].length <= 40 && !/[。.!！?？；;：:]$|[：:]/.test(lines[0]) && !/^\s*\d/.test(lines[0]) && !headingOf(lines[0], undefined)) title = lines.shift();
  for (const line of lines) {
    const titled = !title && line.match(/^(?:标题|title)\s*[：:]\s*(.+)$/i);
    if (titled) { title = titled[1].trim(); continue; }
    const heading = headingOf(line, current);
    if (heading) { current = heading.key; if (heading.rest) add(heading.rest); continue; }
    add(line);
  }
  if (materials.length) document.sections.find(section => section.key === 'material')!.blocks.unshift({
    id: 'material-table-habit', type: 'table', caption: '材料', rows: [['名称', '用量', '说明'], ...materials.map(row => [row[0], row[1], row.slice(2).filter(Boolean).join(' ')])],
  });
  return { document, title };
}

/** A document's visible text, section by section, as the model and the line check read it. */
export function documentSourceText(document: ProtocolDocument, title?: string) {
  const parts = title ? [`标题：${title}`] : [];
  for (const section of document.sections) {
    const lines = section.blocks.flatMap(blockLines).map(line => line.trim()).filter(Boolean);
    if (lines.length) parts.push(sectionTitles[section.key], ...lines);
  }
  return parts.join('\n');
}

/** The usual names of the sections: as headings in written text and in the Word template. */
export const sectionTitles: Record<ProtocolSectionKey, string> = { description: '说明', purpose: '目的', background: '背景', material: '材料', steps: '步骤', result_templates: '结果', consumption_rules: '消耗规则' };

/** "- Buffer RL | 350/600 µL | 按体系": a material line, as written in text. */
const materialLine = /^\s*[-•*·]?\s*([^|｜\t]+?)\s*[|｜\t]\s*(.*)$/;

/**
 * A heading line, read only forwards: "步骤" or "步骤：…" opens Steps, but a "说明：…" line inside Steps stays a line
 * of that step (sections come in order, so a heading never sends text back to an earlier section).
 */
function headingOf(line: string, current: ProtocolSectionKey | undefined) {
  const order = (key: ProtocolSectionKey) => protocolSectionKeys.indexOf(key);
  const forward = (key: ProtocolSectionKey | undefined) => key && (!current || order(key) > order(current)) ? key : undefined;
  const exact = forward(sectionFromHeading(line.replace(/[：:]\s*$/, '').trim()));
  if (exact) return { key: exact, rest: '' };
  const inline = line.match(/^([^：:]{1,8})\s*[：:]\s*(.+)$/);
  const key = inline ? forward(sectionFromHeading(inline[1].trim())) : undefined;
  return key && inline ? { key, rest: inline[2].trim() } : undefined;
}

const blockLines = (block: ProtocolContentBlock): string[] => {
  if (block.type === 'heading' || block.type === 'text' || block.type === 'callout') return block.text.split('\n');
  if (block.type === 'rich_text') return richTextPlainText(block.nodes).split('\n');
  if (block.type === 'checklist') return block.items;
  if (block.type === 'table') return block.rows.map(row => row.filter(cell => cell.trim()).join(' | '));
  return [];
};
