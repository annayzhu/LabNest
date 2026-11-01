import { describe, expect, it } from 'vitest';
import { getSchema, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { slashOpensMenu, slashQuery } from './editor-slash';

const schema = getSchema([StarterKit]);
/** A one-paragraph document with the caret after `text`. */
const line = (text: string) => {
  const doc = schema.node('doc', null, [schema.node('paragraph', null, text ? [schema.text(text)] : [])]);
  return EditorState.create({ doc, selection: TextSelection.create(doc, 1 + text.length) });
};
const view = (state: EditorState, composing = false) => ({ state, composing }) as unknown as EditorView;

describe('slash command menu', () => {
  it('opens at the start of a line, after a space and after Chinese punctuation', () => {
    expect(slashOpensMenu(view(line('')), 1, '/')).toBe(true);
    expect(slashOpensMenu(view(line('细胞贴壁 ')), 6, '/')).toBe(true);
    expect(slashOpensMenu(view(line('注：以下步骤在冰上操作。')), 13, '、')).toBe(true);
  });

  it('opens right after a tag, which ends a word as a space does', () => {
    const tag = getSchema([StarterKit, Node.create({ name: 'tag', group: 'inline', inline: true, atom: true })]);
    const doc = tag.node('doc', null, [tag.node('paragraph', null, [tag.text('取 '), tag.node('tag')])]);
    expect(slashOpensMenu(view(EditorState.create({ doc, selection: TextSelection.create(doc, 4) })), 4, '/')).toBe(true);
  });

  it('stays closed inside a word, for ratios like 1/2 and while an IME composes', () => {
    expect(slashOpensMenu(view(line('1')), 2, '/')).toBe(false);
    expect(slashOpensMenu(view(line('苹果')), 3, '、')).toBe(false);
    expect(slashOpensMenu(view(line(''), true), 1, '/')).toBe(false);
  });

  it('follows what is typed after the slash, Chinese slashes included', () => {
    expect(slashQuery(line('/'), 1)).toBe('');
    expect(slashQuery(line('/bg'), 1)).toBe('bg');
    expect(slashQuery(line('、表格'), 1)).toBe('表格');
    expect(slashQuery(line('注意 ／sj'), 4)).toBe('sj');
  });

  it('closes once a space is typed, the slash is deleted or the query grows long', () => {
    expect(slashQuery(line('/bg '), 1)).toBeNull();
    expect(slashQuery(line(''), 1)).toBeNull();
    expect(slashQuery(line('bg'), 1)).toBeNull();
    expect(slashQuery(line(`/${'a'.repeat(24)}`), 1)).toBeNull();
  });
});
