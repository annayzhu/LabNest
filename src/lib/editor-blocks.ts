import type { ChainedCommands, Editor, JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection, Selection, type EditorState, type Transaction } from '@tiptap/pm/state';

/** Nodes whose children are the blocks a handle moves: the document and the fixed sections of experiment and Protocol documents. */
const containers = new Set(['doc', 'scientificSection', 'protocolSection']);

/** One block as a handle sees it: a paragraph, list, table, picture or widget, or a whole Protocol step. */
export type BlockUnit = { pos: number; node: ProseMirrorNode };

/** The block a handle stands for at `pos`: the outermost block inside the document or one of its sections. */
export function blockUnitAt(doc: ProseMirrorNode, pos: number): BlockUnit | null {
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  for (let depth = 1; depth <= $pos.depth; depth += 1) {
    if (containers.has($pos.node(depth - 1).type.name) && !containers.has($pos.node(depth).type.name)) return { pos: $pos.before(depth), node: $pos.node(depth) };
  }
  const after = $pos.nodeAfter;
  return after && containers.has($pos.parent.type.name) && !containers.has(after.type.name) ? { pos: $pos.pos, node: after } : null;
}

/** The block again after other edits, if it is still there. */
export function currentBlockUnit(doc: ProseMirrorNode, unit: BlockUnit): BlockUnit | null {
  const node = unit.pos <= doc.content.size ? doc.nodeAt(unit.pos) : null;
  return node && node.type === unit.node.type ? { pos: unit.pos, node } : null;
}

const caretIn = (doc: ProseMirrorNode, pos: number) => {
  const node = doc.nodeAt(pos);
  return node && !node.isTextblock && !node.childCount ? NodeSelection.create(doc, pos) : Selection.near(doc.resolve(pos + 1));
};

/** Swap a block with its neighbour in the same container; null at either end. The caret follows the block. */
export function moveBlock(state: EditorState, unit: BlockUnit, direction: -1 | 1): Transaction | null {
  const $pos = state.doc.resolve(unit.pos), index = $pos.index() + direction;
  if (index < 0 || index >= $pos.parent.childCount) return null;
  const neighbour = $pos.parent.child(index);
  const at = direction === 1 ? unit.pos + neighbour.nodeSize : unit.pos - neighbour.nodeSize;
  const tr = state.tr.delete(unit.pos, unit.pos + unit.node.nodeSize).insert(at, unit.node);
  return tr.setSelection(caretIn(tr.doc, at)).scrollIntoView();
}

const pendingUpload = (node: ProseMirrorNode) => { let pending = false; node.descendants(child => { if (child.attrs.block?.pendingUploadId) pending = true; }); return pending || Boolean(node.attrs.block?.pendingUploadId); };
export const canDuplicateBlock = (unit: BlockUnit) => !pendingUpload(unit.node);

const freshId = (id: string) => `${id.split(/[-:]/)[0] || 'block'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
/** A copy owns nothing of the original: no step, record or block identity, and widgets and pictures get ids of their own. */
function withFreshIdentities(json: JSONContent): JSONContent {
  const attrs = json.attrs ? Object.fromEntries(Object.entries(json.attrs).map(([key, value]) => {
    if (key.endsWith('BlockId') || key === 'protocolExecution' || (json.type === 'protocolStep' && (key === 'stepId' || key === 'settings'))) return [key, null];
    if (key === 'block' && value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') return [key, { ...value, id: freshId((value as { id: string }).id) }];
    return [key, value];
  })) : undefined;
  return { ...json, ...(attrs ? { attrs } : {}), ...(json.content ? { content: json.content.map(withFreshIdentities) } : {}) };
}

/** A copy right below the block. A picture still uploading is not copied. */
export function duplicateBlock(state: EditorState, unit: BlockUnit): Transaction | null {
  if (!canDuplicateBlock(unit)) return null;
  const at = unit.pos + unit.node.nodeSize;
  const tr = state.tr.insert(at, state.schema.nodeFromJSON(withFreshIdentities(unit.node.toJSON())));
  return tr.setSelection(caretIn(tr.doc, at)).scrollIntoView();
}

/** Remove a block; the last block of a section leaves an empty line to write on. */
export function deleteBlock(state: EditorState, unit: BlockUnit): Transaction {
  const $pos = state.doc.resolve(unit.pos), end = unit.pos + unit.node.nodeSize;
  const tr = $pos.parent.childCount === 1 ? state.tr.replaceWith(unit.pos, end, state.schema.nodes.paragraph.create()) : state.tr.delete(unit.pos, end);
  return tr.setSelection(Selection.near(tr.doc.resolve(Math.min(unit.pos, tr.doc.content.size)))).scrollIntoView();
}

/** The text block kinds "/" and 转换为 offer. */
export type BlockKind = 'paragraph' | 'heading' | 'subheading' | 'quote' | 'bullet' | 'ordered' | 'task';
const kindNode: Record<BlockKind, string | null> = { paragraph: null, heading: null, subheading: null, quote: 'blockquote', bullet: 'bulletList', ordered: 'orderedList', task: 'taskList' };

/** Turn the selected lines into a kind: out of any list or quote first; lines already of that kind stay. */
export function turnInto(editor: Editor, chain: ChainedCommands, kind: BlockKind) {
  const wrapper = kindNode[kind];
  if (wrapper && editor.isActive(wrapper)) return chain;
  chain.clearNodes();
  if (kind === 'heading') return chain.setHeading({ level: 2 });
  if (kind === 'subheading') return chain.setHeading({ level: 3 });
  if (kind === 'quote') return chain.toggleBlockquote();
  if (kind === 'bullet') return chain.toggleBulletList();
  if (kind === 'ordered') return chain.toggleOrderedList();
  if (kind === 'task') return chain.toggleTaskList();
  return chain;
}

/** The kind a block reads as now, for marking the current choice in 转换为. */
export function blockKind(node: ProseMirrorNode): BlockKind | null {
  if (node.type.name === 'paragraph') return 'paragraph';
  if (node.type.name === 'heading') return node.attrs.level === 2 ? 'heading' : 'subheading';
  return (Object.entries(kindNode).find(([, name]) => name === node.type.name)?.[0] as BlockKind | undefined) ?? null;
}
const textKinds = new Set(['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'taskList']);
/** Blocks made of lines can change kind and take text formatting; tables take formatting only. */
export const blockTakesKinds = (node: ProseMirrorNode) => textKinds.has(node.type.name);
export const blockTakesFormat = (node: ProseMirrorNode) => textKinds.has(node.type.name) || node.type.name === 'table';

/** Select the whole block so a format applies to all of its text. */
export const selectBlock = (editor: Editor, unit: BlockUnit) => editor.chain().focus(undefined, { scrollIntoView: false }).setTextSelection({ from: unit.pos + 1, to: unit.pos + unit.node.nodeSize - 1 });
