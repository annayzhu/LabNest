'use client';
import { useActionState } from 'react';
import { saveMethodSearchSettings, startDesignSession, type DesignActionState } from '@/app/protocols/design/actions';
import type { MethodSearchSettingsView } from '@/lib/method-sources/index.server';
import { methodSourceIds, type MethodHitSource } from '@/lib/method-sources/types';
import { Button } from './ui/Button';
import './method-design.css';

/** The sources by name on screen (`methodSourceLabels` in method-sources/types.ts holds the Chinese wording). */
export const methodSourceNames: Record<MethodHitSource, string> = { local: 'Group Protocol library', protocols_io: 'protocols.io', europe_pmc: 'Europe PMC (open access full text)', manual: 'Pasted text' };

/** The start of a design: the goal, the sample and the conditions; searching begins on submit. */
export function MethodDesignStart() {
  const [state, action, pending] = useActionState<DesignActionState, FormData>(startDesignSession, {});
  return <form action={action} className="ln-design-form" aria-busy={pending}>
    <label>Experiment goal<textarea name="goal" required maxLength={600} placeholder="e.g. check how well siRNA knocks down LRP1 in KYSE150 cells (qPCR)" /></label>
    <label>Sample type<input name="sampleType" maxLength={200} placeholder="e.g. adherent cells, mouse liver tissue, plasma" /></label>
    <label>Experiment conditions<input name="conditions" maxLength={1000} placeholder="e.g. 20 µL reaction, 500 ng RNA input, TRIzol method already in use" /></label>
    {state.error ? <p role="alert" className="text-sm text-error">{state.error}</p> : null}
    <div><Button type="submit" variant="primary" disabled={pending}>{pending ? 'Searching…' : 'Search methods'}</Button></div>
    <p className="ln-design-note">The group’s Protocol library is always searched; the open databases go online only once they are on in “Search settings” and you click search. Only the goal, the sample and the conditions are sent out.</p>
  </form>;
}

/** 检索设置: off by default; the protocols.io token is the user's own and is stored encrypted. */
export function MethodSearchSettingsForm({ settings }: { settings: MethodSearchSettingsView }) {
  const [state, action, pending] = useActionState<DesignActionState, FormData>(saveMethodSearchSettings, {});
  return <form action={action} className="ln-design-settings" aria-busy={pending} aria-label="Search settings">
    <strong>Search settings</strong>
    <label className="is-check"><input type="checkbox" name="enabled" defaultChecked={settings.enabled} />Allow searching outside sources (when off, only the group’s Protocol library is searched)</label>
    {methodSourceIds.filter(id => id !== 'local').map(id => <label key={id} className="is-check"><input type="checkbox" name="sources" value={id} defaultChecked={settings.sources.includes(id)} />{methodSourceNames[id]}</label>)}
    <label>{`protocols.io developer token${settings.hasProtocolsIoToken ? ' (saved; leave empty to keep it)' : ''}`}<input type="password" name="protocolsIoToken" autoComplete="off" placeholder="Request one at protocols.io → Settings → Developer" /></label>
    {settings.hasProtocolsIoToken ? <label className="is-check"><input type="checkbox" name="clearToken" />Clear the saved token</label> : null}
    <p className="ln-design-note">Every outside search and fetch is written to the activity log (source, query, number of results).</p>
    {state.error ? <p role="alert" className="text-sm text-error">{state.error}</p> : null}{state.message ? <p role="status" className="text-sm text-success">{state.message}</p> : null}
    <div><Button type="submit" size="sm" disabled={pending}>{pending ? 'Saving settings…' : 'Save settings'}</Button></div>
  </form>;
}
