'use client';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { chipViewText, protocolChipView } from '@/lib/protocol-chips';
import { ProtocolChip } from './ProtocolChip';
import { useProtocolEditor } from './ProtocolEditorContext';
import { useI18n } from '../I18nProvider';

/** An inline chip in the editor: reads live from the Protocol's parameters; click or Enter edits it in place. */
export function ChipNodeView({ node, getPos, selected }: NodeViewProps) {
  const api = useProtocolEditor();
  const { t } = useI18n();
  const id = node.attrs.parameterId as string;
  const view = protocolChipView(id, api.systems);
  const calculated = api.systems?.parameters.find(p => p.id === id)?.source.kind === 'calculator';
  const open = (anchor: HTMLElement) => { const pos = getPos(); if (typeof pos === 'number') api.openChip({ pos, id, anchor, focus: 'value' }); };
  return <NodeViewWrapper as="span" className="ln-chip-node" data-selected={selected ? '' : undefined}>
    <span contentEditable={false} role="button" tabIndex={-1} aria-label={t(`Edit parameter: ${chipViewText(view)}`)} onClick={event => open(event.currentTarget)} className="ln-chip-hit">
      <ProtocolChip view={view} lens={api.lens} calculated={calculated} />
    </span>
  </NodeViewWrapper>;
}
