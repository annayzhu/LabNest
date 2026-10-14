import { expect, it } from 'vitest';
import { createEmptyProtocolDocument } from './protocol-document';
import { structuredRunView, assertStructuredStepExecutable } from './structured-run';

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
