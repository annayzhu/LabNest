import { describe, expect, it } from 'vitest';
import { createEmptyProtocolDocument } from './protocol-document';
import { structuredRunView } from './structured-run';
import { translateUiText } from './i18n';
import { revisionCandidates, revisionFromExperiment } from './protocol-revision';

/** A lysis Protocol with one value per system (350/600 µL → 50/80 µL Proteinase K) and a fixed incubation time. */
function lysis() {
  const document = createEmptyProtocolDocument();
  document.executionConfirmed = true;
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
  return document;
}

describe('整理成规程修订', () => {
  it('offers the values that differed from the plan and the deviation notes, latest recording first', () => {
    const snapshot = { versions: [{ protocolVersionId: 'v1', protocolTitle: '组织 DNA 提取', displayVersion: '0.3', contentJson: lysis() }] };
    const plan = { schemaVersion: 1, revision: 4, versions: { v1: { selections: { volume: 's' }, actualInputs: {}, confirmedAt: '2026-10-15T01:00:00Z' } },
      actualValues: { 'run-1': { pk: { value: 55, unit: 'µL', recordedAt: '2026-10-15T02:00:00Z' } }, 'run-2': { time: { value: 10, unit: 'min', recordedAt: '2026-10-15T02:10:00Z' } } }, skips: {} };
    const steps = [{ id: 'run-1', protocolStepRef: 'v1:s1', groupKey: 'v1', completed: true, deviationNote: '样本偏粘，多加 5 µL', deviationType: 'material' }, { id: 'run-2', protocolStepRef: 'v1:s2', groupKey: 'v1', completed: true }];
    const view = structuredRunView(snapshot, plan, steps);
    const candidates = revisionCandidates(view, steps);
    // The incubation time was recorded exactly as planned: nothing to tidy there.
    expect(candidates.map(candidate => [candidate.key, candidate.label, candidate.detail])).toEqual([
      ['value:v1:pk', 'Proteinase K', '50 µL → 55 µL (step 1)'],
      ['note:v1:s1', 'Step 1 · Material or reagent', '样本偏粘，多加 5 µL'],
    ]);
    // The same candidates in the Chinese interface.
    expect(candidates.map(candidate => [translateUiText(candidate.label, 'zh'), translateUiText(candidate.detail, 'zh')])).toEqual([
      ['Proteinase K', '50 µL → 55 µL（第 1 步）'], ['第 1 步 · 材料或试剂', '样本偏粘，多加 5 µL']]);
  });

  it('writes an adopted value into the system the run used, adds the note under its step, and cites the Experiment', () => {
    const source = lysis();
    const { document, changes } = revisionFromExperiment(source, { id: 'exp-000012', runCode: 'EXP-012' }, [
      { kind: 'value', parameterId: 'pk', value: 55, unit: 'µL', selections: { volume: 's' }, stepRef: 's1' },
      { kind: 'value', parameterId: 'time', value: 12, unit: 'min', selections: { volume: 's' }, stepRef: 's2' },
      { kind: 'note', stepRef: 's1', text: '样本偏粘，多加 5 µL', stepLabel: '第 1 步' },
    ]);
    const pk = document.systems!.parameters.find(p => p.id === 'pk')!;
    expect(pk.source).toMatchObject({ kind: 'lookup', values: [{ id: 'a', value: 55 }, { id: 'b', value: 80 }] });
    expect(document.systems!.parameters.find(p => p.id === 'time')!.source).toEqual({ kind: 'fixed', value: 12, unit: 'min' });
    const steps = document.sections.find(section => section.key === 'steps')!.blocks;
    expect(steps.map(block => block.id)).toEqual(['b1', 'note-000012-s1-0', 'b2']);
    expect(steps[1]).toMatchObject({ type: 'callout', tone: 'note', text: 'EXP-012 偏差：样本偏粘，多加 5 µL', execution: { role: 'detail', stepId: 's1' } });
    expect(document.provenance).toEqual({ fromExperimentIds: ['exp-000012'] });
    expect(document.sources).toMatchObject([{ id: 'src-exp-exp-000012', kind: 'experiment', title: 'EXP-012' }]);
    expect(changes).toEqual(['Proteinase K：50 µL → 55 µL', '时间：10 min → 12 min', '第 1 步增加偏差说明']);
    // The source document is untouched: a reviewed version stays as it was used.
    expect(source.systems!.parameters.find(p => p.id === 'pk')!.source).toMatchObject({ values: [{ value: 50 }, { value: 80 }] });
    expect(source.sections.find(section => section.key === 'steps')!.blocks).toHaveLength(2);
  });

  it('names the step by its number when the note arrives without a label', () => {
    const { changes } = revisionFromExperiment(lysis(), { id: 'exp-000012', runCode: 'EXP-012' }, [{ kind: 'note', stepRef: 's2', text: '离心时间延长' }]);
    expect(changes).toEqual(['第 2 步增加偏差说明']);
  });

  it('adds a value for a system that had none instead of changing another system', () => {
    const source = lysis();
    source.systems!.parameters[0].source = { kind: 'lookup', values: [{ id: 'a', when: { all: [{ dimensionId: 'volume', optionId: 's' }] }, value: 50, unit: 'µL' }] };
    const { document, changes } = revisionFromExperiment(source, { id: 'exp-000013', runCode: 'EXP-013' }, [{ kind: 'value', parameterId: 'pk', value: 80, unit: 'µL', selections: { volume: 'l' }, stepRef: 's1' }]);
    const pk = document.systems!.parameters.find(p => p.id === 'pk')!;
    expect(pk.source).toMatchObject({ values: [{ id: 'a', value: 50 }, { when: { all: [{ dimensionId: 'volume', optionId: 'l' }] }, value: 80, unit: 'µL' }] });
    expect(changes).toEqual(['Proteinase K：新增本次体系的值 80 µL']);
  });

  it('keeps where a design draft came from when a run is tidied into it', () => {
    const source = lysis();
    const design = { sessionId: 'design-1', hitKey: 'europe_pmc:PMC1', unverified: 2, generatedAt: '2026-10-15T00:00:00.000Z' };
    source.provenance = { fromExperimentIds: ['exp-000001'], design };
    const { document } = revisionFromExperiment(source, { id: 'exp-000012', runCode: 'EXP-012' }, []);
    expect(document.provenance).toEqual({ fromExperimentIds: ['exp-000001', 'exp-000012'], design });
  });
});
