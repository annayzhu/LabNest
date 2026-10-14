import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Mapping } from '@tiptap/pm/transform';
import { newClientMutationId } from './client-mutation-id';

/** Assign IDs in the editor transaction, not anew during each serialization. */
export const ProtocolEditorIdentities = Extension.create({
  name: 'protocolEditorIdentities',
  addGlobalAttributes() {
    return [{ types: ['tableRow'], attributes: { protocolRowId: { default: null, parseHTML: element => element.getAttribute('data-protocol-row-id'), renderHTML: attrs => attrs.protocolRowId ? { 'data-protocol-row-id': attrs.protocolRowId } : {} } } }];
  },
  onCreate() { this.editor.view.dispatch(this.editor.state.tr.setMeta('protocolIdentityInit', true)); },
  addProseMirrorPlugins() {
    return [new Plugin({ appendTransaction(transactions, oldState, state) {
      if (!transactions.some(t => t.docChanged || t.getMeta('protocolIdentityInit'))) return null;
      const tr = state.tr;
      const rows = new Set<string>();
      const media = new Set<string>();
      const mapping = new Mapping(transactions.flatMap(t => t.mapping.maps));
      const originals = new Map<string, number>();
      oldState.doc.descendants((node, position) => {
        const key = node.type.name === 'tableRow' ? node.attrs.protocolRowId : node.type.name === 'documentMedia' ? node.attrs.block?.id : undefined;
        if (!key) return;
        const mapped = mapping.mapResult(position);
        if (!mapped.deleted && !originals.has(key)) originals.set(key, mapped.pos);
      });
      state.doc.descendants((node, pos, parent) => {
        if (node.type.name === 'tableRow') {
          const id = node.attrs.protocolRowId as string | null;
          if (!id || originals.has(id) && originals.get(id) !== pos || rows.has(id)) { const next = `row-${newClientMutationId()}`; tr.setNodeMarkup(pos, undefined, { ...node.attrs, protocolRowId: next }); rows.add(next); }
          else rows.add(id);
        } else if (node.type.name === 'documentMedia' && node.attrs.block) {
          const block = node.attrs.block;
          // A move keeps the original reference. A copy receives a new node ID,
          // including when pasted before the source; the attachment ID stays shared.
          if (!block.id || originals.has(block.id) && originals.get(block.id) !== pos || media.has(block.id)) {
            const id = `media-${newClientMutationId()}`;
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, block: { ...block, id, ...(block.execution ? { execution: { role: 'info' } } : {}) } }); media.add(id);
          } else media.add(block.id);
        } else if (parent?.type.name === 'protocolSection' && 'protocolBlockId' in node.attrs && !node.attrs.protocolBlockId) {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, protocolBlockId: `block-${newClientMutationId()}` });
        }
      });
      return tr.docChanged ? tr.setMeta('addToHistory', false) : null;
    } })];
  },
});
