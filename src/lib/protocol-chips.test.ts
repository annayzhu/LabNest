import { describe, expect, it } from 'vitest';
import { recognizeQuantity } from './protocol-chips';

const recognized = (typed: string) => {
  const result = recognizeQuantity(typed);
  return result && { values: result.values, unit: result.unit, kind: result.kind, text: result.text };
};

describe('Typing a value with its unit becomes a parameter chip', () => {
  it('recognizes the agreed writings for volume, time, temperature, centrifugation and pH', () => {
    expect(recognized('加入 50 µL ')).toEqual({ values: [50], unit: 'µL', kind: 'volume', text: '50 µL' });
    expect(recognized('加入50uL，')).toMatchObject({ values: [50], unit: 'µL' });
    expect(recognized('加入 50 μL,')).toMatchObject({ values: [50], unit: 'µL' });
    expect(recognized('补足至 1.5 mL ')).toMatchObject({ values: [1.5], unit: 'mL', kind: 'volume' });
    expect(recognized('定容到 1 L。')).toMatchObject({ values: [1], unit: 'L' });
    expect(recognized('静置 30 s ')).toMatchObject({ values: [30], unit: 's', kind: 'time' });
    expect(recognized('静置 30 sec ')).toMatchObject({ values: [30], unit: 's' });
    expect(recognized('静置30秒，')).toMatchObject({ values: [30], unit: 's' });
    expect(recognized('孵育 5 min ')).toMatchObject({ values: [5], unit: 'min', kind: 'time' });
    expect(recognized('孵育5分钟；')).toMatchObject({ values: [5], unit: 'min' });
    expect(recognized('培养 2 h ')).toMatchObject({ values: [2], unit: 'h' });
    expect(recognized('培养2小时，')).toMatchObject({ values: [2], unit: 'h' });
    expect(recognized('置于 37 ℃ ')).toMatchObject({ values: [37], unit: '°C', kind: 'temperature' });
    expect(recognized('4 °C，')).toMatchObject({ values: [4], unit: '°C' });
    expect(recognized('保存于 -20 °C ')).toMatchObject({ values: [-20], unit: '°C' });
    expect(recognized('离心 12,000 ×g ')).toMatchObject({ values: [12000], unit: '×g', kind: 'rcf' });
    expect(recognized('离心 12000 xg ')).toMatchObject({ values: [12000], unit: '×g' });
    expect(recognized('摇床 200 rpm ')).toMatchObject({ values: [200], unit: 'rpm', kind: 'speed' });
    expect(recognized('调至 pH 7.4 ')).toEqual({ values: [7.4], unit: 'pH', kind: 'ph', text: 'pH 7.4' });
    expect(recognized('调至pH7.4，')).toMatchObject({ values: [7.4], unit: 'pH' });
  });

  it('keeps one value per system when the author writes values separated by slashes', () => {
    expect(recognized('加入 50/80 µL ')).toMatchObject({ values: [50, 80], unit: 'µL', text: '50/80 µL' });
    expect(recognized('加入 50 / 80 / 100 µL，')).toMatchObject({ values: [50, 80, 100], unit: 'µL' });
  });

  it('leaves ranges, unfinished numbers and words that only contain digits as ordinary text', () => {
    expect(recognizeQuantity('室温 20–25 °C ')).toBeUndefined();
    expect(recognizeQuantity('室温 20-25 °C ')).toBeUndefined();
    expect(recognizeQuantity('调至 pH 7.')).toBeUndefined();
    expect(recognizeQuantity('加入 2.')).toBeUndefined();
    expect(recognizeQuantity('使用 A549 细胞 ')).toBeUndefined();
    expect(recognizeQuantity('abc5 mL ')).toBeUndefined();
    expect(recognizeQuantity('加入 50 µL')).toBeUndefined();
  });
});

describe('Saving a Protocol keeps only the chips still written in it', () => {
  it('drops deleted chips and their tool fields, but keeps named parameters and everything still referenced', async () => {
    const { createEmptyProtocolDocument } = await import('./protocol-document');
    const { pruneUnusedChips } = await import('./protocol-chips');
    const document = createEmptyProtocolDocument();
    const fixed = (id: string, extra: object = {}) => ({ id, label: '', unit: 'µL', origin: 'chip' as const, source: { kind: 'fixed' as const, value: 1, unit: 'µL' }, ...extra });
    document.systems = { schemaVersion: 1, dimensions: [], presets: [], restrictions: [], rules: [], parameters: [
      fixed('kept'), fixed('deleted'), { id: 'named', label: '母液浓度', unit: 'µL', source: { kind: 'fixed', value: 2, unit: 'µL' } },
      fixed('spin-a', { ownerToolId: 'spin' }), fixed('spin-b', { ownerToolId: 'spin' }), fixed('old-a', { ownerToolId: 'old' })],
      tools: [{ id: 'spin', kind: 'centrifuge', fields: [{ key: 'speed', parameterId: 'spin-a' }, { key: 'time', parameterId: 'spin-b' }] }, { id: 'old', kind: 'vacuum', fields: [{ key: 'pressure', parameterId: 'old-a' }] }] };
    document.sections.find(s => s.key === 'steps')!.blocks = [{ id: 'a', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: '加入 {{kept}}，{{spin}}。' }] }] }];
    const saved = pruneUnusedChips(document);
    expect(saved.systems!.parameters.map(p => p.id)).toEqual(['kept', 'named', 'spin-a', 'spin-b']);
    expect(saved.systems!.tools!.map(t => t.id)).toEqual(['spin']);
    expect(document.systems.parameters).toHaveLength(6);
  });
});

describe('Values separated by slashes belong to one system dimension', () => {
  const option = (id: string, label: string, extra: object = {}) => ({ id, label, ...extra });
  const systems = { schemaVersion: 1 as const, presets: [], restrictions: [], rules: [], parameters: [], dimensions: [
    { id: 'volume', label: '体积', options: [option('v350', '350 µL'), option('v600', '600 µL')] },
    { id: 'tissue', label: '样本', kind: 'condition' as const, options: [option('fatty', '富脂组织'), option('lean', '普通组织')] },
    { id: 'plate', label: '板型', options: [option('p6', '6 孔板'), option('p12', '12 孔板', { symbol: 'triangle' }), option('t25', 'T25')] },
  ] };

  it('uses the only dimension with that many options, asks when several fit, remembers the answer, and otherwise offers a new system', async () => {
    const { splitDimension } = await import('./protocol-chips');
    expect(splitDimension(3, systems)).toEqual({ dimensionId: 'plate' });
    expect(splitDimension(2, systems)).toEqual({ candidates: ['volume', 'tissue'] });
    expect(splitDimension(2, { ...systems, splitChoices: { 2: 'tissue' } })).toEqual({ dimensionId: 'tissue' });
    expect(splitDimension(2, { ...systems, splitChoices: { 2: 'removed-dimension' } })).toEqual({ candidates: ['volume', 'tissue'] });
    expect(splitDimension(4, systems)).toEqual({ create: true });
  });

  it('remembers the answer with the Protocol, so it still applies after reopening', async () => {
    const { splitDimension } = await import('./protocol-chips');
    const { protocolSystemsSchema } = await import('./protocol-systems-schema');
    const saved = protocolSystemsSchema.parse({ ...systems, splitChoices: { 2: 'tissue' } });
    expect(splitDimension(2, saved)).toEqual({ dimensionId: 'tissue' });
  });

  it('keeps one typed value per option, in the legend order', async () => {
    const { splitLookupSource } = await import('./protocol-chips');
    let next = 0;
    expect(splitLookupSource([6, 12, 25], 'mL', systems.dimensions[2], () => `value-${++next}`)).toEqual({ kind: 'lookup', values: [
      { id: 'value-1', when: { all: [{ dimensionId: 'plate', optionId: 'p6' }] }, value: 6, unit: 'mL' },
      { id: 'value-2', when: { all: [{ dimensionId: 'plate', optionId: 'p12' }] }, value: 12, unit: 'mL' },
      { id: 'value-3', when: { all: [{ dimensionId: 'plate', optionId: 't25' }] }, value: 25, unit: 'mL' }] });
  });

  it('gives each system option a unique symbol, keeping the ones the author chose; conditions are named instead', async () => {
    const { optionMarks } = await import('./protocol-chips');
    const marks = optionMarks(systems);
    expect(['volume:v350', 'volume:v600', 'plate:p6', 'plate:p12', 'plate:t25'].map(key => marks.get(key)?.glyph)).toEqual(['■', '●', '◆', '▲', '★']);
    expect(marks.get('tissue:fatty')?.glyph).toBeUndefined();
    expect(marks.get('tissue:fatty')).toMatchObject({ label: '富脂组织', condition: true });
  });

  it('gives each system option its own colour, keeping the colours the author chose', async () => {
    const { optionMarks } = await import('./protocol-chips');
    const chosen = { ...systems, dimensions: systems.dimensions.map(d => d.id === 'plate' ? { ...d, options: d.options.map(o => o.id === 't25' ? { ...o, tone: 0 } : o) } : d) };
    const marks = optionMarks(chosen);
    const tones = ['volume:v350', 'volume:v600', 'plate:p6', 'plate:p12', 'plate:t25'].map(key => marks.get(key)?.tone);
    expect(tones.at(-1)).toBe(0);
    expect(new Set(tones).size).toBe(5);
  });
});
