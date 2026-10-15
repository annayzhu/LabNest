import { Extension, textblockTypeInputRule, type Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/**
 * LabNest documents keep two heading levels and no code blocks or rules (Entry's Markdown, experiment and Protocol rich text),
 * so StarterKit offers only what is saved: spread into `StarterKit.configure`.
 */
export const savedBlocksOnly = { heading: { levels: [2, 3] as Array<2 | 3> }, codeBlock: false as const, horizontalRule: false as const };

/** "# " starts a heading and "## " a subheading, the levels they are read back as. */
export const HeadingShortcuts = Extension.create({
  name: 'headingShortcuts',
  // Ahead of the heading's own "#" rules.
  priority: 101,
  addInputRules() {
    const type = this.editor.schema.nodes.heading;
    return [textblockTypeInputRule({ find: /^#\s$/, type, getAttributes: { level: 2 } }), textblockTypeInputRule({ find: /^#{2,3}\s$/, type, getAttributes: { level: 3 } })];
  },
});

/** On a page, an empty line points to "/" and an empty heading names its level; an empty document shows its own prompt. */
export const writingPlaceholder = (empty: string) => ({ editor, node }: { editor: Editor; node: ProseMirrorNode }) =>
  editor.isEmpty ? empty : node.type.name === 'heading' ? (node.attrs.level === 2 ? '标题' : '小标题') : node.type.name === 'paragraph' ? '输入 / 插入标题、清单、图片、表格或时间' : '';
