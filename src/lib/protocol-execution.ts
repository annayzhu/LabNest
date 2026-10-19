import type { ProtocolContentBlock, ProtocolDocument } from './protocol-document';
import type { ProtocolStep } from './types';
import { programSummary } from './protocol-program';
import { mixSummary } from './protocol-mix';

export function executionBlockText(block: ProtocolContentBlock): string {
  if ('text' in block) return block.text;
  if (block.type === 'program') return programSummary(block);
  if (block.type === 'mix') return mixSummary(block);
  if (block.type === 'rich_text') return block.nodes.map(n => n.content.map(r => r.text).join('')).join('\n');
  if (block.type === 'checklist') return block.items.join('\n');
  if (block.type === 'table') return block.rows.map(row => row.join(' · ')).join('\n');
  return block.type === 'media' ? block.caption ?? block.filename ?? block.url : block.label;
}

/** Top-level source fragments only. Nested lists/tables remain in their parent. */
export function executionFragments(document: ProtocolDocument): ProtocolContentBlock[] {
  return (document.sections.find(section => section.key === 'steps')?.blocks ?? []).flatMap(block => {
    if (block.execution) return [block];
    if (block.type === 'rich_text') return block.nodes.map((node, i) => ({ ...block, id: `${block.id}:${i}`, nodes: [node] }));
    if (block.type === 'checklist') return block.items.map((item, i) => ({ ...block, id: `${block.id}:${i}`, items: [item], ...(block.itemNodes ? {itemNodes: [block.itemNodes[i] ?? []]} : {}) }));
    return [block];
  });
}

function isEmpty(block: ProtocolContentBlock) {
  return !executionBlockText(block).trim() && !(block.type === 'rich_text' && block.nodes.some(node => node.childContent?.length)) && !['media','timer','embedded_tool','table'].includes(block.type);
}
function isHeading(block: ProtocolContentBlock) {
  return block.type === 'heading' || (block.type === 'rich_text' && ['heading2','heading3','numbered'].includes(block.nodes[0]?.type));
}

/** Remove one exact leading generated title, never similar prose or repeated operations. */
export function executionBodyWithoutTitle(blocks: ProtocolContentBlock[], title: string): ProtocolContentBlock[] {
  const cloned = structuredClone(blocks);
  const first = cloned[0];
  if (!first || !title) return cloned;
  const prefix=first.execution?.titlePrefix;
  if(prefix && prefix===`${title} — ` && first.type==='checklist' && first.items.length===1 && first.items[0].startsWith(prefix)) {
    if(first.itemNodes?.[0]) {
      const node=first.itemNodes[0][0];
      if(!node||!node.content.map(run=>run.text).join('').startsWith(prefix))return cloned;
      let prefixRemaining=prefix.length;
      for(const run of node.content) {
        if(prefixRemaining<=0)break;
        if(run.text.length && (run.subscript||run.superscript||run.link||run.code))return cloned;
        prefixRemaining-=run.text.length;
      }
      let remaining=prefix.length;
      node.content=node.content.flatMap(run=>{const count=Math.min(remaining,run.text.length);remaining-=count;return run.text.length>count?[{...run,text:run.text.slice(count)}]:[];});
    }
    first.items=[first.items[0].slice(prefix.length)];
    return cloned;
  }
  const nodes=first.type==='rich_text'?first.nodes:(first.type==='heading'||first.type==='text')?first.nodes:first.type==='checklist'&&first.items.length===1?first.itemNodes?.[0]:undefined;
  if(nodes?.length) {
    const node=nodes[0],text=node.content.map(run=>run.text).join('');
    const generatedTitle=['heading2','heading3','numbered'].includes(node.type)?text.replace(/^\d+[.、)]\s*/,''):text;
    if(generatedTitle.trim()===title.trim()&&!node.content.some(run=>run.subscript||run.superscript||run.link||run.code)) {
      // A generated title may own a nested list or be followed by paragraphs.
      // Remove only its text, retaining the actual child/body content in order.
      const retained=node.childContent?.length?[{...node,type:'paragraph' as const,content:[]},...nodes.slice(1)]:nodes.slice(1);
      if(!retained.length)return cloned.slice(1);
      cloned[0]={id:first.id,execution:first.execution,type:'rich_text',nodes:retained};
      return cloned;
    }
  } else if ((first.type === 'heading' || first.type === 'text') && (first.type==='heading'?first.text.replace(/^\d+[.、)]\s*/, ''):first.text).trim() === title.trim()) return cloned.slice(1);
  else if(first.type==='checklist'&&first.items.length===1&&first.items[0].trim()===title.trim())return cloned.slice(1);
  return cloned;
}

/** Produce a reviewable proposal. Formatting is evidence for grouping, never confirmation. */
function proposeExecutionRoles(document: ProtocolDocument): ProtocolContentBlock[] {
  const fragments = executionFragments(document);
  const hasHeadings = fragments.some(isHeading);
  let precedingStep: string | undefined;
  return fragments.map(block => {
    if (block.execution) { if(block.execution.role==='step') precedingStep=block.execution.stepId ?? block.id; return block; }
    if (isHeading(block) || (!hasHeadings && block.type === 'checklist')) {
      precedingStep = block.id;
      return { ...block, execution: { role: 'step' as const, stepId: block.id, title: executionBlockText(block).replace(/^\d+[.、)]\s*/, '').trim() } };
    }
    return {...block, execution: precedingStep ? {role:'detail' as const,stepId:precedingStep} : {role:'info' as const}};
  });
}

const sentenceEnd = /[。！？!?；;\n]|\.(?=\s|$)/;
/** A list label for a step block: the author's bold lead, else its first sentence. */
export function derivedStepTitle(blocks: ProtocolContentBlock[]): string | undefined {
  const first = blocks[0];
  const node = first?.type === 'rich_text' ? first.nodes[0]
    : first?.type === 'text' || first?.type === 'heading' ? first.nodes?.[0] ?? { type: 'paragraph' as const, content: [{ text: first.text }] }
    : first?.type === 'checklist' ? first.itemNodes?.[0]?.[0] ?? { type: 'paragraph' as const, content: [{ text: first.items[0] ?? '' }] }
    : undefined;
  if (!node) return;
  const lead: string[] = [];
  for (const run of node.content) { if (!run.bold) break; lead.push(run.text); }
  const text = (lead.join('').trim() || node.content.map(run => run.text).join('')).trim();
  if (text.startsWith('![')) return; // Embedded media markdown is not a label.
  const sentence = text.split(sentenceEnd)[0].trim().replace(/[。.:：;；,，、\s]+$/, '');
  return sentence ? shortenLabel(sentence) : undefined;
}

/** About 48 visible characters; a chip counts as one short value and is never cut. */
function shortenLabel(text: string, limit = 48, chipWidth = 8) {
  let used = 0, label = '';
  for (const part of text.split(/(\{\{[\w-]+\}\})/g).filter(Boolean)) {
    const chip = /^\{\{[\w-]+\}\}$/.test(part), width = chip ? chipWidth : Array.from(part).length;
    if (used + width <= limit) { label += part; used += width; continue; }
    return chip ? `${label.trimEnd()}…` : `${label}${Array.from(part).slice(0, Math.max(0, limit - used - 1)).join('')}…`;
  }
  return label;
}

/** The Steps section as fragments with their roles: the author's own, or proposed from headings and lists when some are missing. */
export function executionRoleBlocks(document: ProtocolDocument) {
  const original = executionFragments(document);
  const proposed = original.some(block => !isEmpty(block) && !block.execution);
  return { blocks: proposed ? proposeExecutionRoles(document) : original, proposed };
}

/** Existing ProtocolStep is the sole machine contract. Marks describe source ownership. */
export function projectProtocolExecution(document: ProtocolDocument) {
  const { blocks, proposed: executionNeedsReview } = executionRoleBlocks(document);
  const ownedBy = (id: string) => blocks.filter(block => (block.execution?.role === 'step' || block.execution?.role === 'detail') && (block.execution.stepId ?? block.id) === id);
  // A step block is empty only when its whole body is; an unwritten new step is not an operation.
  const nonEmpty = (block: ProtocolContentBlock) => block.execution?.format === 'block' ? ownedBy(block.execution.stepId ?? block.id).some(owned => !isEmpty(owned)) : !isEmpty(block);
  const starts = blocks.filter(block => block.execution?.role === 'step' && nonEmpty(block));
  const ids = starts.map(block => block.execution?.stepId ?? block.id);
  const unwritten = new Set(blocks.filter(block => block.execution?.role === 'step' && block.execution.format === 'block' && !starts.includes(block)).map(block => block.execution?.stepId ?? block.id));
  const orphan = (block: ProtocolContentBlock) => block.execution?.role === 'detail' && !ids.includes(block.execution.stepId ?? '') && !unwritten.has(block.execution.stepId ?? '');
  const invalid = ids.some((id,index)=>ids.indexOf(id)!==index) || blocks.some(orphan);
  // Notes in the Steps section: no number, no check, and an empty line is not a note.
  const commonBlocks = blocks.filter(block => (block.execution?.role === 'info' || orphan(block)) && !isEmpty(block));
  const notePlacement: NotePlacement = {};
  let waiting: string[] = [];
  for (const block of blocks) {
    if (commonBlocks.includes(block)) waiting.push(block.id);
    else if (starts.includes(block)) { for (const id of waiting) notePlacement[id] = block.execution?.stepId ?? block.id; waiting = []; }
  }
  for (const id of waiting) notePlacement[id] = null;
  const steps: ProtocolStep[] = starts.map((start, index) => {
    const source_ref = ids[index];
    if (start.execution?.format === 'block') {
      const owned = ownedBy(source_ref);
      const explicit = start.execution.title?.trim();
      return { source_ref, order: index + 1, title: explicit || derivedStepTitle(owned) || `Step ${index + 1}`, ...(explicit ? {} : { title_source: 'derived' as const }),
        description: owned.map(executionBlockText).filter(Boolean).join('\n'), content_blocks: structuredClone(owned),
        requires_confirmation: start.execution.requiresConfirmation ?? true, allows_deviation: start.execution.allowsDeviation ?? true };
    }
    const title = start.execution?.title?.trim() || `Step ${index + 1}`;
    const owned = blocks.filter(block => block === start || (block.execution?.role === 'detail' && block.execution.stepId === source_ref));
    let content_blocks = executionBodyWithoutTitle(owned, title);
    // A duplicated source heading can be followed by a second generated title paragraph.
    content_blocks = executionBodyWithoutTitle(content_blocks, title);
    return {source_ref,order:index+1,title,description:content_blocks.map(executionBlockText).filter(Boolean).join('\n'),content_blocks,requires_confirmation:start.execution?.requiresConfirmation??true,allows_deviation:start.execution?.allowsDeviation??true};
  });
  return {steps,commonBlocks,notePlacement,executionNeedsReview:executionNeedsReview || invalid || document.executionConfirmed===false};
}

/** Where each note sits among the steps: the step it was written before, or `null` after the last step. */
export type NotePlacement = Record<string, string | null>;

/**
 * Notes keep their written place during execution: each goes before the first shown step at or after the one it was written
 * before (a step this run does not show passes its notes on); the rest follow the last shown step.
 */
export function notesAmongSteps<T extends { id: string }>(notes: readonly T[], placement: NotePlacement, order: readonly string[], shown: (ref: string) => boolean = () => true) {
  const before = new Map<string, T[]>(), after: T[] = [];
  for (const note of notes) {
    const at = placement[note.id];
    const target = order.slice(at === null ? order.length : Math.max(0, at === undefined ? 0 : order.indexOf(at))).find(shown);
    if (target === undefined) after.push(note);
    else before.set(target, [...(before.get(target) ?? []), note]);
  }
  return { before, after };
}

export function confirmExecutionRoles(document: ProtocolDocument, blocks = proposeExecutionRoles(document)): ProtocolDocument {
  return {...document,executionConfirmed:true,sections:document.sections.map(section=>section.key==='steps'?{...section,blocks}:section)};
}
