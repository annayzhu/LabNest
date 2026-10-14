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
  const dropped = missing(value, parsed.data, 'document');
  return dropped ? `此版本包含未知字段 ${dropped}，请使用兼容只读视图；原内容不会被覆盖。` : undefined;
}
