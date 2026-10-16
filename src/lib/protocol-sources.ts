import type { ProtocolSource } from './protocol-document';

export const sourceKindLabels: Record<ProtocolSource['kind'], string> = {
  doi: '文献（DOI）', url: '网页', protocols_io: 'protocols.io', pmc: 'PMC 全文', book: '书籍／手册', colleague: '同事传授', docx: 'Word 导入', experiment: '实验整理', other: '其他',
};
const doiPattern = /\b10\.\d{4,9}\/[^\s"<>]+/;

export const newProtocolSource = (kind: ProtocolSource['kind'] = 'url'): ProtocolSource => ({ id: `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, kind, title: '' });

/** Where a reader can follow the source: its link, or the DOI resolver when only a DOI was written. */
export function sourceHref(source: ProtocolSource) {
  if (source.url) return source.url;
  const doi = `${source.citation ?? ''} ${source.title}`.match(doiPattern)?.[0];
  return doi ? `https://doi.org/${doi.replace(/[.,;:)]+$/, '')}` : undefined;
}

/** One line: what it is, how to cite it, under what license, and when it was read. */
export function formatProtocolSource(source: ProtocolSource) {
  return [source.title.trim() || sourceKindLabels[source.kind], source.citation?.trim(), source.license ? `许可：${source.license}` : '', source.accessedAt ? `获取于 ${source.accessedAt.slice(0, 10)}` : '', source.note?.trim()].filter(Boolean).join(' · ');
}
