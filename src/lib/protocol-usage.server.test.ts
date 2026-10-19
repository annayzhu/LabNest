import { describe, expect, it, vi } from 'vitest';

const findMany = vi.fn();
vi.mock('./db', () => ({ prisma: { experiment: { findMany: (...args: unknown[]) => findMany(...args) } } }));

import { createEmptyProtocolDocument } from './protocol-document';
import { protocolUsageHistory } from './protocol-usage.server';

/** A qPCR Protocol with a reaction-size system, a "新引物" condition and a melt-curve step done only for new primers. */
function qpcrRun() {
  const document = createEmptyProtocolDocument();
  document.executionConfirmed = true;
  document.systems = { schemaVersion: 1, presets: [], parameters: [], restrictions: [],
    dimensions: [
      { id: 'size', label: '体系', options: [{ id: 's20', label: '20 µL' }, { id: 's10', label: '10 µL' }] },
      { id: 'primer', label: '新引物', kind: 'condition', options: [{ id: 'yes', label: '是' }, { id: 'no', label: '否' }] },
    ],
    rules: [{ id: 'melt', target: 'step', targetId: 's2', when: { all: [{ dimensionId: 'primer', optionId: 'yes' }] }, parameterIds: [], optional: false, actualFields: [] }] };
  document.sections.find(section => section.key === 'steps')!.blocks = [
    { id: 'b1', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: '配制反应液并上机。' }] }], execution: { role: 'step', stepId: 's1', format: 'block' } },
    { id: 'b2', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: '检查新引物的熔解曲线。' }] }], execution: { role: 'step', stepId: 's2', format: 'block' } },
  ];
  return {
    id: 'exp-1', runCode: 'EXP-001', title: 'IL-6 qPCR', status: 'completed', date: new Date('2026-10-17T00:00:00Z'),
    protocolSnapshotJson: { versions: [{ protocolVersionId: 'v1', protocolTitle: 'SYBR Green qPCR', displayVersion: '1.0', contentJson: document }] },
    protocolRun: { executionPlanJson: { schemaVersion: 1, revision: 1, versions: { v1: { selections: { size: 's20', primer: 'no' }, actualInputs: {}, confirmedAt: '2026-10-17T01:00:00Z' } }, actualValues: {}, skips: {}, quantities: { v1: { 反应数: 24 } } } },
    steps: [{ id: 'run-1', protocolStepRef: 'v1:s1', groupKey: 'v1', completed: true, deviationNote: null }, { id: 'run-2', protocolStepRef: 'v1:s2', groupKey: 'v1', completed: false, deviationNote: null }],
    // qPCR ran after RNA extraction, the Experiment's first Protocol.
    protocolVersions: [{ protocolVersion: { id: 'rna-v1', protocolId: 'rna', displayVersion: '1.0' } }, { protocolVersion: { id: 'v1', protocolId: 'qpcr', displayVersion: '1.0' } }],
    primaryProtocolVersion: { id: 'rna-v1', protocolId: 'rna', displayVersion: '1.0' },
    _count: { results: 0 },
  };
}

describe('使用记录', () => {
  it('names every choice with its dimension or condition, and counts only the steps of the adopted system', async () => {
    findMany.mockResolvedValueOnce([qpcrRun()]);
    const [row] = await protocolUsageHistory('qpcr');
    expect(row).toMatchObject({ runCode: 'EXP-001', versions: ['v1.0'], systems: ['体系：▲ 20 µL · 新引物：否'], quantities: ['反应数 24'] });
    // Without new primers the melt-curve step does not apply: it counts in neither number.
    expect([row.stepsDone, row.stepsTotal]).toEqual([1, 1]);
  });
});
