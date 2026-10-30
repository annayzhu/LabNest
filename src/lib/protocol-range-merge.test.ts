import { describe, expect, it } from 'vitest';
import { mergeRangePairs } from './protocol-range-merge';
import type { ProtocolSystems } from './protocol-systems-schema';

const fixed = (id: string, value: number, unit: string, extra: object = {}) => ({ id, label: '', unit, origin: 'chip' as const, source: { kind: 'fixed' as const, value, unit }, ...extra });
const paragraph = (text: string, stepId: string) => ({ id: `b-${stepId}`, type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text }] }], execution: { role: 'step', stepId, format: 'block' } });

describe('Two-chip ranges in draft Protocols become one range chip', () => {
  it('merges "{{a}} - {{b}}" into the first chip without an adopted value, drops the second and points its timer at the range', () => {
    const systems: ProtocolSystems = { schemaVersion: 1, dimensions: [], presets: [], restrictions: [],
      rules: [{ id: 'r1', target: 'step', targetId: 's1', when: {}, parameterIds: [], optional: false, actualFields: [], timerParameterId: 'p-30' }],
      parameters: [fixed('p-80', -80, '°C'), fixed('p-20', 20, 'min'), fixed('p-30', 30, 'min'), fixed('p-250', 250, 'µL', { materialRef: { name: 'LB or SOC media' } }), fixed('p-1000', 1000, 'µL', { materialRef: { name: 'LB or SOC media' } }), fixed('p-42', 42, '°C'), fixed('p-45', 45, 's')] };
    const document = { systems, sections: [{ key: 'steps', title: 'Steps', blocks: [
      paragraph('Take cells out of {{p-80}} and thaw on ice (approximately {{p-20}} - {{p-30}} ).', 's1'),
      paragraph('Add {{p-250}} –  {{p-1000}} LB or SOC media.', 's2'),
      paragraph('Heat shock at {{p-42}} - {{p-45}}.', 's3'),
      paragraph('Incubate on ice for {{p-20}} - {{p-30}}.', 's4'),
    ] }] };
    const { document: merged, merged: report } = mergeRangePairs(document);
    expect(report).toEqual([{ id: 'p-20', removed: 'p-30', range: '20–30 min' }, { id: 'p-250', removed: 'p-1000', range: '250–1000 µL' }]);
    expect(JSON.stringify(merged.sections)).toContain('approximately {{p-20}} ).');
    expect(JSON.stringify(merged.sections)).toContain('Add {{p-250}} LB or SOC media.');
    // The same pair written again is the same range.
    expect(JSON.stringify(merged.sections)).toContain('Incubate on ice for {{p-20}}.');
    // Different kinds of value are not a range.
    expect(JSON.stringify(merged.sections)).toContain('{{p-42}} - {{p-45}}');
    expect(merged.systems.parameters.map(p => p.id)).toEqual(['p-80', 'p-20', 'p-250', 'p-42', 'p-45']);
    expect(merged.systems.parameters[1]).toMatchObject({ source: { kind: 'fixed', value: null, unit: 'min' }, range: { min: { value: 20, unit: 'min' }, max: { value: 30, unit: 'min' } } });
    expect(merged.systems.parameters[2].materialRef).toEqual({ name: 'LB or SOC media' });
    expect(merged.systems.rules[0].timerParameterId).toBe('p-20');
  });

  it('changes nothing in a document without such pairs', () => {
    const document = { systems: { schemaVersion: 1 as const, dimensions: [], presets: [], restrictions: [], rules: [], parameters: [fixed('p-5', 5, 'min')] }, sections: [{ key: 'steps', title: 'Steps', blocks: [paragraph('Spin {{p-5}}.', 's1')] }] };
    expect(mergeRangePairs(document)).toEqual({ document, merged: [] });
  });
});
