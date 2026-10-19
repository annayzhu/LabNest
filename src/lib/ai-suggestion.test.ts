import { describe, expect, it } from 'vitest';
import { assignmentForSuggestion, canAccept, suggestedExperimentId, suggestedExperimentTitle, suggestionLabel, suggestionSubject } from './ai-suggestion';

const experiments = [
  { id: 'e1', title: 'KYSE150 转染体系预实验', runCode: 'EXP-007' },
  { id: 'e2', title: 'A549 细胞铺板', runCode: 'EXP-012' },
];

describe('AI suggestions on a quick entry', () => {
  it('names every kind in plain words and accepts only the two that go through 归入', () => {
    expect(suggestionLabel('link_attachment')).toBe('归入实验');
    expect(suggestionLabel('create_experiment')).toBe('新建实验');
    expect(suggestionLabel('consume_inventory')).toBe('记录试剂消耗');
    expect(suggestionLabel('something_new')).toBe('其他建议');
    expect(['link_attachment', 'create_experiment', 'consume_inventory', 'create_result'].filter(canAccept)).toEqual(['link_attachment', 'create_experiment']);
  });

  it('says what a suggestion is about from the first named field of its payload', () => {
    expect(suggestionSubject({ title: 'Synthetic density follow-up' })).toBe('Synthetic density follow-up');
    expect(suggestionSubject({ attachment: 'cells.png', experiment: 'EXP-007' })).toBe('EXP-007');
    expect(suggestionSubject({ inventory_item_name: 'Trypsin', quantity: 2 })).toBe('Trypsin');
    expect(suggestionSubject({ quantity: 2 })).toBeUndefined();
  });

  it('proposes an experiment title from the model’s own field, else from the first sentence of its reason', () => {
    expect(suggestedExperimentTitle({ title: '  KYSE150 转染 48 h 观察 ' })).toBe('KYSE150 转染 48 h 观察');
    expect(suggestedExperimentTitle({ experiment_name: 'RNA 提取' }, '忽略')).toBe('RNA 提取');
    expect(suggestedExperimentTitle({}, 'Start a new transfection run. The entry mentions a second batch.')).toBe('Start a new transfection run');
    expect(suggestedExperimentTitle({}, '新建一组对照实验。原因见记录。')).toBe('新建一组对照实验');
    expect(suggestedExperimentTitle({})).toBe('');
  });

  it('finds the experiment a suggestion names by code first, then by title, and nothing when it names none', () => {
    expect(suggestedExperimentId({ experiment: 'exp-012' }, experiments)).toBe('e2');
    expect(suggestedExperimentId({ target: 'the KYSE150 转染体系预实验 run' }, experiments)).toBe('e1');
    expect(suggestedExperimentId({ attachment: 'microscopy.png' }, experiments)).toBeUndefined();
  });

  it('turns 采纳 into the same assignment request the 归入 control sends', () => {
    expect(assignmentForSuggestion('create_experiment', { accept: true, expectedTarget: null, newTitle: ' 新实验 ' })).toEqual({ type: 'experiment', expectedTarget: null, newTitle: '新实验' });
    expect(assignmentForSuggestion('link_attachment', { accept: true, expectedTarget: 'experiment:e1', experimentId: 'e2' })).toEqual({ type: 'experiment', expectedTarget: 'experiment:e1', targetId: 'e2' });
    expect(() => assignmentForSuggestion('create_experiment', { accept: true, expectedTarget: null, newTitle: ' ' })).toThrow('请填写实验名称');
    expect(() => assignmentForSuggestion('link_attachment', { accept: true, expectedTarget: null })).toThrow('请选择要归入的实验');
    expect(() => assignmentForSuggestion('consume_inventory', { accept: true, expectedTarget: null })).toThrow('这类建议还不能直接采纳');
  });
});
