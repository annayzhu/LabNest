import type { ProtocolContentBlock, ProtocolDocument } from './protocol-document';
import type { ProtocolStep } from './types';

export function executionBlockText(block: ProtocolContentBlock): string {
  if ('text' in block) return block.text;
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
  const hasMeaning=(nodes:Extract<ProtocolContentBlock,{type:'rich_text'}>['nodes']|undefined)=>nodes?.some(node=>node.childContent?.length||node.content.some(run=>run.subscript||run.superscript||run.link||run.code));
  if ((first.type === 'heading' || first.type === 'text') && (first.type==='heading'?first.text.replace(/^\d+[.、)]\s*/, ''):first.text).trim() === title.trim() && !hasMeaning(first.nodes)) return cloned.slice(1);
  if (first.type === 'checklist' && first.items.length === 1 && first.items[0].trim() === title.trim() && !first.itemNodes?.some(hasMeaning)) return cloned.slice(1);
  if (first.type === 'rich_text') {
    const node = first.nodes[0];
    if (node && (['heading2','heading3','numbered'].includes(node.type)?node.content.map(r=>r.text).join('').replace(/^\d+[.、)]\s*/, ''):node.content.map(r=>r.text).join('')).trim() === title.trim() && !hasMeaning([node])) {
      first.nodes = first.nodes.slice(1);
      return first.nodes.length ? cloned : cloned.slice(1);
    }
  }
  return cloned;
}

/** Produce a reviewable proposal. Formatting is evidence for grouping, never confirmation. */
export function proposeExecutionRoles(document: ProtocolDocument): ProtocolContentBlock[] {
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

/** Existing ProtocolStep is the sole machine contract. Marks describe source ownership. */
export function projectProtocolExecution(document: ProtocolDocument) {
  const original = executionFragments(document);
  const executionNeedsReview = original.some(block => !isEmpty(block) && !block.execution);
  const blocks = executionNeedsReview ? proposeExecutionRoles(document) : original;
  const starts = blocks.filter(block => block.execution?.role === 'step' && !isEmpty(block));
  const ids = starts.map(block => block.execution?.stepId ?? block.id);
  const invalid = ids.some((id,index)=>ids.indexOf(id)!==index) || blocks.some(block=>block.execution?.role==='detail' && !ids.includes(block.execution.stepId ?? ''));
  const commonBlocks = blocks.filter(block => block.execution?.role === 'info' || (block.execution?.role==='detail' && !ids.includes(block.execution.stepId ?? '')));
  const steps: ProtocolStep[] = starts.map((start, index) => {
    const source_ref = ids[index];
    const title = start.execution?.title?.trim() || `Step ${index + 1}`;
    const owned = blocks.filter(block => block === start || (block.execution?.role === 'detail' && block.execution.stepId === source_ref));
    let content_blocks = executionBodyWithoutTitle(owned, title);
    // A duplicated source heading can be followed by a second generated title paragraph.
    content_blocks = executionBodyWithoutTitle(content_blocks, title);
    return {source_ref,order:index+1,title,description:content_blocks.map(executionBlockText).filter(Boolean).join('\n'),content_blocks,requires_confirmation:start.execution?.requiresConfirmation??true,allows_deviation:start.execution?.allowsDeviation??true};
  });
  return {steps,commonBlocks,executionNeedsReview:executionNeedsReview || invalid || document.executionConfirmed===false};
}

export function confirmExecutionRoles(document: ProtocolDocument, blocks = proposeExecutionRoles(document)): ProtocolDocument {
  return {...document,executionConfirmed:true,sections:document.sections.map(section=>section.key==='steps'?{...section,blocks}:section)};
}
