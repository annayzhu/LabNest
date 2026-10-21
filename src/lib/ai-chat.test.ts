import { describe, expect, it } from 'vitest';
import { AnthropicProvider, OpenAICompatibleProvider, type AIProviderConfig } from './ai';
import { toolArguments, type ChatMessage, type ChatToolSpec } from './ai-chat';

const config: AIProviderConfig = { id: 'p1', name: 'Tools', type: 'openai_compatible', baseUrl: 'https://example.test/v1/', apiKey: 'secret-key', defaultModel: 'deepseek-v4', capabilities: ['text'], enabled: true };
const tools: ChatToolSpec[] = [{ name: 'search_papers', description: 'Search papers', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } }];
const history: ChatMessage[] = [
  { role: 'user', content: '找文献' },
  { role: 'assistant', content: '我来搜索', toolCalls: [{ id: 'c1', name: 'search_papers', arguments: { query: 'cnv' } }] },
  { role: 'tool', toolCallId: 'c1', name: 'search_papers', content: '[{"ref":"r1"}]' },
];

function recorder(reply: unknown) {
  const calls: Record<string, unknown>[] = [];
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => { calls.push(JSON.parse(String(init?.body))); return new Response(JSON.stringify(reply), { status: 200, headers: { 'content-type': 'application/json' } }); }) as typeof fetch;
  return { calls, fetchImpl };
}

describe('A turn with tools', () => {
  it('goes to an OpenAI-compatible service as tools and tool messages, and a tool call comes back as an object', async () => {
    const { calls, fetchImpl } = recorder({ model: 'deepseek-v4', choices: [{ message: { content: null, tool_calls: [{ id: 'c2', type: 'function', function: { name: 'search_papers', arguments: '{"query":"copy number"}' } }] } }] });
    const turn = await new OpenAICompatibleProvider(config, { fetchImpl }).chat('system', history, tools);
    expect(turn).toEqual({ text: '', toolCalls: [{ id: 'c2', name: 'search_papers', arguments: { query: 'copy number' } }], model: 'deepseek-v4' });
    expect(calls[0].tools).toEqual([{ type: 'function', function: { name: 'search_papers', description: 'Search papers', parameters: tools[0].parameters } }]);
    expect(calls[0].messages).toEqual([
      { role: 'system', content: 'system' },
      { role: 'user', content: '找文献' },
      { role: 'assistant', content: '我来搜索', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'search_papers', arguments: '{"query":"cnv"}' } }] },
      { role: 'tool', tool_call_id: 'c1', content: '[{"ref":"r1"}]' },
    ]);
  });

  it('goes to Anthropic with the results inside a user message, and tool_use blocks come back as calls', async () => {
    const { calls, fetchImpl } = recorder({ model: 'claude-x', content: [{ type: 'text', text: '好的' }, { type: 'tool_use', id: 't9', name: 'search_papers', input: { query: 'qPCR' } }] });
    const turn = await new AnthropicProvider({ ...config, type: 'anthropic', baseUrl: 'https://api.anthropic.test/v1' }, { fetchImpl }).chat('system', history, tools);
    expect(turn).toEqual({ text: '好的', toolCalls: [{ id: 't9', name: 'search_papers', arguments: { query: 'qPCR' } }], model: 'claude-x' });
    expect(calls[0].tools).toEqual([{ name: 'search_papers', description: 'Search papers', input_schema: tools[0].parameters }]);
    expect(calls[0].messages).toEqual([
      { role: 'user', content: '找文献' },
      { role: 'assistant', content: [{ type: 'text', text: '我来搜索' }, { type: 'tool_use', id: 'c1', name: 'search_papers', input: { query: 'cnv' } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'c1', content: '[{"ref":"r1"}]' }] },
    ]);
  });

  it('reads arguments the model wrote as text, and anything that is not an object as none', () => {
    expect(toolArguments('{"a":1}')).toEqual({ a: 1 });
    expect(toolArguments({ a: 2 })).toEqual({ a: 2 });
    for (const bad of ['', 'not json', '[1]', '"x"', null, undefined, 5]) expect(toolArguments(bad), String(bad)).toEqual({});
  });
});
