'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CheckCircle2, Circle, ClipboardList, FileSearch, Info, NotebookPen, RefreshCw, Settings, Sparkles, Target, X, type LucideIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { aiPlaces, aiSetupSteps, aiState, type AiPlace, type AiState } from '@/lib/ai-readiness';
import type { AISettingsView } from '@/lib/ai-settings';
import type { pendingSuggestionEntries } from '@/lib/entry-suggestions';
import { Button, buttonStyles, type ButtonSize } from './ui/Button';
import { useAISettings } from './useAISettings';

/** A quick entry whose AI suggestions wait for 采纳 or 忽略. */
type PendingSuggestions = Awaited<ReturnType<typeof pendingSuggestionEntries>>[number];

type AiStatus = ReturnType<typeof useAISettings> & {
  state: AiState;
  pending: PendingSuggestions[];
  /** How many suggestions wait across those entries. */
  waiting: number;
  /** A model can be called now. */
  ready: boolean;
  /** The switch is on, whether or not the default service is set up. */
  enabled: boolean;
  /** A service that can read pictures is set up (photos of a manual). */
  vision: boolean;
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
};

const AiStatusContext = createContext<AiStatus | null>(null);

/** One read of the AI settings per page, shared by every AI button, the top-bar trigger and the AI 助手 panel. */
export function AiStatusProvider({ initial, pending = [], children }: { initial?: AISettingsView; pending?: PendingSuggestions[]; children: ReactNode }) {
  const settings = useAISettings(initial);
  const [panelOpen, setPanelOpen] = useState(false);
  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  const togglePanel = useCallback(() => setPanelOpen(open => !open), []);
  const state = aiState(settings.saved, settings.error);
  const waiting = pending.reduce((total, entry) => total + entry.count, 0);
  return <AiStatusContext.Provider value={{ ...settings, state, ready: state === 'ready', enabled: state === 'ready' || state === 'incomplete', vision: state !== 'error' && Boolean(settings.saved?.vision.ready), pending, waiting, panelOpen, openPanel, closePanel, togglePanel }}>
    {children}
    <AiAssistantPanel />
  </AiStatusContext.Provider>;
}

export function useAiStatus() {
  const status = useContext(AiStatusContext);
  if (!status) throw new Error('useAiStatus needs AiStatusProvider, which AppShell renders');
  return status;
}

type AiButtonProps = ComponentProps<typeof Button> & {
  /** 'model' calls a model (the default); 'switch' only needs AI switched on, as in the copy-paste workbench; 'vision' needs a service that reads pictures. */
  needs?: 'model' | 'switch' | 'vision';
};

/**
 * A button that hands work to a model. Until AI can do the work it stays gray, and pressing it opens the AI 助手 setup
 * guide instead of sending anything. It is not marked disabled: it still does something, so it says what in its title.
 */
export function AiButton({ needs = 'model', variant = 'ai', ...props }: AiButtonProps) {
  const ai = useAiStatus();
  if (needs === 'switch' ? ai.enabled : needs === 'vision' ? ai.vision : ai.ready) return <Button variant={variant} {...props} />;
  const title = ai.state === 'checking' ? 'Reading AI settings…' : needs === 'vision' && ai.ready ? 'No service reads pictures yet: click to see how to set one up' : 'AI is off: click to see how to set it up';
  return <Button {...props} type="button" variant="ai-off" disabled={false} aria-busy={undefined} aria-haspopup="dialog" data-ai-off title={title} onClick={ai.openPanel} />;
}

/** An entry into a tool that also works without AI: in the AI color when AI is ready, quiet gray otherwise; it always opens. */
export function AiLink({ href, size, className, children }: { href: string; size?: ButtonSize; className?: string; children: ReactNode }) {
  const { ready, state } = useAiStatus();
  return <Link href={href} className={buttonStyles({ variant: ready ? 'ai' : 'ai-off', size, className })}
    title={ready || state === 'checking' ? undefined : 'AI is off: the AI features inside are unavailable for now; everything else works'}>{children}</Link>;
}

/** The top-bar button for the AI 助手 panel: filled in the AI color when AI is ready, gray otherwise; it counts suggestions waiting for you. */
export function AiAssistantButton({ large }: { large?: boolean }) {
  const ai = useAiStatus();
  const { waiting } = ai;
  return <button type="button" aria-label={waiting ? `AI assistant, ${waiting} AI suggestion${waiting === 1 ? "" : "s"} waiting for you` : 'AI assistant'} aria-expanded={ai.panelOpen} aria-controls="ai-assistant-panel"
    title={ai.ready ? 'AI assistant' : 'AI assistant · AI is off'} onClick={ai.togglePanel}
    className={cn('ln-ai-trigger focus-ring', ai.ready ? 'ln-ai-action' : 'ln-ai-off', large && 'is-large')}>
    <Sparkles className="h-4 w-4" aria-hidden />
    {waiting ? <span className="ln-ai-trigger-count" aria-hidden>{waiting > 99 ? '99+' : waiting}</span> : null}
  </button>;
}

const placeIcons: Record<AiPlace['key'], LucideIcon> = { recognize: FileSearch, design: Target, entry: NotebookPen, workbench: ClipboardList };

/**
 * LabNest's AI 助手: what AI can do, where, and how to switch it on. There is no chat box: LabNest has no general
 * assistant, only AI buttons in the pages that use a model.
 */
function AiAssistantPanel() {
  const ai = useAiStatus();
  const { panelOpen, closePanel } = ai;
  const pathname = usePathname();
  const panel = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!panelOpen) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { closePanel(); opener.current?.focus(); } };
    // A press outside closes it, except on a trigger, which toggles it itself.
    const outside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || panel.current?.contains(target) || (target instanceof Element && target.closest('.ln-ai-trigger'))) return;
      closePanel();
    };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outside); };
  }, [panelOpen, closePanel]);

  if (!panelOpen) return null;
  const service = ai.saved?.availability;
  const hello: Record<AiState, [string, string]> = {
    ready: ['AI is ready', `Default service: ${service?.providerName ?? 'model'}${service?.model && service.model !== service.providerName ? ` · ${service.model}` : ''}. Use the AI buttons in the places below.`],
    off: ['AI is not on yet', 'Once it is on, the AI buttons in the places below work. Protocols, calculations and runs do not need AI and work as usual.'],
    incomplete: ['AI is on, one step to go', service?.reason ?? 'The default service is not set up yet.'],
    checking: ['Reading AI settings…', ''],
    error: ['Cannot read AI settings', ai.error ?? ''],
  };
  const [title, line] = hello[ai.state];
  return <section ref={panel} id="ai-assistant-panel" className="ln-ai-panel" role="dialog" aria-modal="false" aria-labelledby={titleId} tabIndex={-1}>
    <header className="ln-ai-panel-head">
      <span className="ln-ai-panel-pill"><Sparkles className="h-3.5 w-3.5" aria-hidden />AI assistant</span>
      <span className="ln-ai-panel-tools">
        <Link href="/ai" className="ln-ai-panel-tool focus-ring" aria-label="AI settings" title="AI settings" onClick={closePanel}><Settings className="h-4 w-4" aria-hidden /></Link>
        <button type="button" className="ln-ai-panel-tool focus-ring" aria-label="Close AI assistant" onClick={() => { closePanel(); opener.current?.focus(); }}><X className="h-4 w-4" aria-hidden /></button>
      </span>
    </header>
    <div className="ln-ai-panel-body">
      <div className="ln-ai-panel-hello">
        <span className="ln-ai-panel-tile" data-ready={ai.ready || undefined}><Sparkles className="h-5 w-5" aria-hidden /></span>
        <h2 id={titleId}>{title}</h2>
        {line ? <p>{line}</p> : null}
        {ai.state === 'error' ? <Button size="sm" onClick={() => void ai.refresh()}><RefreshCw className="h-4 w-4" aria-hidden />Read again</Button> : null}
      </div>
      {ai.pending.length ? <PendingList entries={ai.pending} total={ai.waiting} labelId={`${titleId}-pending`} onPick={closePanel} /> : null}
      {!ai.ready && ai.saved ? <SetupCard settings={ai.saved} onPick={closePanel} /> : null}
      {ai.ready && !ai.vision && ai.saved ? <VisionNote reason={ai.saved.vision.reason} onPick={closePanel} /> : null}
      <section className="ln-ai-places" aria-labelledby={`${titleId}-places`}>
        <h3 id={`${titleId}-places`}>Where you can use AI</h3>
        <ul>{aiPlaces(pathname).map(place => {
          const Icon = placeIcons[place.key];
          const body = <>
            <span className="ln-ai-place-icon" data-ready={ai.ready || undefined}><Icon className="h-4 w-4" aria-hidden /></span>
            <span className="ln-ai-place-text">
              <span className="ln-ai-place-label">{place.label}{place.here ? <span className="ln-ai-place-here">This page</span> : null}</span>
              <span className="ln-ai-place-detail">{place.detail}</span>
            </span>
          </>;
          return <li key={place.key}>{place.href ? <Link href={place.href} className="ln-ai-place focus-ring" onClick={closePanel}>{body}</Link> : <div className="ln-ai-place">{body}</div>}</li>;
        })}</ul>
        {!ai.ready ? <p className="ln-ai-places-note">Until AI is on, the AI buttons on these pages are gray; everything else works as usual.</p> : null}
      </section>
    </div>
    <footer className="ln-ai-panel-foot">Check what AI generates; text is sent to a model only when you click an AI button.</footer>
  </section>;
}

/** Quick entries whose AI suggestions wait for 采纳 or 忽略, each opening the entry at its list. Deciding needs no AI. */
function PendingList({ entries, total, labelId, onPick }: { entries: PendingSuggestions[]; total: number; labelId: string; onPick: () => void }) {
  return <section className="ln-ai-places" aria-labelledby={labelId}>
    <h3 id={labelId}>{`AI suggestions waiting for you · ${total}`}</h3>
    <ul>{entries.slice(0, 5).map(entry => <li key={entry.entryId}>
      <Link href={`/entries/${entry.entryId}#ai-suggestions`} className="ln-ai-place focus-ring" onClick={onPick}>
        <span className="ln-ai-place-icon" data-ready><NotebookPen className="h-4 w-4" aria-hidden /></span>
        <span className="ln-ai-place-text"><span className="ln-ai-place-label">{entry.title}</span><span className="ln-ai-place-detail">{`${entry.count} to accept or dismiss`}</span></span>
      </Link>
    </li>)}</ul>
    {entries.length > 5 ? <p className="ln-ai-places-note">{`${entries.length - 5} more quick entries have suggestions waiting.`}</p> : null}
  </section>;
}

/** AI works, but no service reads pictures yet: what to do, and the way to AI 设置. */
function VisionNote({ reason, onPick }: { reason?: string; onPick: () => void }) {
  return <section className="ln-ai-setup" aria-label="识别图片">
    <h3>识别图片还差一步</h3>
    <p className="ln-ai-setup-detail">{reason ?? '还没有选择能识别图片的服务。'}</p>
    <Link href="/ai#vision-provider" className={buttonStyles({ variant: 'ai', size: 'lg', className: 'w-full' })} onClick={onPick}>去 AI 设置</Link>
  </section>;
}

/** While AI is not ready: the three setup steps, what each still lacks, and the way to AI 设置. */
function SetupCard({ settings, onPick }: { settings: AISettingsView; onPick: () => void }) {
  const steps = aiSetupSteps(settings);
  const left = steps.filter(step => !step.done).length;
  return <section className="ln-ai-setup" aria-label="Turn on AI">
    <h3>{left === 1 ? 'One step left to turn on AI' : `${left} steps left to turn on AI`}</h3>
    <ol>{steps.map(step => <li key={step.key} data-done={step.done || undefined}>
      {step.done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <Circle className="h-4 w-4" aria-hidden />}
      <span><span className="ln-ai-setup-label">{step.label}<span className="sr-only">{step.done ? '(done)' : '(not done)'}</span></span>{step.detail ? <span className="ln-ai-setup-detail">{step.detail}</span> : null}</span>
    </li>)}</ol>
    <Link href="/ai" className={buttonStyles({ variant: 'ai', size: 'lg', className: 'w-full' })} onClick={onPick}>Go to AI settings</Link>
    <p className="ln-ai-setup-note"><Info className="h-3.5 w-3.5 shrink-0" aria-hidden />You can open AI settings any time from the gear at the top right.</p>
  </section>;
}
