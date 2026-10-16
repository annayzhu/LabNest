import { describe, expect, it } from 'vitest';
import { createEmptyProtocolDocument } from './protocol-document';
import { diffProtocolVersions } from './protocol-diff';

function base() {
  const document = createEmptyProtocolDocument();
  document.systems = { schemaVersion: 1, presets: [], rules: [], restrictions: [],
    dimensions: [{ id: 'volume', label: '裂解液', options: [{ id: 's', label: '350 µL' }, { id: 'l', label: '600 µL' }] }],
    parameters: [
      { id: 'pk', label: 'Proteinase K', unit: 'µL', source: { kind: 'lookup', values: [{ id: 'a', when: { all: [{ dimensionId: 'volume', optionId: 's' }] }, value: 50, unit: 'µL' }, { id: 'b', when: { all: [{ dimensionId: 'volume', optionId: 'l' }] }, value: 80, unit: 'µL' }] } },
      { id: 'time', label: '', unit: 'min', source: { kind: 'fixed', value: 10, unit: 'min' } },
    ] };
  document.sections.find(section => section.key === 'steps')!.blocks = [
    { id: 'b1', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: '加入 {{pk}} Proteinase K。' }] }], execution: { role: 'step', stepId: 's1', format: 'block' } },
    { id: 'b2', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: '孵育 {{time}}。' }] }], execution: { role: 'step', stepId: 's2', format: 'block' } },
  ];
  document.sources = [{ id: 'src-1', kind: 'doi', title: 'Qiagen DNeasy handbook', citation: '10.1000/handbook' }];
  return document;
}

describe('版本对比', () => {
  it('reports changed blocks with chip values, parameter settings and sources, and ignores what stayed the same', () => {
    const a = base(), b = base();
    b.systems!.parameters[1].source = { kind: 'fixed', value: 12, unit: 'min' };
    b.systems!.parameters.push({ id: 'spin', label: '离心', unit: '×g', source: { kind: 'fixed', value: 12000, unit: '×g' } });
    const steps = b.sections.find(section => section.key === 'steps')!.blocks;
    steps.push({ id: 'b3', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: '离心 {{spin}}。' }] }], execution: { role: 'step', stepId: 's3', format: 'block' } });
    b.sources = [{ id: 'src-1', kind: 'doi', title: 'Qiagen DNeasy handbook', citation: '10.1000/handbook' }, { id: 'src-exp-1', kind: 'experiment', title: 'EXP-012' }];
    const diff = diffProtocolVersions(a, b);
    expect(diff.sections).toEqual([{ key: 'steps', title: 'Steps', entries: [
      { id: 'b2', label: '第 2 步', before: '孵育 10 min。', after: '孵育 12 min。', change: 'changed' },
      { id: 'b3', label: '第 3 步', after: '离心 12,000 ×g。', change: 'added' },
    ] }]);
    expect(diff.parameters).toEqual([
      { id: 'time', label: '时间', before: '10 min', after: '12 min', change: 'changed' },
      { id: 'spin', label: '离心', after: '12,000 ×g', change: 'added' },
    ]);
    expect(diff.sources).toEqual([{ id: 'src-exp-1', label: 'EXP-012', after: 'EXP-012', change: 'added' }]);
    expect(diff.counts).toEqual({ added: 3, removed: 0, changed: 2 });
  });

  it('shows per-system values in words and notices a removed block', () => {
    const a = base(), b = base();
    b.sections.find(section => section.key === 'steps')!.blocks.pop();
    b.systems!.parameters[0].source = { kind: 'lookup', values: [{ id: 'a', when: { all: [{ dimensionId: 'volume', optionId: 's' }] }, value: 55, unit: 'µL' }, { id: 'b', when: { all: [{ dimensionId: 'volume', optionId: 'l' }] }, value: 80, unit: 'µL' }] };
    const diff = diffProtocolVersions(a, b);
    // The lysis step reads differently too, because its chip now shows 55 µL for the small system.
    expect(diff.sections[0].entries).toEqual([expect.objectContaining({ id: 'b1', change: 'changed' }), { id: 'b2', label: '第 2 步', before: '孵育 10 min。', change: 'removed' }]);
    expect(diff.parameters).toEqual([{ id: 'pk', label: 'Proteinase K', before: '350 µL：50 µL；600 µL：80 µL', after: '350 µL：55 µL；600 µL：80 µL', change: 'changed' }]);
    expect(diffProtocolVersions(a, a).counts).toEqual({ added: 0, removed: 0, changed: 0 });
  });
});
