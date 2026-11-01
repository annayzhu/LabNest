import type { ChatMessage, ChatToolSpec, ChatTurn } from '../ai-chat';

/** A tool the agent may call: what it is for, the arguments it takes, and what it does with them. */
export type AgentTool = ChatToolSpec & { stopOnError?: boolean; run: (args: Record<string, unknown>) => Promise<string> };
export type AgentModel = (system: string, messages: ChatMessage[], tools: ChatToolSpec[]) => Promise<ChatTurn>;
export type AgentEvent = { kind: 'tool' | 'model' | 'note'; text: string };

const MAX_TOOL_OUTPUT = 6000;
const summarize = (args: Record<string, unknown>) => JSON.stringify(args).slice(0, 160);

/**
 * The model decides which tools to call and in what order; each result goes back to it until it answers without asking
 * for another tool. After `maxSteps` rounds of tool calls it is told to answer with what it has, so a run always ends.
 * Tools may require the stage to stop on failure; other failures are returned to the model for correction.
 */
export async function runAgent(input: { model: AgentModel; system: string; task: string; tools: AgentTool[]; maxSteps: number; onEvent?: (event: AgentEvent) => void }) {
  const specs: ChatToolSpec[] = input.tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
  const messages: ChatMessage[] = [{ role: 'user', content: input.task }];
  let calls = 0;
  for (let step = 0; step < input.maxSteps; step += 1) {
    const turn = await input.model(input.system, messages, specs);
    calls += 1;
    if (!turn.toolCalls.length) return { text: turn.text, calls, steps: step, model: turn.model };
    messages.push({ role: 'assistant', content: turn.text || undefined, toolCalls: turn.toolCalls });
    for (const call of turn.toolCalls) {
      const tool = input.tools.find(item => item.name === call.name);
      input.onEvent?.({ kind: 'tool', text: `${call.name}(${summarize(call.arguments)})` });
      let content: string;
      if (!tool) content = `Error: there is no tool named ${call.name}`;
      else try { content = (await tool.run(call.arguments)).slice(0, MAX_TOOL_OUTPUT); }
      catch (error) { if (tool.stopOnError) throw error; content = `Error: ${error instanceof Error ? error.message : 'the tool failed'}`; input.onEvent?.({ kind: 'note', text: `${call.name} failed: ${content}` }); }
      messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content });
    }
  }
  messages.push({ role: 'user', content: '工具调用次数已用完，请不要再调用工具，现在只根据已有结果给出最终答案。' });
  const last = await input.model(input.system, messages, []);
  calls += 1;
  return { text: last.text, calls, steps: input.maxSteps, model: last.model };
}
