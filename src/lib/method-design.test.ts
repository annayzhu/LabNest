import { describe, expect, it } from 'vitest';
import { checkMethodCard, parseMethodCard } from './method-card';
import { chipifyText, designDraft } from './method-design';
import { blankProtocolSystems } from './protocol-systems-schema';
import { projectProtocolExecution } from './protocol-execution';
import { resolveProtocolDocument } from './structured-protocol';
import { tiptapToProtocolDocument, protocolDocumentToTiptap } from './protocol-tiptap';

let counter = 0;
const newId = (prefix: string) => `${prefix}-${++counter}`;

describe('方案设计草稿', () => {
  it('turns every single quantity into a fixed chip and leaves per-system values as text', () => {
    const systems = blankProtocolSystems();
    const text = chipifyText('加入 20 µL Proteinase K 和 180 µL Buffer ATL，56 °C 孵育 1 h；小体系 50/80 µL。', systems, newId);
    expect(text).toMatch(/^加入 \{\{p-\d+\}\} Proteinase K 和 \{\{p-\d+\}\} Buffer ATL，\{\{p-\d+\}\} 孵育 \{\{p-\d+\}\}；小体系 50\/80 µL。$/);
    expect(systems.parameters.map(p => [p.source.kind === 'fixed' ? p.source.value : null, p.unit])).toEqual([[1, 'h'], [56, '°C'], [180, 'µL'], [20, 'µL']]);
  });

  it('builds a draft whose steps execute, with the source cited and the unverified count kept', () => {
    counter = 0;
    const source = 'Step 1\nAdd 20 µL Proteinase K to 180 µL Buffer ATL.\nIncubate at 56 °C for 1 h.\n\nStep 2\nAdd 200 µL Buffer AL and vortex.';
    const card = checkMethodCard(parseMethodCard(JSON.stringify({ summary: '柱式提取', materials: [{ text: 'Buffer ATL', quote: 'Buffer ATL' }, { text: 'Buffer XX', quote: 'Buffer XX' }], keyParameters: [{ text: '56 °C 1 h', quote: 'Incubate at 56 °C for 1 h' }] })), source);
    const hit = { key: 'protocols_io:42', source: 'protocols_io' as const, externalId: '42', title: 'DNeasy tissue', authors: 'Qiagen', year: '2020', url: 'https://www.protocols.io/view/x' };
    const text = { title: 'DNeasy tissue', sections: [{ title: 'Materials', text: 'Buffer ATL, Buffer AL' }, { title: 'Step 1', text: 'Add 20 µL Proteinase K to 180 µL Buffer ATL.\nIncubate at 56 °C for 1 h.' }, { title: 'Step 2', text: 'Add 200 µL Buffer AL and vortex.' }], text: source, license: 'CC BY 4.0', url: 'https://www.protocols.io/view/x', fetchedAt: '2026-10-15T00:00:00Z' };
    const { document, title } = designDraft({ goal: '组织 DNA 提取', sampleType: '小鼠肝', hit, text, card, sessionId: 'sess-1', newId });
    expect(title).toBe('DNeasy tissue');
    const steps = projectProtocolExecution(document);
    expect(steps.executionNeedsReview).toBe(false);
    expect(steps.steps).toHaveLength(2);
    expect(document.systems!.parameters).toHaveLength(5);
    const resolved = resolveProtocolDocument(document, {}).steps;
    expect(resolved.every(step => !step.blocked)).toBe(true);
    // Chips read as their values; the second paragraph stays with its step.
    expect(resolved.map(step => step.description)).toEqual(['Add 20 µL Proteinase K to 180 µL Buffer ATL.\nIncubate at 56 °C for 1 h.', 'Add 200 µL Buffer AL and vortex.']);
    const description = document.sections.find(section => section.key === 'description')!.blocks;
    expect(description[0]).toMatchObject({ type: 'callout', tone: 'warning' });
    expect((description[0] as { text: string }).text).toContain('有 1 条未核实');
    expect((description[0] as { text: string }).text).toContain('许可：CC BY 4.0');
    expect(document.sections.find(section => section.key === 'material')!.blocks[0]).toMatchObject({ type: 'table', rows: [['Name', 'Unit', 'Role', 'Notes'], ['Buffer ATL', '', '', ''], ['Buffer XX', '', '', '未核实']] });
    expect(document.sources).toEqual([{ id: 'src-design-protocols_io-42', kind: 'protocols_io', title: 'DNeasy tissue', citation: 'Qiagen, 2020', url: 'https://www.protocols.io/view/x', license: 'CC BY 4.0', accessedAt: '2026-10-15T00:00:00Z', note: '方案设计检索所得' }]);
    expect(document.provenance).toMatchObject({ design: { sessionId: 'sess-1', hitKey: 'protocols_io:42', unverified: 1 } });
    // The editor can open and save it without loss.
    const roundTrip = tiptapToProtocolDocument(protocolDocumentToTiptap(document), [], true, document.systems);
    expect(resolveProtocolDocument(roundTrip, {}).steps.map(step => step.description)).toEqual(resolved.map(step => step.description));
  });
});
