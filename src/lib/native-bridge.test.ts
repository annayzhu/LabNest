import { describe, expect, it } from 'vitest';
import { nativeTimers } from './native-bridge';

const now = Date.parse('2026-10-21T10:00:00.000Z');
const step = (id: string, fields: { remaining: number | null; started?: string; paused?: string }) => ({ id, title: `Step ${id}`, timerRemainingSeconds: fields.remaining, timerStartedAt: fields.started ?? null, timerPausedAt: fields.paused ?? null });

describe('Timers handed to the iPhone app', () => {
  it('end a running timer at its start plus what was left, and keep a paused one with its time left', () => {
    expect(nativeTimers([
      step('running', { remaining: 600, started: '2026-10-21T09:58:00.000Z' }),
      step('paused', { remaining: 90, paused: '2026-10-21T09:59:00.000Z' }),
    ], now)).toEqual([
      { stepId: 'running', title: 'Step running', endsAt: '2026-10-21T10:08:00.000Z', remainingSeconds: 480 },
      { stepId: 'paused', title: 'Step paused', endsAt: null, remainingSeconds: 90 },
    ]);
  });

  it('leave out timers that have ended, never started, or have nothing left', () => {
    expect(nativeTimers([
      step('ended', { remaining: 60, started: '2026-10-21T09:50:00.000Z' }),
      step('idle', { remaining: 300 }),
      step('spent', { remaining: 0, paused: '2026-10-21T09:59:00.000Z' }),
    ], now)).toEqual([]);
  });
});
