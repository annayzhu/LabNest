import { describe, expect, it } from 'vitest';
import { changedSections } from '../protocol-habit-text';
import { adoptionNumbers, adoptionRate, changedFields } from './suggestions';

describe('Copilot adoption', () => {
  it('finds the fields an author changed, whatever order the database kept the keys in', () => {
    const proposed = JSON.parse('{"title":"T","unit":{"analysis":"一次转染","experimental":"一孔"},"groups":[{"name":"NC","control":true}],"states":{"a":"ai"}}');
    const kept = { title: 'T', unit: { experimental: '一孔', analysis: '一次转染' }, groups: [{ name: 'NC', control: true }, { name: 'si-1', control: false }], states: { a: 'confirmed' } };
    expect(changedFields(proposed, kept, ['states'])).toEqual(['groups']);
  });

  it('counts adopted, set aside and open suggestions, and why they were set aside', () => {
    const numbers = adoptionNumbers([
      { status: 'adopted', editedFields: [], ignoreReason: null },
      { status: 'adopted', editedFields: ['groups', 'readouts'], ignoreReason: null },
      { status: 'ignored', editedFields: [], ignoreReason: 'poor_wording' },
      { status: 'ignored', editedFields: [], ignoreReason: 'regenerated' },
      { status: 'edited', editedFields: [], ignoreReason: null },
    ]);
    expect(numbers).toEqual({ adopted: 2, ignored: 2, open: 1, editedAverage: 1, reasons: { poor_wording: 1, regenerated: 1 } });
    expect(adoptionRate(numbers)).toBe(0.5);
    expect(adoptionRate(adoptionNumbers([]))).toBeUndefined();
  });

  it('names the sections an author changed in an organized manual', () => {
    const draft = '标题：RNA 提取\n目的\n提取总 RNA\n材料\n- Buffer RL | 350 µL\n步骤\n加入 Buffer RL\n离心 12000 ×g 2 min';
    expect(changedSections(draft, draft)).toEqual([]);
    expect(changedSections(draft, draft.replace('2 min', '1 min').replace('标题：RNA 提取', '标题：总 RNA 提取'))).toEqual(['title', 'steps']);
  });
});
