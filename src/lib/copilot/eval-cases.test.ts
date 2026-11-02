import { describe, expect, it } from 'vitest';
import { evalCases } from './eval-cases';
import { taskSpecs } from './specs';

describe('the Copilot evaluation cases', () => {
  it.each(evalCases.map(item => [item.id, item] as const))('%s: the hand-written answer passes its own checks', (_, item) => {
    expect(taskSpecs[item.spec]).toBeDefined();
    expect(item.checks(item.expected).filter(check => !check.pass)).toEqual([]);
    expect(item.agree?.(item.expected)).toBeTruthy();
  });

  it('fails an answer that adds a number or names an experiment the words do not', () => {
    const tidy = evalCases.find(item => item.id === 'entry-unsure')!;
    const failed = tidy.checks(JSON.stringify({ title: '离心', done: ['离心 15 分钟'], values: [], seen: [], next: [], unclear: [], experiment: 'EXP-0001' })).filter(check => !check.pass).map(check => check.name);
    expect(failed).toEqual(expect.arrayContaining(['nothing added: every number and code is in the words', 'names no experiment', 'says what is unclear']));
  });
});
