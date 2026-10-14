import { protocolDocumentSchema } from './protocol-document';

/** Legacy column-only records are supported. Authored trees must never silently lose fields. */
export function protocolCompatibilityIssue(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || !('sections' in value || 'schemaVersion' in value)) return;
  const parsed = protocolDocumentSchema.safeParse(value);
  if (!parsed.success) return '此版本包含暂不支持的内容，已进入兼容只读视图。原文与附件引用保留，不能用不完整投影覆盖保存。';
  const missing = (source: unknown, target: unknown, path: string): string | undefined => {
    if (!source || typeof source !== 'object') return;
    if (!target || typeof target !== 'object') return path;
    for (const [key, item] of Object.entries(source)) {
      if (!(key in target)) return `${path}.${key}`;
      const child = missing(item, (target as Record<string, unknown>)[key], `${path}.${key}`);
      if (child) return child;
    }
  };
  // Rich cell subtrees intentionally preserve arbitrary JSON in storage. Tiptap,
  // however, drops unknown node/mark types: route them to the same read-only path.
  const nodes = new Set(['doc', 'paragraph', 'text', 'heading', 'hardBreak', 'blockquote', 'bulletList', 'orderedList', 'listItem', 'taskList', 'taskItem', 'table', 'tableRow', 'tableCell', 'tableHeader', 'horizontalRule', 'codeBlock', 'documentMedia', 'protocolParameter']);
  const marks = new Set(['bold', 'italic', 'strike', 'underline', 'code', 'link', 'textStyle', 'highlight', 'subscript', 'superscript']);
  const unknownTree = (tree: unknown): boolean => Array.isArray(tree) ? tree.some(unknownTree) : Boolean(tree && typeof tree === 'object' && (
    typeof (tree as {type?: unknown}).type === 'string' && !nodes.has((tree as {type: string}).type) ||
    Array.isArray((tree as {marks?: unknown}).marks) && (tree as {marks: {type: string}[]}).marks.some(mark => !marks.has(mark.type)) ||
    unknownTree((tree as {content?: unknown}).content)
  ));
  const scan = (entry: unknown): boolean => Boolean(entry && typeof entry === 'object' && Object.entries(entry).some(([key, child]) => ['cellRichContent', 'childContent'].includes(key) ? unknownTree(child) : scan(child)));
  if (scan(value)) return '此版本包含编辑器暂不支持的富文本节点，已进入兼容只读视图；原内容不会被覆盖。';
  const dropped = missing(value, parsed.data, 'document');
  return dropped ? `此版本包含未知字段 ${dropped}，请使用兼容只读视图；原内容不会被覆盖。` : undefined;
}
