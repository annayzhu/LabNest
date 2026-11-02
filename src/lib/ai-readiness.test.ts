import { describe, expect, it } from 'vitest';
import { aiPlaces, aiSetupSteps, aiState } from './ai-readiness';
import type { AISettingsView } from './ai-settings';

const view = (change: Partial<AISettingsView> = {}): AISettingsView => ({
  enabled: false, defaultProviderId: null, visionProviderId: null, reviewProviderId: null, vision: { ready: false, reason: 'AI is off.' }, attachmentsEnabled: false, externalDataPolicy: 'explicit_context', revision: 'unset',
  availability: { enabled: false, connected: false, reason: '已关闭 AI，现有记录保持不变。' },
  providerCount: 0, setup: { enabled: true, connected: false, reason: '请先选择默认模型服务。' },
  ...change,
});
const deepseek = { enabled: true, connected: true, providerId: 'p1', providerName: 'DeepSeek', model: 'deepseek-v4-flash' };

describe('What AI can do right now', () => {
  it('waits for the settings, then reads off, incomplete or ready; a failed read is its own state', () => {
    expect(aiState(undefined)).toBe('checking');
    expect(aiState(undefined, '无法读取 AI 设置')).toBe('error');
    expect(aiState(view())).toBe('off');
    expect(aiState(view({ enabled: true, availability: { enabled: true, connected: false, reason: '请先选择默认模型服务。' } }))).toBe('incomplete');
    expect(aiState(view({ enabled: true, availability: deepseek }))).toBe('ready');
  });

  it('lists the three setup steps with what is still missing, even while the switch is off', () => {
    expect(aiSetupSteps(view()).map(step => [step.key, step.done, step.detail])).toEqual([
      ['service', false, undefined], ['default', false, '请先选择默认模型服务。'], ['switch', false, undefined],
    ]);
    // A configured service with the switch off: only the switch is left.
    expect(aiSetupSteps(view({ providerCount: 1, defaultProviderId: 'p1', setup: deepseek })).map(step => step.done)).toEqual([true, true, false]);
  });
});

describe('Where AI can be used', () => {
  it('puts the current page first and marks it, linking elsewhere for the rest', () => {
    const onImport = aiPlaces('/protocols/import');
    expect(onImport[0]).toMatchObject({ key: 'recognize', here: true, href: '/protocols/import/recognize' });
    expect(onImport.filter(place => place.here)).toHaveLength(1);
    expect(aiPlaces('/protocols')[0]).toMatchObject({ key: 'design', here: true });
  });

  it('points at the button among the entries instead of linking to itself, and marks nothing on a page without AI', () => {
    expect(aiPlaces('/entries/abc')[0]).toMatchObject({ key: 'entry', here: true, href: undefined });
    expect(aiPlaces('/entries')[0]).toMatchObject({ key: 'entry', here: true, href: undefined });
    const elsewhere = aiPlaces('/inventory');
    expect(elsewhere.some(place => place.here)).toBe(false);
    expect(elsewhere.map(place => place.key)).toEqual(['recognize', 'design', 'entry', 'workbench']);
    expect(elsewhere.find(place => place.key === 'entry')?.href).toBe('/entries');
  });
});
