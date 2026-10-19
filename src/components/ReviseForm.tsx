'use client';
import { useActionState } from 'react';
import { createRevisionFromExperiment, type ReviseState } from '@/app/experiments/[id]/revise/actions';
import type { RevisionCandidate } from '@/lib/protocol-revision';
import { Button } from './ui/Button';
import './protocol-knowledge.css';

type Group = { sourceVersionId: string; protocolId: string; humanCode: string; title: string; displayVersion: string; newerVersion?: string; candidates: RevisionCandidate[] };
const kindLabels = { value: 'Actual value', note: 'Deviation' } as const;

export function ReviseForm({ experimentId, groups }: { experimentId: string; groups: Group[] }) {
  const [state, action, pending] = useActionState<ReviseState, FormData>(createRevisionFromExperiment, {});
  return <form action={action} className="space-y-4" aria-busy={pending}>
    <input type="hidden" name="experimentId" value={experimentId} />
    {groups.map(group => <section key={group.sourceVersionId} className="ln-revise-group" aria-label={group.title}>
      <h2>{`${group.humanCode} · ${group.title} · based on v${group.displayVersion}`}</h2>
      {group.newerVersion ? <p className="text-xs text-warning" role="status">{`This Protocol already has a newer v${group.newerVersion}; the revision still derives from v${group.displayVersion}, the version this experiment used. Check it in Compare versions after saving.`}</p> : null}
      {group.candidates.map(candidate => <label key={candidate.key} className="ln-revise-item">
        <input type="checkbox" name="adopt" value={candidate.key} defaultChecked disabled={pending} />
        <span><strong>{candidate.label}<span className="ln-revise-kind">{kindLabels[candidate.kind]}</span></strong><span>{candidate.detail}</span></span>
      </label>)}
    </section>)}
    {state.error ? <p role="alert" className="text-sm text-error">{state.error}</p> : null}
    <div className="flex flex-wrap items-center gap-3"><Button type="submit" variant="primary" disabled={pending}>{pending ? 'Creating the revision…' : 'Create draft revision'}</Button><span className="text-xs text-muted">Each Protocol gets a new draft version; the versions this experiment used stay unchanged.</span></div>
  </form>;
}
