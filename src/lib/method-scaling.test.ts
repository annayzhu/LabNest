import { describe, expect, it } from 'vitest';
import { createEmptyProtocolDocument } from './protocol-document';
import { resolveProtocolDocument } from './structured-protocol';
import { buildScalingPrompt, describeScaleChange, scaleChangeLine, scaleProtocol } from './method-scaling';

let counter = 0;
const newId = (prefix: string) => `${prefix}-${++counter}`;

function pcr() {
  const document = createEmptyProtocolDocument();
  document.executionConfirmed = true;
  document.systems = { schemaVersion: 1, dimensions: [{ id: 'lysis', label: '裂解液', options: [{ id: 's', label: '350 µL' }, { id: 'l', label: '600 µL' }] }], presets: [], rules: [], restrictions: [],
    tools: [{ id: 'tool-1', kind: 'centrifuge', fields: [{ key: 'speed', parameterId: 'p-speed' }] }],
    parameters: [
      { id: 'p-mix', label: '', unit: 'µL', materialRef: { name: '2× SYBR Mix' }, source: { kind: 'fixed', value: 10, unit: 'µL' } },
      { id: 'p-primer', label: '', unit: 'µL', source: { kind: 'fixed', value: 0.4, unit: 'µL' } },
      { id: 'p-template', label: '', unit: 'ng', source: { kind: 'fixed', value: 50, unit: 'ng' } },
      { id: 'p-time', label: '', unit: 'min', source: { kind: 'fixed', value: 10, unit: 'min' } },
      { id: 'p-temp', label: '', unit: '°C', source: { kind: 'fixed', value: 95, unit: '°C' } },
      { id: 'p-cells', label: '细胞', unit: 'cells', source: { kind: 'fixed', value: 200000, unit: 'cells' } },
      { id: 'p-speed', label: '', unit: '×g', ownerToolId: 'tool-1', source: { kind: 'fixed', value: 12000, unit: '×g' } },
      { id: 'p-pk', label: 'Proteinase K', unit: 'µL', source: { kind: 'lookup', values: [{ id: 'a', when: { all: [{ dimensionId: 'lysis', optionId: 's' }] }, value: 50, unit: 'µL' }, { id: 'b', when: { all: [{ dimensionId: 'lysis', optionId: 'l' }] }, value: 80, unit: 'µL' }] } },
    ] };
  document.sections.find(section => section.key === 'steps')!.blocks = [{ id: 'b1', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: '{{p-mix}} {{p-primer}} {{p-template}} {{p-time}} {{p-temp}} {{p-cells}} {{tool-1}} {{p-pk}}' }] }], execution: { role: 'step', stepId: 's1', format: 'block' } }];
  return document;
}

describe('体系调整', () => {
  it('scales amounts into a new system dimension, keeps settings, flags counts, and never touches lookup tables', () => {
    const source = pcr();
    const { document, changes, dimensionId } = scaleProtocol(source, { value: 20, unit: 'µL' }, { value: 10, unit: 'µL' }, { newId });
    expect(changes.map(change => [change.label, change.before, change.after, change.rule, change.note])).toEqual([
      ['2× SYBR Mix', '10 µL', '5 µL', 'linear', undefined],
      ['体积', '0.4 µL', '0.2 µL', 'linear', '低于移液下限 0.5 µL，建议配预混液或换体系'],
      ['质量', '50 ng', '25 ng', 'linear', undefined],
      ['时间', '10 min', '10 min', 'kept', undefined],
      ['温度', '95 °C', '95 °C', 'kept', undefined],
      ['细胞', '200,000 cells', '200,000 cells', 'manual', '细胞数、酶活单位等不按比例换算，请人工确认'],
    ]);
    // The stored callout keeps the Chinese line; the screen reads the English one.
    expect(describeScaleChange(changes[1])).toBe('体积：0.4 µL → 0.2 µL，低于移液下限 0.5 µL，建议配预混液或换体系');
    expect(changes.slice(1).map(scaleChangeLine)).toEqual(['体积: 0.4 µL → 0.2 µL, below the pipetting minimum of 0.5 µL; use a premix or another system', '质量: 50 ng → 25 ng',
      '时间: 10 min → 10 min (kept)', '温度: 95 °C → 95 °C (kept)', '细胞: 200,000 cells → 200,000 cells (confirm by hand), cell numbers, enzyme units and the like don’t scale; confirm by hand']);
    const dimension = document.systems!.dimensions.find(item => item.id === dimensionId)!;
    expect(dimension).toMatchObject({ label: '反应体系', options: [{ label: '20 µL' }, { label: '10 µL' }] });
    // The run chooses the system; the original values are the first option, the scaled ones the second.
    const small = resolveProtocolDocument(document, { lysis: 's', [dimensionId]: dimension.options[1].id }).steps[0].description;
    expect(small).toBe('5 µL 0.2 µL 25 ng 10 min 95 °C 200,000 cells 离心 12,000 ×g 50 µL');
    expect(resolveProtocolDocument(document, { lysis: 'l', [dimensionId]: dimension.options[0].id }).steps[0].description).toBe('10 µL 0.4 µL 50 ng 10 min 95 °C 200,000 cells 离心 12,000 ×g 80 µL');
    expect(source.systems!.parameters.find(p => p.id === 'p-mix')!.source).toEqual({ kind: 'fixed', value: 10, unit: 'µL' });
  });

  it('refuses a target that cannot be converted and explains without inventing numbers', () => {
    expect(() => scaleProtocol(pcr(), { value: 20, unit: 'µL' }, { value: 10, unit: 'min' }, { newId })).toThrow();
    const prompt = buildScalingPrompt({ from: { value: 20, unit: 'µL' }, to: { value: 10, unit: 'µL' }, changes: [{ parameterId: 'p', label: '2× SYBR Mix', before: '10 µL', after: '5 µL', rule: 'linear' }] });
    expect(prompt.system).toContain('不要给出新的数值');
    expect(prompt.user).toContain('2× SYBR Mix：10 µL → 5 µL（按比例）');
  });
});
