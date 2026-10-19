import type { Editor } from '@tiptap/core';

/** A font size for the selected text (⋮⋮ selects the whole block first): it changes text marks, never table data or structure. */
export function setSelectionFontSize(editor: Editor, size: number | null): boolean {
  const { state } = editor;
  const fontSize = size === null ? null : `${size}pt`;
  if (state.selection.empty) return fontSize ? editor.chain().focus().setFontSize(fontSize).run() : editor.chain().focus().unsetFontSize().run();
  const transaction = state.tr;
  // Every selected range counts, including discontiguous table cells.
  for (const { $from, $to } of state.selection.ranges) state.doc.nodesBetween($from.pos, $to.pos, (node, position) => {
    if (!node.isText) return;
    const previous = node.marks.find(mark => mark.type.name === 'textStyle');
    transaction.addMark(Math.max($from.pos, position), Math.min($to.pos, position + node.nodeSize), state.schema.marks.textStyle.create({ ...previous?.attrs, fontSize }));
  });
  editor.view.dispatch(transaction);
  editor.view.focus();
  return true;
}
