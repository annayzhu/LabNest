import type { MethodCard } from './method-card';
import type { MethodHit, MethodText } from './method-sources/types';
import { recognizeQuantity } from './protocol-chips';
import { createEmptyProtocolDocument, type ProtocolContentBlock, type ProtocolDocument, type ProtocolSource } from './protocol-document';
import { blankProtocolSystems, type ProtocolSystems } from './protocol-systems-schema';

/**
 * Every quantity in a line becomes a chip with a fixed value, the way typing it in the editor would.
 * "50/80 µL" (one value per system) stays as text: the author decides the systems in the editor.
 */
export function chipifyText(text: string, systems: ProtocolSystems, newId: (prefix: string) => string) {
  const padded = `${text} `;
  const found = new Map<number, ReturnType<typeof recognizeQuantity> & object>();
  for (let end = 1; end <= padded.length; end += 1) {
    const quantity = recognizeQuantity(padded.slice(0, end));
    if (quantity && !found.has(quantity.index)) found.set(quantity.index, quantity);
  }
  let out = text;
  for (const quantity of [...found.values()].sort((a, b) => b.index - a.index)) {
    if (quantity.values.length !== 1 || quantity.index + quantity.source.length > text.length) continue;
    const id = newId('p');
    systems.parameters.push({ id, label: '', unit: quantity.unit, kind: quantity.kind, origin: 'chip', source: { kind: 'fixed', value: quantity.values[0], unit: quantity.unit } });
    out = `${out.slice(0, quantity.index)}{{${id}}}${out.slice(quantity.index + quantity.source.length)}`;
  }
  return out;
}

const paragraph = (text: string) => ({ type: 'paragraph' as const, content: [{ text }] });
const headerLike = /^(description|materials?|abstract|introduction|background|说明|材料|背景)$/i;
const sourceKind = (hit: MethodHit): ProtocolSource['kind'] => hit.source === 'protocols_io' ? 'protocols_io' : hit.source === 'europe_pmc' ? 'pmc' : hit.source === 'manual' && hit.url ? 'url' : 'other';

export type DesignDraftInput = { goal: string; sampleType?: string; conditions?: string; hit: MethodHit; text: MethodText; card?: MethodCard; sessionId: string; newId: (prefix: string) => string };

/**
 * A draft Protocol from one method: the goal and the source up front, materials and key parameters from the card,
 * each section or paragraph of the method as a step block with its quantities as chips, and a reminder of what is still unverified.
 * Always a draft for a person to tidy and review; nothing here is marked reviewed.
 */
export function designDraft({ goal, sampleType, conditions, hit, text, card, sessionId, newId }: DesignDraftInput): { document: ProtocolDocument; title: string } {
  const document = createEmptyProtocolDocument();
  const systems = blankProtocolSystems();
  document.systems = systems;
  document.executionConfirmed = true;
  const section = (key: ProtocolDocument['sections'][number]['key']) => document.sections.find(item => item.key === key)!;
  const unverified = card?.unverified ?? 0;
  // Sources keep a short license name; a statement longer than the field allows is cut rather than refused.
  const license = (text.license ?? hit.license)?.slice(0, 120);
  section('description').blocks.push(
    { id: newId('callout'), type: 'callout', tone: unverified ? 'warning' : 'note', text: `由方案设计生成的草稿，来源：${hit.title}${license ? `（许可：${license}）` : ''}。${card ? `方法卡 ${unverified ? `有 ${unverified} 条未核实，` : '全部核实，'}` : '未经方法卡归纳，'}采用前请逐步核对原文，确认后再提交审阅。` },
    { id: newId('block'), type: 'rich_text', nodes: [paragraph(`研究目标：${goal}${sampleType ? `；样本：${sampleType}` : ''}${conditions ? `；条件：${conditions}` : ''}`)] },
  );
  if (card?.summary) section('purpose').blocks.push({ id: newId('block'), type: 'rich_text', nodes: [paragraph(card.summary)] });
  const mark = (item: { text: string; verified: boolean }) => `${item.text}${item.verified ? '' : '（未核实）'}`;
  if (card?.applicability.length || card?.sampleRequirements.length || card?.keyParameters.length) {
    const lines = [...(card.applicability.length ? [`适用条件：${card.applicability.map(mark).join('；')}`] : []), ...(card.sampleRequirements.length ? [`样本要求：${card.sampleRequirements.map(mark).join('；')}`] : []), ...(card.keyParameters.length ? [`关键参数：${card.keyParameters.map(mark).join('；')}`] : []), ...(card.duration ? [`用时：${card.duration}`] : [])];
    section('background').blocks.push({ id: newId('block'), type: 'rich_text', nodes: lines.map(paragraph) });
  }
  if (card?.materials.length) section('material').blocks.push({ id: newId('table'), type: 'table', caption: 'Materials', rows: [['Name', 'Unit', 'Role', 'Notes'], ...card.materials.map(item => [item.text, '', '', item.verified ? '' : '未核实'])] });
  // Steps: each section of the method is a step; its further paragraphs stay with it as details.
  const bodySections = text.sections.filter(item => !headerLike.test(item.title.trim()));
  const steps: ProtocolContentBlock[] = [];
  for (const item of bodySections.length ? bodySections : [{ title: '', text: text.text }]) {
    const paragraphs = item.text.split(/\n+/).map(line => line.trim()).filter(Boolean);
    for (const [index, line] of paragraphs.entries()) {
      const chipped = chipifyText(line, systems, newId);
      if (index === 0 || hit.source === 'europe_pmc') { const stepId = newId('step'); steps.push({ id: stepId, type: 'rich_text', nodes: [paragraph(chipped)], execution: { role: 'step', stepId, format: 'block' } }); }
      else steps.push({ id: newId('block'), type: 'rich_text', nodes: [paragraph(chipped)], execution: { role: 'detail', stepId: steps.findLast(block => block.execution?.role === 'step')!.id } });
    }
  }
  section('steps').blocks.push(...steps);
  if (card?.risks.length || card?.differences.length) section('steps').blocks.push({ id: newId('callout'), type: 'callout', tone: 'warning', text: [...(card.differences.length ? [`要点：${card.differences.map(mark).join('；')}`] : []), ...(card.risks.length ? [`注意：${card.risks.map(mark).join('；')}`] : [])].join('\n'), execution: { role: 'info' } });
  document.sources = [{ id: `src-design-${hit.key.replace(/[^\w-]/g, '-')}`, kind: sourceKind(hit), title: hit.title, citation: [hit.authors, hit.year, hit.venue].filter(Boolean).join(', ') || undefined, url: text.url ?? hit.url, license, accessedAt: text.fetchedAt, note: '方案设计检索所得' }];
  document.provenance = { fromExperimentIds: [], design: { sessionId, hitKey: hit.key, unverified, generatedAt: new Date().toISOString() } };
  return { document, title: hit.title };
}
