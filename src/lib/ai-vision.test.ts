import { describe, expect, it, vi } from 'vitest';

vi.mock('./db', () => ({ prisma: {} }));

import { visionFromSettings, type AIProviderRecord } from './ai-server';

const record = (change: Partial<AIProviderRecord> = {}): AIProviderRecord => ({
  id: 'p', name: 'Service', type: 'openai_compatible', baseUrl: 'https://example.test/v1', apiKeyEncrypted: 'v1:abc', defaultModel: 'qwen-vl-max', capabilitiesJson: [], enabled: true, ...change,
});
const on = (defaultProvider: AIProviderRecord | null, visionProvider: AIProviderRecord | null = null) => ({ enabled: true, defaultProvider, visionProvider });

describe('Which service reads pictures', () => {
  it('is nothing while AI is off', () => {
    expect(visionFromSettings({ enabled: false, defaultProvider: record(), visionProvider: record() }).ready).toBe(false);
    expect(visionFromSettings(null).ready).toBe(false);
  });

  it('is the service chosen for photos, even when the default cannot see', () => {
    const result = visionFromSettings(on(record({ id: 'text', name: 'DeepSeek' }), record({ id: 'eyes', name: '通义千问 VL' })));
    expect(result).toMatchObject({ ready: true, providerId: 'eyes', providerName: '通义千问 VL', model: 'qwen-vl-max' });
  });

  it('falls back to the default service only for OpenAI and Anthropic, which read pictures', () => {
    expect(visionFromSettings(on(record({ type: 'openai', id: 'o' }))).providerId).toBe('o');
    expect(visionFromSettings(on(record({ type: 'anthropic', id: 'a' }))).providerId).toBe('a');
    const none = visionFromSettings(on(record({ type: 'openai_compatible', name: 'DeepSeek' })));
    expect(none.ready).toBe(false);
    expect(none.reason).toMatch(/Choose a service that can read pictures/);
  });

  it('says what is missing when the chosen service is not set up, and refuses a Dify app', () => {
    expect(visionFromSettings(on(null, record({ apiKeyEncrypted: null }))).reason).toMatch(/no saved API key/);
    expect(visionFromSettings(on(null, record({ defaultModel: '' }))).reason).toMatch(/model name/);
    expect(visionFromSettings(on(null, record({ type: 'dify' }))).reason).toMatch(/Dify/);
  });
});
