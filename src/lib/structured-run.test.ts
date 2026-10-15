import { expect, it } from 'vitest';
import { createEmptyProtocolDocument } from './protocol-document';
import { structuredRunView, assertStructuredStepExecutable, runStepNotes, stepQuantities } from './structured-run';

it('resolves treatment groups independently and never borrows one group value for shared work', () => {
  const source = createEmptyProtocolDocument();
  source.executionConfirmed = true;
  source.systems = { schemaVersion: 1, dimensions: [{ id: 'volume', label: '体积', options: [{ id: 's', label: '350 µL' }, { id: 'l', label: '600 µL' }] }], presets: [], restrictions: [], rules: [], parameters: [{ id: 'dose', label: '用量', unit: 'µL', source: { kind: 'lookup', values: [{ id: 's', when: { all: [{ dimensionId: 'volume', optionId: 's' }] }, value: 50, unit: 'µL' }, { id: 'l', when: { all: [{ dimensionId: 'volume', optionId: 'l' }] }, value: 80, unit: 'µL' }] } }] };
  source.sections.find(s => s.key === 'steps')!.blocks = [{ id: 'dose', type: 'text', text: '加入 {{dose}}', execution: { role: 'step', stepId: 'dose', title: '加样' } }];
  const adopted = (volume: string) => ({ selections: { volume }, actualInputs: {}, confirmedAt: '2026-10-14T01:00:00Z' });
  const plan = { schemaVersion: 1, revision: 2, groups: [{ id: 'a', label: 'A组' }, { id: 'b', label: 'B组' }], stepGroups: { a: 'a', b: 'b', shared: 'shared' }, versions: { 'v1@a': adopted('s'), 'v1@b': adopted('l') }, actualValues: {}, skips: {} };
  const view = structuredRunView({ versions: [{ protocolVersionId: 'v1', contentJson: source }] }, plan, ['a', 'b', 'shared'].map(id => ({ id, groupKey: 'v1', protocolStepRef: 'v1:dose', completed: false })));
  expect(view.steps.a.description).toBe('加入 50 µL');
  expect(view.steps.b.description).toBe('加入 80 µL');
  expect(view.steps.shared.blocked).toBe(true);
  expect(view.steps.shared.description).toContain('各组');
  expect(() => assertStructuredStepExecutable(view, 'shared', 2)).toThrow();
});

const document = createEmptyProtocolDocument();
document.executionConfirmed = true;
document.systems = { schemaVersion: 1, dimensions: [{ id: 'volume', label: '体积', options: [{ id: 's', label: '350 µL' }, { id: 'l', label: '600 µL' }] }], presets: [], parameters: [], restrictions: [], rules: [{ id: 'only-large', target: 'step', targetId: 'wash', when: { all: [{ dimensionId: 'volume', optionId: 'l' }] }, parameterIds: [], optional: false, actualFields: [] }] };
document.sections.find(s => s.key === 'steps')!.blocks = [{ id: 'wash-heading', type: 'heading', text: 'Wash', execution: { role: 'step', stepId: 'wash', title: 'Wash' } }];
const snapshot = { versions: [{ protocolVersionId: 'v1', title: 'Frozen protocol', displayVersion: '1.0', contentJson: document }] };
const step = { id: 'run-step', protocolStepRef: 'v1:wash', groupKey: 'v1', completed: false };

it('requires the selected frozen plan and its revision before a dependent operation', () => {
  const initial = structuredRunView(snapshot, {}, [step]);
  expect(initial.steps['run-step']).toMatchObject({ applicability: 'unknown', blocked: true });
  expect(() => assertStructuredStepExecutable(initial, step.id, 0)).toThrow();
  const plan = { schemaVersion: 1, revision: 1, versions: { v1: { selections: { volume: 'l' }, confirmedAt: '2026-10-14T01:00:00.000Z', actualInputs: {} } }, actualValues: {}, skips: {} };
  const selected = structuredRunView(snapshot, plan, [step]);
  expect(selected.steps['run-step']).toMatchObject({ applicability: 'applicable', blocked: false });
  expect(() => assertStructuredStepExecutable(selected, step.id, 0)).toThrow(/changed|变更/);
  expect(() => assertStructuredStepExecutable(selected, step.id, 1)).not.toThrow();
  plan.versions.v1.selections.volume = 's';
  expect(() => assertStructuredStepExecutable(structuredRunView(snapshot, plan, [step]), step.id, 1)).toThrow();
});

it('lets a step with only fixed values run without a system choice, while a per-system value waits for the confirmed choice', () => {
  const source = createEmptyProtocolDocument();
  source.systems = { schemaVersion: 1, dimensions: [{ id: 'volume', label: '体积', options: [{ id: 's', label: '350 µL' }, { id: 'l', label: '600 µL' }] }], presets: [], restrictions: [], rules: [], parameters: [
    { id: 'wait', label: '', unit: 'min', origin: 'chip', source: { kind: 'fixed', value: 10, unit: 'min' } },
    { id: 'dose', label: '', unit: 'µL', origin: 'chip', source: { kind: 'lookup', values: [{ id: 's', when: { all: [{ dimensionId: 'volume', optionId: 's' }] }, value: 50, unit: 'µL' }, { id: 'l', when: { all: [{ dimensionId: 'volume', optionId: 'l' }] }, value: 80, unit: 'µL' }] } }] };
  source.sections.find(s => s.key === 'steps')!.blocks = [
    { id: 'w', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: '静置 {{wait}}' }] }], execution: { role: 'step', stepId: 'wait-step', format: 'block' } },
    { id: 'd', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: '加入 {{dose}}' }] }], execution: { role: 'step', stepId: 'dose-step', format: 'block' } }];
  const view = structuredRunView({ versions: [{ protocolVersionId: 'v1', contentJson: source }] }, {}, [
    { id: 'run-wait', protocolStepRef: 'v1:wait-step', groupKey: 'v1', completed: false },
    { id: 'run-dose', protocolStepRef: 'v1:dose-step', groupKey: 'v1', completed: false }]);
  expect(view.steps['run-wait']).toMatchObject({ title: '静置 10 min', blocked: false });
  expect(view.steps['run-dose'].blocked).toBe(true);
  expect(() => assertStructuredStepExecutable(view, 'run-wait', 0)).not.toThrow();
});

it('counts shared preparation once for all groups: its quantities are the sum of the groups\' counts', () => {
  const steps = { shared: { versionId: 'v1', groupId: 'shared' }, a: { versionId: 'v1@a', groupId: 'a' } } as unknown as Parameters<typeof stepQuantities>[0]['steps'];
  const plan = { groups: [{ id: 'a', label: 'A组' }, { id: 'b', label: 'B组' }], quantities: { 'v1@a': { 反应数: 12, 孔数: 6 }, 'v1@b': { 反应数: 8 } } } as unknown as Parameters<typeof stepQuantities>[0]['plan'];
  expect(stepQuantities({ steps, plan }, 'shared')).toEqual({ versionId: 'v1@a', quantities: { 反应数: 20 } });
  expect(stepQuantities({ steps, plan }, 'a')).toEqual({ versionId: 'v1@a', quantities: { 反应数: 12, 孔数: 6 } });
});

it('keeps the Protocol\'s notes where they were written, per group: once for shared preparation, passed on past a step the group does not do', () => {
  const source = createEmptyProtocolDocument();
  source.executionConfirmed = true;
  source.systems = { schemaVersion: 1, dimensions: [{ id: 'volume', label: '体积', options: [{ id: 's', label: '350 µL' }, { id: 'l', label: '600 µL' }] }], presets: [], parameters: [], restrictions: [], rules: [{ id: 'only-large', target: 'step', targetId: 'wash', when: { all: [{ dimensionId: 'volume', optionId: 'l' }] }, parameterIds: [], optional: false, actualFields: [] }] };
  const text = (id: string, value: string, execution: Record<string, string>) => ({ id, type: 'rich_text' as const, nodes: [{ type: 'paragraph' as const, content: [{ text: value }] }], execution: execution as never });
  source.sections.find(s => s.key === 'steps')!.blocks = [
    text('intro', '全程戴手套。', { role: 'info' }),
    text('prep', '预冷离心机。', { role: 'step', stepId: 'prep', format: 'block' }),
    text('ice', '注：以下步骤在冰上操作。', { role: 'info' }),
    text('wash', '大体系洗一次。', { role: 'step', stepId: 'wash', format: 'block' }),
    text('spin', '离心 5 min。', { role: 'step', stepId: 'spin', format: 'block' }),
    text('store', '完成后 −80 °C 保存。', { role: 'info' }),
  ];
  const adopted = (volume: string) => ({ selections: { volume }, actualInputs: {}, confirmedAt: '2026-10-15T01:00:00Z' });
  const runSteps = [['prep', 'prep'], ['a-wash', 'wash'], ['a-spin', 'spin'], ['b-wash', 'wash'], ['b-spin', 'spin']].map(([id, ref]) => ({ id, groupKey: 'v1', protocolStepRef: `v1:${ref}`, completed: false }));
  const plan = { schemaVersion: 1, revision: 1, groups: [{ id: 'a', label: '小体系' }, { id: 'b', label: '大体系' }], stepGroups: { prep: 'shared', 'a-wash': 'a', 'a-spin': 'a', 'b-wash': 'b', 'b-spin': 'b' }, versions: { 'v1@a': adopted('s'), 'v1@b': adopted('l') }, actualValues: {}, skips: {} };
  const notes = runStepNotes(structuredRunView({ versions: [{ protocolVersionId: 'v1', contentJson: source }] }, plan, runSteps));
  const ids = (record: Record<string, Array<{ id: string }>>) => Object.fromEntries(Object.entries(record).map(([step, blocks]) => [step, blocks.map(block => block.id)]));
  expect(ids(notes.before)).toEqual({ prep: ['intro'], 'a-spin': ['ice'], 'b-wash': ['ice'] });
  expect(ids(notes.after)).toEqual({ 'a-spin': ['store'], 'b-spin': ['store'] });
});
