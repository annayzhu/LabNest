'use client';
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import type { ProtocolSystems } from '@/lib/protocol-systems-schema';
import { evaluateProtocolCondition } from '@/lib/structured-protocol';
import { ConditionTags } from './ConditionTags';
import { useProtocolEditor } from './ProtocolEditorContext';

type Rule = ProtocolSystems['rules'][number];
export const conditioned = (rule: Rule) => [rule.when.all, rule.when.any, rule.when.not].some(p => p?.length);

/** One step block = one execution item: its number, its body, and its scope tags. Its menu is the block's ⋮⋮. */
export function StepNodeView({ node }: NodeViewProps) {
  const api = useProtocolEditor();
  const stepId = node.attrs.stepId as string | null;
  const rules = (api.systems?.rules ?? []).filter(rule => rule.target === 'step' && rule.targetId === stepId);
  const scoped = rules.filter(conditioned);
  const dimmed = scoped.some(rule => evaluateProtocolCondition(rule.when, api.lens) === 'not-applicable');
  const optional = rules.some(rule => rule.optional);
  return <NodeViewWrapper className="ln-protocol-step" data-step-id={stepId ?? undefined} data-dimmed={dimmed ? '' : undefined}>
    <div className="ln-protocol-step-gutter" contentEditable={false} aria-hidden><span className="ln-protocol-step-number" /></div>
    <NodeViewContent className="ln-protocol-step-body" />
    {scoped.length || optional ? <div className="ln-protocol-step-tags" contentEditable={false}>
      {api.systems && scoped.length ? <ConditionTags rules={scoped} systems={api.systems} /> : null}
      {optional ? <span className="ln-condition-tag is-optional">可选</span> : null}
    </div> : null}
  </NodeViewWrapper>;
}
