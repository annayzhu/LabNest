import { isRichTextFontSizePt } from './rich-text-font-size';
import type { ProtocolContentBlock } from './protocol-document';
import type { Editor } from '@tiptap/core';

export type FontSizeScope = 'selection' | 'cell' | 'row' | 'table' | 'document';

/** Read every selected range, including discontiguous table cells. */
export function selectedDocumentFontSize(editor: Editor): string {
  const { selection, doc } = editor.state;
  if (selection.empty) return editor.getAttributes('textStyle').fontSize ?? '';
  const sizes = new Set<string>();
  for (const range of selection.ranges) doc.nodesBetween(range.$from.pos, range.$to.pos, node => {
    if (node.isText) sizes.add(node.marks.find(mark => mark.type.name === 'textStyle')?.attrs.fontSize ?? '');
  });
  return sizes.size > 1 ? '__mixed__' : [...sizes][0] ?? '';
}

/** A formatting transaction changes text marks, never table data or structure. */
export function applyDocumentFontSize(editor: Editor, size: number | null, scope: FontSizeScope): boolean {
  const { state } = editor;
  const fontSize = size === null ? null : `${size}pt`;
  if (scope === 'selection' && state.selection.empty) return fontSize ? editor.chain().focus().setFontSize(fontSize).run() : editor.chain().focus().unsetFontSize().run();
  let ranges = state.selection.ranges.map(range => ({from: range.$from.pos, to: range.$to.pos}));
  if (scope === 'document') ranges = [{from: 0, to: state.doc.content.size}];
  else if (scope !== 'selection') {
    const types = scope === 'cell' ? ['tableCell', 'tableHeader'] : scope === 'row' ? ['tableRow'] : ['table'];
    const anchor = state.selection.$from;
    let depth = anchor.depth;
    while (depth > 0 && !types.includes(anchor.node(depth).type.name)) depth--;
    if (!depth) return false;
    ranges = [{from: anchor.start(depth), to: anchor.end(depth)}];
  }
  const transaction = state.tr;
  for (const {from, to} of ranges) state.doc.nodesBetween(from, to, (node, position) => {
    if (scope === 'document' && ['protocolSection', 'scientificSection'].includes(node.type.name)) transaction.setNodeMarkup(position, undefined, {...node.attrs, titleFontSizePt: size});
    if (scope === 'document' && node.type.name === 'protocolWidget') {
      const block = node.attrs.block as ProtocolContentBlock;
      if (block?.type === 'table' && block.resultTemplate?.instructions) transaction.setNodeMarkup(position, undefined, {...node.attrs, block: {...block, resultTemplate: {...block.resultTemplate, instructions: block.resultTemplate.instructions.map(instruction => ({...instruction, content: instruction.content.map(run => ({...run, fontSizePt: isRichTextFontSizePt(size) ? size : undefined}))}))}}});
    }
    if (node.type.name === 'documentMedia' && node.attrs.block) transaction.setNodeMarkup(position, undefined, {...node.attrs, block: {...node.attrs.block, captionFontSizePt: size ?? undefined}});
    if (!node.isText) return;
    const previous = node.marks.find(mark => mark.type.name === 'textStyle');
    transaction.addMark(Math.max(from, position), Math.min(to, position + node.nodeSize), state.schema.marks.textStyle.create({...previous?.attrs, fontSize}));
  });
  editor.view.dispatch(transaction);
  editor.view.focus();
  return true;
}
