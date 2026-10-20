import { expect, it, vi } from 'vitest';
vi.mock('./db', () => ({ prisma: {} }));
import { watchStepText } from './watch-execution.server';

it('keeps complete instructions, units and warnings on the wrist, with ordinary notes in full details', () => {
  const long = '操作补充。'.repeat(100);
  const result = watchStepText(
    [{ id: 'action', type: 'text', text: `加 50 µL，4 °C 孵育 10 分钟。\n${long}` }],
    [{ id: 'note', type: 'callout', tone: 'note', text: '实验背景备注' }, { id: 'warning', type: 'callout', tone: 'warning', text: '保持冰上' }],
    [{ id: 'critical', type: 'callout', tone: 'critical', text: '废液单独收集' }, { id: 'after', type: 'text', text: '参考方法说明' }],
  );
  expect(result.instruction).toBe(`保持冰上\n\n加 50 µL，4 °C 孵育 10 分钟。\n${long}\n\n废液单独收集`);
  expect(result.text).toBe(`实验背景备注\n\n${result.instruction}\n\n参考方法说明`);
});

it('does not create duplicate details when there are no surrounding notes', () => {
  const result = watchStepText([{ id: 'action', type: 'text', text: '加 80 µL' }]);
  expect(result.instruction).toBe(result.text);
});
