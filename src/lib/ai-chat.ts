/**
 * A conversation with a model that may call tools, in one shape for every service: the adapters turn it into the
 * service's own request and read the answer back. Used by the research plan Copilot's agent.
 */
export type ChatToolSpec = { name: string; description: string; /** JSON Schema of the arguments. */ parameters: Record<string, unknown> };
export type ChatToolCall = { id: string; name: string; arguments: Record<string, unknown> };
export type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content?: string; toolCalls?: ChatToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string };
/** One turn of the model: the words it wrote and the tools it asked for (it may ask for several at once). */
export type ChatTurn = { text: string; toolCalls: ChatToolCall[]; model?: string };

/** The arguments a model wrote for a tool, as an object; text that is not a JSON object reads as no arguments. */
export function toolArguments(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try { const parsed = JSON.parse(raw); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; } catch { return {}; }
}
