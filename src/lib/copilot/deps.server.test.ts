import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAIProviderAdapter, type AIProviderConfig } from '../ai';
import { resolveConnectedAdapter } from '../ai-server';
import { prisma } from '../db';
import { enabledAdapters } from '../method-sources/index.server';
import { copilotReadiness, prepareStep } from './deps.server';

vi.mock('../db', () => ({ prisma: { aISettings: { findUnique: vi.fn() } } }));
vi.mock('../ai-server', () => ({ resolveConnectedAdapter: vi.fn() }));
vi.mock('../method-sources/index.server', () => ({ enabledAdapters: vi.fn(), europePmcBase: 'https://example.test' }));

const config: AIProviderConfig = { id: 'synthetic-chatgpt', name: 'Synthetic ChatGPT subscription', type: 'chatgpt_subscription', defaultModel: 'test-model', capabilities: ['text'], enabled: true };

beforeEach(() => { vi.resetAllMocks(); });

describe('Copilot with the saved ChatGPT subscription', () => {
  it('allows the configured service through readiness and prepares a real tool-capable adapter', async () => {
    vi.mocked(prisma.aISettings.findUnique).mockResolvedValue({ defaultProvider: config } as never);
    vi.mocked(enabledAdapters).mockResolvedValue([{ id: 'europe_pmc' }] as never);
    const fetchImpl = vi.fn(async () => new Response(`data: ${JSON.stringify({ type: 'response.completed', response: { model: 'test-model', output: [{ type: 'function_call', call_id: 'search-1', name: 'search_papers', arguments: '{"query":"synthetic"}' }] } })}\n\n`));
    const adapter = createAIProviderAdapter(config, { fetchImpl, accessToken: async () => 'synthetic-token' });
    vi.mocked(resolveConnectedAdapter).mockResolvedValue({ ok: true, config, adapter, gate: { assertAllowed: vi.fn() } } as never);

    expect(await copilotReadiness()).toEqual({ europePmc: true, toolsOk: true, providerName: config.name });
    const { deps } = await prepareStep('synthetic-plan');
    const turn = await deps.chat('Synthetic test only', [{ role: 'user', content: 'Find synthetic papers' }], [{ name: 'search_papers', description: 'Search papers', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } }]);
    expect(turn.toolCalls).toEqual([{ id: 'search-1', name: 'search_papers', arguments: { query: 'synthetic' } }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('still blocks a Dify service that has no tool-call adapter', async () => {
    const dify = { ...config, type: 'dify' as const };
    vi.mocked(prisma.aISettings.findUnique).mockResolvedValue({ defaultProvider: dify } as never);
    vi.mocked(enabledAdapters).mockResolvedValue([{ id: 'europe_pmc' }] as never);
    vi.mocked(resolveConnectedAdapter).mockResolvedValue({ ok: true, config: dify, adapter: createAIProviderAdapter(dify), gate: {} } as never);
    expect((await copilotReadiness()).toolsOk).toBe(false);
    await expect(prepareStep('synthetic-plan')).rejects.toThrow('不能按工具调用');
  });

  it('keeps the AI switch and literature permission enforced', async () => {
    vi.mocked(resolveConnectedAdapter).mockResolvedValueOnce({ ok: false, status: 403, error: 'AI is off' });
    await expect(prepareStep('synthetic-plan')).rejects.toThrow('AI is off');
    vi.mocked(resolveConnectedAdapter).mockResolvedValueOnce({ ok: true, config, adapter: createAIProviderAdapter(config), gate: {} } as never);
    vi.mocked(enabledAdapters).mockResolvedValue([]);
    await expect(prepareStep('synthetic-plan')).rejects.toThrow('Europe PMC 检索没有开启');
  });
});
