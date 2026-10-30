import { describe, expect, it } from 'vitest';
import { createEmptyProtocolDocument } from './protocol-document';
import { actualDeviations, noteWithDeviations } from './run-deviation';
import { stepExecutionBlocker, structuredRunView } from './structured-run';

/** Thaw on ice for a range the Protocol fixed at 30 min; heat shock for a range it has not fixed yet. */
function transformation() {
  const document = createEmptyProtocolDocument();
  document.executionConfirmed = true;
  document.systems = { schemaVersion: 1, dimensions: [], presets: [], rules: [], restrictions: [], parameters: [
    { id: 'p-thaw', label: '', unit: 'min', origin: 'chip', source: { kind: 'fixed', value: 30, unit: 'min' }, range: { min: { value: 20, unit: 'min' }, max: { value: 30, unit: 'min' } } },
    { id: 'p-shock', label: '', unit: 's', origin: 'chip', source: { kind: 'fixed', value: null, unit: 's' }, range: { min: { value: 30, unit: 's' }, max: { value: 60, unit: 's' } } },
  ] };
  document.sections.find(section => section.key === 'steps')!.blocks = [
    { id: 'b1', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: 'Thaw on ice {{p-thaw}}.' }] }], execution: { role: 'step', stepId: 's1', format: 'block' } },
    { id: 'b2', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: 'Heat shock {{p-shock}}.' }] }], execution: { role: 'step', stepId: 's2', format: 'block' } },
  ];
  const snapshot = { versions: [{ protocolVersionId: 'v1', protocolTitle: 'Bacterial Transformation', displayVersion: '0.1', contentJson: document }] };
  const steps = [{ id: 'run-1', protocolStepRef: 'v1:s1', groupKey: 'v1', completed: false }, { id: 'run-2', protocolStepRef: 'v1:s2', groupKey: 'v1', completed: false }];
  return { snapshot, steps };
}

describe('A range at the bench', () => {
  it('needs no system confirmation when the Protocol has no systems, and asks for an unfixed range at its own step only', () => {
    const { snapshot, steps } = transformation();
    const view = structuredRunView(snapshot, { schemaVersion: 1, revision: 1, versions: {}, actualValues: {}, skips: {} }, steps);
    expect(stepExecutionBlocker(view, 'run-1')).toBeNull();
    expect(view.steps['run-1'].description).toBe('Thaw on ice 30 min（原文 20–30 min）.');
    expect(view.steps['run-2']).toMatchObject({ blocked: true, awaitingInput: true });
    expect(view.steps['run-2'].description).toBe('Heat shock 30–60 s（执行时填写）.');
    // The value entered at the step is an input, not an actual to compare.
    expect(view.steps['run-2'].actualFields).toEqual([]);
    const entered = structuredRunView(snapshot, { schemaVersion: 1, revision: 2, versions: { v1: { selections: {}, actualInputs: { 'p-shock': { value: 45, unit: 's' } }, confirmedAt: '2026-10-30T01:00:00Z' } }, actualValues: {}, skips: {} }, steps);
    expect(entered.steps['run-2'].blocked).toBe(false);
    expect(entered.steps['run-2'].timerDurationSeconds ?? null).toBeNull();
    expect(entered.steps['run-2'].description).toBe('Heat shock 45 s（原文 30–60 s）.');
  });

  it('writes a value other than the adopted one into the deviation record, says whether it is within the source range, and drops the line once back on plan', () => {
    const { snapshot, steps } = transformation();
    const view = structuredRunView(snapshot, { schemaVersion: 1, revision: 1, versions: {}, actualValues: {}, skips: {} }, steps);
    const within = actualDeviations(view, 'run-1', { 'p-thaw': { value: 25, unit: 'min' } });
    expect(within).toEqual([{ prefix: '时间（规程 30 min，原文 20–30 min）：', type: 'timing', line: '时间（规程 30 min，原文 20–30 min）：实际 25 min，在原文范围内' }]);
    const note = noteWithDeviations('冰盒温度偏高', within);
    expect(note).toBe('冰盒温度偏高\n时间（规程 30 min，原文 20–30 min）：实际 25 min，在原文范围内');
    const outside = noteWithDeviations(note, actualDeviations(view, 'run-1', { 'p-thaw': { value: 40, unit: 'min' } }));
    expect(outside).toBe('冰盒温度偏高\n时间（规程 30 min，原文 20–30 min）：实际 40 min，超出原文范围');
    expect(noteWithDeviations(outside, actualDeviations(view, 'run-1', { 'p-thaw': { value: 30, unit: 'min' } }))).toBe('冰盒温度偏高');
    expect(noteWithDeviations('时间（规程 30 min，原文 20–30 min）：实际 25 min，在原文范围内', actualDeviations(view, 'run-1', { 'p-thaw': { value: 1800, unit: 's' } }))).toBeNull();
  });
});
