import type { ProtocolContentBlock } from './protocol-document';
import { formatQuantity } from './calculators/quantity-format';

export type ProtocolProgram = Extract<ProtocolContentBlock, { type: 'program' }>;

/** "3 min", "15 s", "1 h 30 min"; null is a hold until the operator stops it. */
export function formatProgramDuration(seconds: number | null) {
  if (seconds === null) return '保持';
  if (seconds < 60 || seconds % 60) return seconds >= 60 ? `${Math.floor(seconds / 60)} min ${formatQuantity(seconds % 60)} s` : `${formatQuantity(seconds)} s`;
  const minutes = seconds / 60;
  return minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} h` : minutes > 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}

/** Durations typed as "15 s", "3 min", "1 h", "90" (seconds) or "∞"/"保持" (hold). */
export function parseProgramDuration(text: string): number | null | undefined {
  const value = text.trim().toLowerCase();
  if (!value || /^(∞|inf|hold|保持)$/.test(value)) return null;
  const match = /^(\d+(?:\.\d+)?)\s*(s|sec|秒|min|分钟|分|h|hr|小时)?$/.exec(value);
  if (!match) return undefined;
  const amount = Number(match[1]), unit = match[2] ?? 's';
  return Math.round(amount * (/^(min|分钟|分)$/.test(unit) ? 60 : /^(h|hr|小时)$/.test(unit) ? 3600 : 1));
}

const stepText = (step: ProtocolProgram['stages'][number]['steps'][number]) => `${step.label ? `${step.label} ` : ''}${formatQuantity(step.temperatureC)} °C ${formatProgramDuration(step.seconds)}`.trim();
/** One reading line, e.g. "PCR 程序：95 °C 3 min；35 个循环（95 °C 15 s → 60 °C 30 s → 72 °C 30 s）；4 °C 保持". */
export function programSummary(program: ProtocolProgram) {
  return `${program.label || '热循环程序'}：${program.stages.map(stage => stage.cycles > 1 ? `${stage.cycles} 个循环（${stage.steps.map(stepText).join(' → ')}）` : stage.steps.map(stepText).join(' → ')).join('；')}`;
}

export function defaultPcrProgram(newId: (prefix: string) => string): ProtocolProgram {
  const step = (temperatureC: number, seconds: number | null, label?: string) => ({ id: newId('program-step'), temperatureC, seconds, ...(label ? { label } : {}) });
  return { id: newId('program'), type: 'program', label: 'PCR 程序', stages: [
    { id: newId('stage'), cycles: 1, steps: [step(95, 180, '预变性')] },
    { id: newId('stage'), cycles: 35, steps: [step(95, 15, '变性'), step(60, 30, '退火'), step(72, 30, '延伸')] },
    { id: newId('stage'), cycles: 1, steps: [step(72, 300, '终延伸')] },
    { id: newId('stage'), cycles: 1, steps: [step(4, null, '保存')] },
  ] };
}
