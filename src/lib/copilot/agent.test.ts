import { describe, expect, it } from 'vitest';
import type { ChatMessage, ChatTurn } from '../ai-chat';
import { runAgent, type AgentTool } from './agent';

const searchTool = (log: string[]): AgentTool => ({
  name: 'search_papers', description: 'Search', parameters: { type: 'object' },
  run: async args => { log.push(String(args.query)); if (args.query === 'boom') throw new Error('Europe PMC is busy'); return `3 papers for ${String(args.query)}`; },
});
const scripted = (turns: ChatTurn[]) => {
  const seen: { messages: ChatMessage[]; tools: number }[] = [];
  return { seen, model: async (_system: string, messages: ChatMessage[], tools: unknown[]) => { seen.push({ messages: structuredClone(messages), tools: tools.length }); return turns[seen.length - 1] ?? { text: 'done', toolCalls: [] }; } };
};

describe('The Copilot agent loop', () => {
  it('lets the model call tools until it answers, passing each result back', async () => {
    const queries: string[] = [], events: string[] = [];
    const { model, seen } = scripted([
      { text: '', toolCalls: [{ id: 'a', name: 'search_papers', arguments: { query: 'cnv' } }, { id: 'b', name: 'search_papers', arguments: { query: 'qpcr' } }] },
      { text: '最终答案', toolCalls: [] },
    ]);
    const result = await runAgent({ model, system: 's', task: '找文献', tools: [searchTool(queries)], maxSteps: 5, onEvent: event => events.push(event.text) });
    expect(result).toMatchObject({ text: '最终答案', calls: 2, steps: 1 });
    expect(queries).toEqual(['cnv', 'qpcr']);
    expect(events).toEqual(['search_papers({"query":"cnv"})', 'search_papers({"query":"qpcr"})']);
    expect(seen[1].messages.map(message => message.role)).toEqual(['user', 'assistant', 'tool', 'tool']);
    expect(seen[1].messages[2]).toMatchObject({ toolCallId: 'a', content: '3 papers for cnv' });
  });

  it('tells the model when a tool fails or does not exist, and goes on', async () => {
    const { model, seen } = scripted([
      { text: '', toolCalls: [{ id: 'a', name: 'search_papers', arguments: { query: 'boom' } }, { id: 'b', name: 'browse_web', arguments: {} }] },
      { text: 'ok', toolCalls: [] },
    ]);
    const result = await runAgent({ model, system: 's', task: 't', tools: [searchTool([])], maxSteps: 3 });
    expect(result.text).toBe('ok');
    expect(seen[1].messages.slice(-2).map(message => (message as { content: string }).content)).toEqual(['Error: Europe PMC is busy', 'Error: there is no tool named browse_web']);
  });

  it('ends after the allowed rounds with one last answer asked for without tools', async () => {
    const forever: ChatTurn = { text: '', toolCalls: [{ id: 'x', name: 'search_papers', arguments: { query: 'again' } }] };
    const { model, seen } = scripted([forever, forever, { text: '用已有结果回答', toolCalls: [] }]);
    const result = await runAgent({ model, system: 's', task: 't', tools: [searchTool([])], maxSteps: 2 });
    expect(result).toMatchObject({ text: '用已有结果回答', calls: 3, steps: 2 });
    expect(seen[2].tools).toBe(0);
    expect((seen[2].messages.at(-1) as { content: string }).content).toMatch(/不要再调用工具/);
  });
});
