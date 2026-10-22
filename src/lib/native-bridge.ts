/**
 * The LabNest iPhone app shows these pages in a web view and adds what a page cannot do: a haptic tap, timers on the
 * lock screen and Dynamic Island with a notification when they end, handing a pairing code to the Watch, and choosing
 * the server. The app injects `window.labnestNative` before any page script runs; in a browser every call is a no-op.
 *
 * Page → app: `window.webkit.messageHandlers.labnest.postMessage(message)`.
 * App → page: `window.dispatchEvent(new CustomEvent('labnest-native', { detail }))`.
 */

/** One running or paused step timer. `endsAt` is null while paused; `remainingSeconds` is then what is left. */
export type NativeTimer = { stepId: string; title: string; endsAt: string | null; remainingSeconds: number };

export type NativeMessage =
  | { type: 'haptic'; style: 'light' | 'medium' | 'success' }
  /** Every timer of one experiment as it is now; an empty list ends that experiment's Live Activity and notifications. */
  | { type: 'timers'; experimentId: string; experimentTitle: string; url: string; timers: NativeTimer[] }
  /** Hand a one-use pairing code for `server` to the paired Watch; the app answers with a `watchPair` event. */
  | { type: 'watchPair'; server: string; code: string }
  /** Show the app's server setup again (scan another computer's code or type an address). */
  | { type: 'changeServer' };

export type NativeEvent = { type: 'watchPair'; ok: boolean; message: string };

type NativeWindow = Window & {
  labnestNative?: { version: number };
  webkit?: { messageHandlers?: { labnest?: { postMessage: (message: NativeMessage) => void } } };
};

export function inNativeApp() {
  return typeof window !== 'undefined' && Boolean((window as NativeWindow).labnestNative);
}

export function postNative(message: NativeMessage) {
  if (!inNativeApp()) return false;
  try { (window as NativeWindow).webkit?.messageHandlers?.labnest?.postMessage(message); return true; } catch { return false; }
}

export function onNativeEvent(handler: (event: NativeEvent) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<NativeEvent>).detail);
  window.addEventListener('labnest-native', listener);
  return () => window.removeEventListener('labnest-native', listener);
}

export type TimedStep = { id: string; title: string; timerRemainingSeconds: number | null; timerStartedAt: Date | string | null; timerPausedAt: Date | string | null };

/** The timers the app shows for one experiment: running ones that have not ended yet, and paused ones with time left. */
export function nativeTimers(steps: TimedStep[], now: number): NativeTimer[] {
  return steps.flatMap((step): NativeTimer[] => {
    const remaining = step.timerRemainingSeconds ?? 0;
    if (step.timerStartedAt) {
      const endsAt = new Date(step.timerStartedAt).getTime() + remaining * 1000;
      return endsAt > now ? [{ stepId: step.id, title: step.title, endsAt: new Date(endsAt).toISOString(), remainingSeconds: Math.ceil((endsAt - now) / 1000) }] : [];
    }
    return step.timerPausedAt && remaining > 0 ? [{ stepId: step.id, title: step.title, endsAt: null, remainingSeconds: remaining }] : [];
  });
}
