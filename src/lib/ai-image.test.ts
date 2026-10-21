import { describe, expect, it } from 'vitest';
import { AnthropicProvider, DifyProvider, OpenAICompatibleProvider, type AIProviderConfig } from './ai';

const config: AIProviderConfig = { id: 'p1', name: 'Vision', type: 'openai_compatible', baseUrl: 'https://example.test/v1/', apiKey: 'secret-key', defaultModel: 'qwen-vl-max', capabilities: ['text', 'vision'], enabled: true };
const image = { mimeType: 'image/jpeg', base64: 'QUJD' };

function recorder(reply: unknown) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(reply), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

describe('Reading a picture with a model', () => {
  it('sends it to an OpenAI-compatible service as an inline data link and returns the text', async () => {
    const { calls, fetchImpl } = recorder({ model: 'qwen-vl-max', choices: [{ message: { content: '1. 加入 50 µL' } }] });
    const result = await new OpenAICompatibleProvider(config, { fetchImpl }).describeImage('system', 'user', image);
    expect(result).toEqual({ text: '1. 加入 50 µL', model: 'qwen-vl-max' });
    expect(calls[0].url).toBe('https://example.test/v1/chat/completions');
    expect(calls[0].body.messages).toEqual([
      { role: 'system', content: 'system' },
      { role: 'user', content: [{ type: 'text', text: 'user' }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,QUJD' } }] },
    ]);
  });

  it('sends it to Anthropic as a base64 block', async () => {
    const { calls, fetchImpl } = recorder({ model: 'claude-x', content: [{ type: 'text', text: '步骤' }] });
    const result = await new AnthropicProvider({ ...config, type: 'anthropic', baseUrl: 'https://api.anthropic.test/v1' }, { fetchImpl }).describeImage('system', 'user', image);
    expect(result.text).toBe('步骤');
    expect(calls[0].body.messages).toEqual([{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' } }, { type: 'text', text: 'user' }] }]);
  });

  it('is not offered by a service that cannot see', () => {
    expect((new DifyProvider({ ...config, type: 'dify' }) as { describeImage?: unknown }).describeImage).toBeUndefined();
  });
});
