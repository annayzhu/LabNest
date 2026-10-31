'use client';
import { FileText, Search } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { saveProductSearchSettings, searchManuals, takeManual, type ManualSearchState, type ManualSettingsState } from '@/app/protocols/import/recognize/product-actions';
import type { RecognitionState } from '@/app/protocols/import/recognize/actions';
import type { ProductSearchSettingsView } from '@/lib/product-manuals.server';
import type { ManualHit } from '@/lib/product-manuals';
import { Button } from './ui/Button';
import './product-manual-search.css';

/**
 * 按产品查找说明书: the manuals kept on products first, then the vendors' own sites when AI is on and a search
 * key is saved. A PDF found goes straight into 整理说明书 and is read like an uploaded one.
 */
export function ProductManualSearch({ settings, onTake, disabled, initialQuery }: { settings: ProductSearchSettingsView; onTake: (result: RecognitionState) => void; disabled?: boolean; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery ?? '');
  const [found, setFound] = useState<ManualSearchState>();
  const [searching, startSearch] = useTransition();
  const [taking, startTake] = useTransition();
  const [taken, setTaken] = useState<string>();
  const [saved, save, saving] = useActionState(saveProductSearchSettings, {} as ManualSettingsState);
  const current = saved.settings ?? settings;
  const busy = searching || taking || Boolean(disabled);

  const search = () => startSearch(async () => { setTaken(undefined); setFound(await searchManuals(query)); });
  // Opened from a product's kit manual: search for it straight away, once.
  const searchedInitial = useRef(false);
  useEffect(() => {
    if (!initialQuery || initialQuery.length < 2 || searchedInitial.current) return;
    searchedInitial.current = true;
    startSearch(async () => setFound(await searchManuals(initialQuery)));
  }, [initialQuery]);
  const take = (hit: ManualHit) => startTake(async () => {
    setTaken(hit.key);
    const result = await takeManual(hit.source === 'inventory' ? { source: 'inventory', attachmentId: hit.attachmentId! } : { source: 'web', url: hit.url!, title: hit.title });
    onTake(result);
    if (result.error) setFound(previous => ({ ...previous, error: result.error }));
    else setFound(undefined);
    setTaken(undefined);
  });

  return <section id="manuals" className="ln-manuals scroll-mt-20" aria-label="Find the manual of a product">
    <h2>Find the manual of a product</h2>
    <p className="ln-design-note">Search by product name, catalogue number or vendor. Manuals kept on inventory items come first; with AI on and a search key saved, the vendors’ own sites are searched too.</p>
    <form className="ln-manuals-search" onSubmit={event => { event.preventDefault(); if (!busy) search(); }}>
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. RNeasy Mini 74104" aria-label="Product name, catalogue number or vendor" />
      <Button type="submit" disabled={busy || query.trim().length < 2} aria-busy={searching}><Search className="h-4 w-4" aria-hidden />{searching ? 'Searching…' : 'Search'}</Button>
    </form>
    {found?.error ? <p role="alert" className="text-sm text-error">{found.error}</p> : null}
    {found?.note ? <p role="status" className="text-sm text-warning">{found.note}</p> : null}
    {found?.hits ? (found.hits.length ? <ol className="ln-manual-list">{found.hits.map(hit => <li key={hit.key} className="ln-manual">
      <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      <div className="min-w-0">
        <p className="ln-manual-title">{hit.url ? <a href={hit.url} target="_blank" rel="noreferrer" className="focus-ring">{hit.title}</a> : hit.title}</p>
        <p className="ln-manual-source">{hit.source === 'inventory' ? <>{`Kept on product “${hit.product?.name}”${hit.product?.catalogNumber ? ` · ${hit.product.catalogNumber}` : ''}`}{hit.product ? <> · <Link href={`/inventory/products/${hit.product.id}`} className="focus-ring text-moss underline">Open product</Link></> : null}</> : `From ${hit.vendor}`}</p>
        {hit.snippet ? <p className="ln-manual-snippet">{hit.snippet}</p> : null}
      </div>
      {hit.isPdf ? <Button type="button" variant="primary" size="sm" disabled={busy} aria-busy={taken === hit.key} onClick={() => take(hit)}>{taken === hit.key ? 'Taking it in…' : 'Organize into a Protocol'}</Button>
        : <span className="ln-manual-snippet">A web page, not a PDF: save it as PDF and upload it below.</span>}
    </li>)}</ol> : <p className="text-sm text-muted">No manual found. Try the catalogue number, or add the manual to the product.</p>) : null}
    <details className="ln-manuals-settings">
      <summary>Web search settings</summary>
      <form action={save} className="ln-design-form">
        <label>Search key (Tavily){current.hasKey ? ' — a key is saved' : ''}<input name="key" type="password" autoComplete="off" placeholder={current.hasKey ? 'Leave empty to keep the saved key' : 'tvly-…'} /></label>
        {current.hasKey ? <label className="ln-manuals-check"><input name="clearKey" type="checkbox" />Remove the saved key</label> : null}
        <label>Vendor sites searched (one per line){current.isDefaultList ? ' — the default list' : ''}<textarea name="vendors" rows={7} defaultValue={current.vendors.join('\n')} /></label>
        <p className="ln-design-note">The key is kept encrypted and used only while AI is on. Only the sites listed here are searched and downloaded from. An empty list goes back to the default.</p>
        <div><Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button>{saved.message ? <span role="status" className="ml-2 text-xs text-success">{saved.message}</span> : null}{saved.error ? <span role="alert" className="ml-2 text-xs text-error">{saved.error}</span> : null}</div>
      </form>
    </details>
  </section>;
}
