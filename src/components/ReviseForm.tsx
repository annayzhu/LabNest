'use client';
import { useActionState } from 'react';
import { createRevisionFromExperiment, type ReviseState } from '@/app/experiments/[id]/revise/actions';
import type { RevisionCandidate } from '@/lib/protocol-revision';
import { Button } from './ui/Button';
import './protocol-knowledge.css';

type Group = { sourceVersionId: string; protocolId: string; humanCode: string; title: string; displayVersion: string; newerVersion?: string; candidates: RevisionCandidate[] };
const kindLabels = { value: '实际值', note: '偏差' } as const;

export function ReviseForm({ experimentId, groups }: { experimentId: string; groups: Group[] }) {
  const [state, action, pending] = useActionState<ReviseState, FormData>(createRevisionFromExperiment, {});
  return <form action={action} className="space-y-4" aria-busy={pending}>
    <input type="hidden" name="experimentId" value={experimentId} />
    {groups.map(group => <section key={group.sourceVersionId} className="ln-revise-group" aria-label={group.title}>
      <h2>{group.humanCode} · {group.title} · 基于 v{group.displayVersion}</h2>
      {group.newerVersion ? <p className="text-xs text-warning" role="status">这份规程已有更新的 v{group.newerVersion}；修订仍从本次实验用过的 v{group.displayVersion} 派生，保存后可在版本对比里核对。</p> : null}
      {group.candidates.map(candidate => <label key={candidate.key} className="ln-revise-item">
        <input type="checkbox" name="adopt" value={candidate.key} defaultChecked disabled={pending} />
        <span><strong>{candidate.label}<span className="ln-revise-kind">{kindLabels[candidate.kind]}</span></strong><span>{candidate.detail}</span></span>
      </label>)}
    </section>)}
    {state.error ? <p role="alert" className="text-sm text-error">{state.error}</p> : null}
    <div className="flex flex-wrap items-center gap-3"><Button type="submit" variant="primary" disabled={pending}>{pending ? '正在生成…' : '生成草稿修订'}</Button><span className="text-xs text-muted">每份规程生成一个新的草稿版本；本次实验用过的版本不变。</span></div>
  </form>;
}
