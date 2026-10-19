import type { MethodCard } from './method-card';
import type { MethodHit, MethodHitSource, MethodText } from './method-sources/types';
import { recognizeQuantity, splitDimension, splitLookupSource } from './protocol-chips';
import { createEmptyProtocolDocument, type ProtocolContentBlock, type ProtocolDocument, type ProtocolSource } from './protocol-document';
import { blankProtocolSystems, type ProtocolSystems } from './protocol-systems-schema';

/** Words that make the number before them a size: "1.5 mL 离心管", "96 孔板", "10 cm 皿". */
const containerAfter = /^\s*(?:离心管|收集管|冻存管|PCR\s*管|EP\s*管|管|孔板|深孔板|板|培养皿|皿|培养瓶|瓶|吸附柱|柱|枪头|吸头|滤器|tubes?|plates?|dish(?:es)?|flasks?|columns?|tips?)/i;

/**
 * Every quantity in a line becomes a chip, the way typing it in the editor would: one value is a fixed chip; "50/80 µL"
 * gives one value per option of the only system with that many options, and stays text when there is no such system.
 * Container sizes ("1.5 mL 离心管") stay text too: they are not amounts. `kept` collects those sizes, so a conversion can
 * say so.
 */
export function chipifyText(text: string, systems: ProtocolSystems, newId: (prefix: string) => string, kept?: string[]) {
  const padded = `${text} `;
  const found = new Map<number, ReturnType<typeof recognizeQuantity> & object>();
  for (let end = 1; end <= padded.length; end += 1) {
    const quantity = recognizeQuantity(padded.slice(0, end));
    if (quantity && !found.has(quantity.index)) found.set(quantity.index, quantity);
  }
  let out = text;
  for (const quantity of [...found.values()].sort((a, b) => b.index - a.index)) {
    if (quantity.index + quantity.source.length > text.length) continue;
    if (containerAfter.test(text.slice(quantity.index + quantity.source.length))) { kept?.push(quantity.source.trim()); continue; }
    let source: ProtocolSystems['parameters'][number]['source'] = { kind: 'fixed', value: quantity.values[0], unit: quantity.unit };
    if (quantity.values.length > 1) {
      const choice = splitDimension(quantity.values.length, systems);
      const dimension = 'dimensionId' in choice ? systems.dimensions.find(item => item.id === choice.dimensionId) : undefined;
      if (!dimension) continue;
      source = splitLookupSource(quantity.values, quantity.unit, dimension, () => newId('value'));
    }
    const id = newId('p');
    systems.parameters.push({ id, label: '', unit: quantity.unit, kind: quantity.kind, origin: 'chip', source });
    out = `${out.slice(0, quantity.index)}{{${id}}}${out.slice(quantity.index + quantity.source.length)}`;
  }
  return out;
}

const paragraph = (text: string) => ({ type: 'paragraph' as const, content: [{ text }] });
const headerLike = /^(description|materials?|abstract|introduction|background|说明|材料|背景)$/i;
const sourceKind = (hit: MethodHit): ProtocolSource['kind'] => hit.source === 'protocols_io' ? 'protocols_io' : hit.source === 'europe_pmc' ? 'pmc' : hit.source === 'manual' && hit.url ? 'url' : 'other';

/**
 * 换个关键词再搜 (search again): the new search's hits come first, in its own order, so the list reads as that search; a hit
 * found again keeps what was done with it (its fetched text). An earlier hit stays only when someone worked on it (fetched
 * or pasted text, a method card, a saved choice) or when its source failed this time, so nothing reviewable disappears and
 * a failed source does not wipe its earlier results.
 */
export function mergeSearchHits(known: MethodHit[], found: MethodHit[], keep: { keys?: Iterable<string>; failedSources?: Iterable<MethodHitSource> } = {}): MethodHit[] {
  const byKey = new Map(known.map(hit => [hit.key, hit]));
  const fresh = new Map<string, MethodHit>();
  for (const hit of found) if (!fresh.has(hit.key)) fresh.set(hit.key, byKey.get(hit.key) ?? hit);
  const keys = new Set(keep.keys), failed = new Set(keep.failedSources);
  return [...fresh.values(), ...known.filter(hit => !fresh.has(hit.key) && (hit.attachmentId || hit.source === 'manual' || keys.has(hit.key) || failed.has(hit.source)))];
}

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
