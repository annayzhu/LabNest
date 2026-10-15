import { describe, expect, it } from 'vitest';
import { Schema, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import { blockUnitAt, deleteBlock, duplicateBlock, moveBlock } from './editor-blocks';

const schema = new Schema({ nodes: {
  doc: { content: 'scientificSection+' },
  scientificSection: { content: 'block+' },
  protocolStep: { content: 'block+', group: 'block', attrs: { stepId: { default: null }, settings: { default: null } } },
  paragraph: { content: 'text*', group: 'block', attrs: { scientificBlockId: { default: null } } },
  widget: { group: 'block', atom: true, attrs: { block: { default: null } } },
  text: {},
} });
const p = (text: string, id: string | null = null) => schema.node('paragraph', { scientificBlockId: id }, text ? [schema.text(text)] : []);
const state = (...blocks: ProseMirrorNode[]) => EditorState.create({ doc: schema.node('doc', null, [schema.node('scientificSection', null, blocks)]) });
const texts = (doc: ProseMirrorNode) => { const out: string[] = []; doc.firstChild!.forEach(node => out.push(node.type.name === 'widget' ? `widget:${node.attrs.block.id}` : node.textContent)); return out; };
/** Position just inside the n-th block of the section. */
const inside = (doc: ProseMirrorNode, index: number) => { let pos = 1; for (let i = 0; i < index; i += 1) pos += doc.firstChild!.child(i).nodeSize; return pos + 1; };

describe('Block handles', () => {
  it('stand for the outermost block in a section; a whole Protocol step is one block', () => {
    const step = schema.node('protocolStep', { stepId: 'wash' }, [p('洗一次'), p('离心')]);
    const doc = state(p('前言'), step, schema.node('widget', { block: { id: 'metric-1' } })).doc;
    expect(blockUnitAt(doc, inside(doc, 0) + 1)?.node.textContent).toBe('前言');
    // The second line inside the step still belongs to the step.
    expect(blockUnitAt(doc, inside(doc, 1) + 6)?.node.attrs.stepId).toBe('wash');
    expect(blockUnitAt(doc, inside(doc, 2) - 1)?.node.type.name).toBe('widget');
    expect(blockUnitAt(doc, 0)).toBeNull();
  });

  it('move a block past its neighbour and stop at either end', () => {
    const start = state(p('一'), p('二'), p('三'));
    const first = blockUnitAt(start.doc, inside(start.doc, 0))!;
    expect(moveBlock(start, first, -1)).toBeNull();
    const down = start.apply(moveBlock(start, first, 1)!);
    expect(texts(down.doc)).toEqual(['二', '一', '三']);
    // The caret stays in the moved block.
    expect(down.selection.$from.parent.textContent).toBe('一');
    const back = down.apply(moveBlock(down, blockUnitAt(down.doc, down.selection.from)!, -1)!);
    expect(texts(back.doc)).toEqual(['一', '二', '三']);
  });

  it('copy a block right below it with identities of its own', () => {
    const start = state(schema.node('protocolStep', { stepId: 'wash', settings: { title: '洗' } }, [p('洗一次', 'b-1')]), schema.node('widget', { block: { id: 'metric-1', label: 'OD' } }));
    const step = blockUnitAt(start.doc, inside(start.doc, 0))!;
    const copied = start.apply(duplicateBlock(start, step)!).doc.firstChild!;
    expect(copied.child(1).attrs).toEqual({ stepId: null, settings: null });
    expect(copied.child(1).firstChild!.attrs.scientificBlockId).toBeNull();
    expect(copied.child(1).textContent).toBe('洗一次');
    const widget = blockUnitAt(start.doc, inside(start.doc, 1) - 1)!;
    const withWidget = start.apply(duplicateBlock(start, widget)!).doc.firstChild!;
    expect(withWidget.child(2).attrs.block.label).toBe('OD');
    expect(withWidget.child(2).attrs.block.id).not.toBe('metric-1');
    expect(withWidget.child(2).attrs.block.id).toMatch(/^metric-/);
    const uploading = state(schema.node('widget', { block: { id: 'img-1', pendingUploadId: 'u1' } }));
    expect(duplicateBlock(uploading, blockUnitAt(uploading.doc, 1)!)).toBeNull();
  });

  it('delete a block; the last block of a section leaves an empty line', () => {
    const two = state(p('一'), p('二'));
    expect(texts(two.apply(deleteBlock(two, blockUnitAt(two.doc, inside(two.doc, 0))!)).doc)).toEqual(['二']);
    const one = state(p('只有一行'));
    const emptied = one.apply(deleteBlock(one, blockUnitAt(one.doc, inside(one.doc, 0))!)).doc;
    expect(texts(emptied)).toEqual(['']);
    expect(emptied.firstChild!.firstChild!.type.name).toBe('paragraph');
  });
});
