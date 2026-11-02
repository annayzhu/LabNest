import type { CompleteOptions } from '../ai';

export type Complete = (system: string, user: string, options?: CompleteOptions) => Promise<{ text: string; model?: string }>;

/** The outermost object of an answer, fenced or not: prose before it ("审查如下：") is skipped. */
export function jsonObject(raw: string): unknown {
  const payload = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw)?.[1] ?? raw;
  const start = payload.indexOf('{'), end = payload.lastIndexOf('}');
  return JSON.parse(start >= 0 && end > start ? payload.slice(start, end + 1) : payload);
}

/**
 * Asks for one JSON object and reads it with `read`, which checks it against the step's structure (Q333). An answer
 * that cannot be read is asked for once more, with the reason; a second failure throws, so the step stops instead of
 * showing a draft it could not check. `onCall` counts every model call, including one that ends in a failure.
 */
export async function askJson<T>(complete: Complete, prompt: { system: string; user: string }, read: (text: string) => T, hooks: { onCall?: () => void; onRetry?: (reason: string) => void } = {}) {
  hooks.onCall?.();
  const first = await complete(prompt.system, prompt.user, { json: true });
  try { return { value: read(first.text), model: first.model }; } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 300) : 'unknown';
    hooks.onRetry?.(reason);
    hooks.onCall?.();
    const second = await complete(prompt.system, `${prompt.user}\n\n你上一次的回答无法解析：${reason}\n请只输出要求的 JSON 对象。`, { json: true });
    return { value: read(second.text), model: second.model ?? first.model };
  }
}
