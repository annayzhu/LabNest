import { Extension, InputRule } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { optionMarks, recognizeQuantity, recognizeRangeEnd, type RecognizedQuantity } from './protocol-chips';
import type { ProtocolSystems } from './protocol-systems-schema';
import { evaluateProtocolCondition, type ProtocolSelection } from './structured-protocol';
import { conditionTagLabel, conditionTagLabelZh } from './protocol-conditions';
import { slashOpensMenu } from './editor-slash';

/** What the editor's extensions call back into. The React editor refreshes these after every render. */
export type ProtocolEditorHandlers = {
  /** Create the parameter for a typed quantity at `pos`; returns the chip's node attributes. */
  createChip: (quantity: RecognizedQuantity, pos: number) => Record<string, unknown> | null;
  /** "20 min" then " - 30 min": the chip at `pos` becomes the range ending at `max`; returns its node attributes, or null. */
  extendChipToRange: (pos: number, max: { value: number; unit: string }) => Record<string, unknown> | null;
  /** Open the chip editor for the chip at `pos` (keyboard: Enter on a selected chip). */
  openChip: (pos: number) => void;
  /** "/" was typed at a word start: the menu tracks the text typed after `from`. */
  openMenu: (from: number) => void;
  /** Keys while the insert menu or the "which system?" question is open; true when it handled the key. */
  menuKey: (event: KeyboardEvent) => boolean;
  menuOpen: () => boolean;
  systems: () => ProtocolSystems | undefined;
  lens: () => ProtocolSelection;
  /** Step blocks may be written: the Steps section holds no older, unconverted steps. */
  stepsAllowed: () => boolean;
};
type HandlerStorage = { current: ProtocolEditorHandlers | null };
/** Holds the handlers per editor; extensions read them at event time, never while rendering. */
export const ProtocolEditorHandlerStorage = Extension.create<unknown, HandlerStorage>({ name: 'protocolHandlers', addStorage: () => ({ current: null }) });
export const protocolHandlers = (editor: { storage: unknown }) => (editor.storage as { protocolHandlers?: HandlerStorage }).protocolHandlers?.current ?? null;
export function setProtocolHandlers(editor: { storage: unknown }, handlers: ProtocolEditorHandlers) {
  const storage = (editor.storage as { protocolHandlers?: HandlerStorage }).protocolHandlers;
  if (storage) storage.current = handlers;
}

/**
 * Typing "50 µL", "37 ℃", "50/80 µL", "20–30 min" or "pH 7.4" followed by a space or punctuation makes a chip; " - 30 min"
 * right after a chip makes that chip a range. Undo or Backspace restores the text.
 */
export const ProtocolChipInput = Extension.create({
  name: 'protocolChipInput',
  addInputRules() {
    return [new InputRule({
      find: text => { const end = recognizeRangeEnd(text); return end ? { index: end.index, text: text.slice(end.index), data: { end } } : null; },
      handler: ({ state, range, match }) => {
        const end = match.data?.end as ReturnType<typeof recognizeRangeEnd>;
        if (!end || match.input === undefined) return null;
        // Measured back from the insertion point, as below: everything between the chip and the caret is plain text.
        const insertAt = state.selection.from;
        const typedLength = match[0].length - (insertAt - range.from);
        const textBefore = match.input.length - typedLength;
        const tail = insertAt + (end.index - textBefore), chip = state.doc.nodeAt(tail - 1);
        if (chip?.type.name !== 'protocolParameter' || chip.attrs.parameterId !== end.parameterId) return null;
        const attrs = protocolHandlers(this.editor)?.extendChipToRange(tail - 1, end.max);
        if (!attrs) return null;
        const typed = match.input.slice(textBefore);
        if (typed) state.tr.insertText(typed, insertAt, range.to);
        state.tr.delete(tail, tail + end.source.length).setNodeMarkup(tail - 1, undefined, attrs);
      },
    }), new InputRule({
      find: text => { const quantity = recognizeQuantity(text); return quantity ? { index: quantity.index, text: text.slice(quantity.index), data: { quantity } } : null; },
      handler: ({ state, range, match }) => {
        const quantity = match.data?.quantity as RecognizedQuantity | undefined;
        if (!quantity || !state.schema.nodes.protocolParameter || match.input === undefined) return null;
        // `range` assumes the match ends in the document; an IME commit or a fast insert may hold the whole
        // match inside the typed text. Insert what was typed first, then measure back from the insertion point.
        const insertAt = state.selection.from;
        const typedLength = match[0].length - (insertAt - range.from);
        const textBefore = match.input.length - typedLength;
        const start = insertAt + (quantity.index - textBefore);
        const attrs = protocolHandlers(this.editor)?.createChip(quantity, start);
        if (!attrs) return null;
        const typed = match.input.slice(textBefore);
        if (typed) state.tr.insertText(typed, insertAt, range.to);
        const marks = state.tr.doc.resolve(start).marks();
        state.tr.replaceWith(start, start + quantity.source.length, state.schema.nodes.protocolParameter.create(attrs, null, marks));
      },
    })];
  },
  addKeyboardShortcuts() {
    return {
      'Mod-z': () => this.editor.commands.undoInputRule(),
      Enter: () => {
        const { selection } = this.editor.state;
        if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'protocolParameter') return false;
        protocolHandlers(this.editor)?.openChip(selection.from);
        return true;
      },
    };
  },
});

const slashKey = new PluginKey('protocolSlashMenu');
/** "/" (or "、"/"／" from a Chinese keyboard) at the start of a line or after a space opens the insert menu; the editor keeps the text. */
export const ProtocolSlashMenu = Extension.create({
  name: 'protocolSlashMenu',
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [new Plugin({ key: slashKey, props: {
      handleTextInput(view, from, _to, text) {
        if (slashOpensMenu(view, from, text)) queueMicrotask(() => protocolHandlers(editor)?.openMenu(from));
        return false;
      },
      handleKeyDown: (_view, event) => Boolean(protocolHandlers(editor)?.menuOpen() && protocolHandlers(editor)?.menuKey(event)),
    } })];
  },
});

const blockId = (node: ProseMirrorNode) => (node.attrs.protocolBlockId ?? node.attrs.block?.id) as string | undefined;
/** Condition tags and lens dimming for ordinary blocks; step blocks render their own. */
export const ProtocolConditionDecorations = Extension.create({
  name: 'protocolConditionDecorations',
  addProseMirrorPlugins() {
    const editor = this.editor;
    const getSystems = () => protocolHandlers(editor)?.systems(), getLens = () => protocolHandlers(editor)?.lens() ?? {};
    return [new Plugin({ props: { decorations(state) {
      const decorations: Decoration[] = [];
      // The step holding the cursor shows its number in the accent: where Enter will continue.
      const { $from } = state.selection;
      for (let depth = $from.depth; depth > 0; depth -= 1) if ($from.node(depth).type.name === 'protocolStep') { decorations.push(Decoration.node($from.before(depth), $from.after(depth), { class: 'is-current-step' })); break; }
      const systems = getSystems();
      if (!systems) return DecorationSet.create(state.doc, decorations);
      const lens = getLens(), marks = optionMarks(systems);
      // CSS draws these tags from attributes the page translator cannot reach: each carries its English and Chinese text.
      const tag = (rule: ProtocolSystems['rules'][number], label: typeof conditionTagLabel) => [...(rule.when.all ?? []), ...(rule.when.any ?? [])].map(p => { const mark = marks.get(`${p.dimensionId}:${p.optionId}`); const dimension = systems.dimensions.find(d => d.id === p.dimensionId); return mark?.glyph ? `${mark.glyph} ${mark.label}` : label(dimension?.label ?? '', mark?.label ?? ''); }).join(' / ');
      state.doc.descendants((node, pos, parent) => {
        if (!parent || !['protocolSection', 'protocolStep'].includes(parent.type.name)) return node.type.name === 'protocolSection' || node.type.name === 'protocolStep' || node.type.name === 'doc';
        // A step is a container: its own scope is drawn by its node view; its blocks are visited below.
        if (node.type.name === 'protocolStep') return true;
        if (node.type.name === 'table') node.firstChild?.forEach((cell, offset) => {
          const [dimensionId, optionId] = typeof cell.attrs.protocolColumn === 'string' ? cell.attrs.protocolColumn.split(':') : [];
          const mark = dimensionId ? marks.get(`${dimensionId}:${optionId}`) : undefined;
          // pos + 2: inside the table, then the first row.
          const option = mark ? `${mark.glyph ? `${mark.glyph} ` : ''}${mark.label}` : '';
          if (mark) decorations.push(Decoration.node(pos + 2 + offset, pos + 2 + offset + cell.nodeSize, { 'data-column-tag': `Only ${option}`, 'data-column-tag-zh': `仅 ${option}` }));
        });
        const id = blockId(node);
        const rules = id ? systems.rules.filter(rule => rule.target === 'block' && rule.targetId === id && [rule.when.all, rule.when.any, rule.when.not].some(p => p?.length)) : [];
        if (rules.length) {
          const dimmed = rules.some(rule => evaluateProtocolCondition(rule.when, lens) === 'not-applicable');
          decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: `ln-has-condition${dimmed ? ' is-lens-dimmed' : ''}`, 'data-condition': `Only ${rules.map(rule => tag(rule, conditionTagLabel)).join('; ')}`, 'data-condition-zh': `仅 ${rules.map(rule => tag(rule, conditionTagLabelZh)).join('；')}` }));
        }
        return false;
      });
      return DecorationSet.create(state.doc, decorations);
    } } })];
  },
});

