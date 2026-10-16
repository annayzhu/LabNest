'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addPastedMethod, chooseMethods, fetchMethod, generateDraft, saveManualCard, scaleDraft, searchAgain, summarizeMethod } from '@/app/protocols/design/actions';
import { methodCardSections, type MethodCard } from '@/lib/method-card';
import { describeScaleChange, type ScaleChange } from '@/lib/method-scaling';
import { methodSourceLabels, type MethodHit, type MethodHitSource } from '@/lib/method-sources/types';
import { Button } from './ui/Button';
import './method-design.css';

type Draft = { protocolId: string; versionId: string; humanCode: string; title: string; displayVersion: string; reviewStage: string };
type Props = { sessionId: string; hits: MethodHit[]; cards: Record<string, MethodCard>; chosen: Array<{ key: string; reason?: string }>; aiReady: boolean; aiName?: string; searchErrors: string[]; lastQuery: string; draft: Draft | null };
const order: MethodHitSource[] = ['local', 'protocols_io', 'europe_pmc', 'manual'];
const volumeUnits = ['µL', 'mL', 'L'];

export function MethodDesignWorkspace({ sessionId, hits, cards, chosen, aiReady, aiName, searchErrors, lastQuery, draft }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>(chosen.map(item => item.key));
  const [reason, setReason] = useState(chosen[0]?.reason ?? '');
  const [query, setQuery] = useState(lastQuery);
  const note = (key: string, text: string) => setNotes(current => ({ ...current, [key]: text }));
  const run = (key: string, work: () => Promise<{ error?: string; message?: string }>) => start(async () => {
    setBusy(key);
    try { const result = await work(); note(key, result.error ?? result.message ?? ''); if (!result.error) router.refresh(); }
    finally { setBusy(null); }
  });
  const grouped = order.map(source => ({ source, hits: hits.filter(hit => hit.source === source) })).filter(group => group.hits.length);
  const chosenHits = selected.map(key => hits.find(hit => hit.key === key)).filter((hit): hit is MethodHit => Boolean(hit));
  return <div className="space-y-5">
    <section className="ln-design-form" aria-label="再次检索">
      <div className="ln-scale-row">
        <label style={{ flex: '1 1 16rem' }}>换个关键词再搜<input value={query} onChange={event => setQuery(event.target.value)} placeholder="例如：siRNA transfection qPCR knockdown" /></label>
        <Button type="button" disabled={pending} onClick={() => run('search', () => searchAgain(sessionId, query))}>{busy === 'search' ? '检索中…' : '检索'}</Button>
      </div>
      {notes.search ? <p role="status" className="ln-design-note">{notes.search}</p> : null}
      {searchErrors.length ? <p role="status" className="text-sm text-warning">{searchErrors.join('；')}</p> : null}
      {!aiReady ? <p className="ln-design-note">没有连接模型：检索、抓取、比较、生成草稿和体系换算照常可用；方法卡用“手工填写方法卡”。</p> : null}
    </section>

    <PasteMethod sessionId={sessionId} query={query} pending={pending} onDone={text => { note('paste', text); router.refresh(); }} />
    {notes.paste ? <p role="status" className="ln-design-note">{notes.paste}</p> : null}

    {grouped.length ? grouped.map(group => <section key={group.source} className="space-y-2" aria-label={methodSourceLabels[group.source]}>
      <h2 className="text-sm font-semibold text-ink">{methodSourceLabels[group.source]} · {group.hits.length}</h2>
      <div className="ln-hits">{group.hits.map(hit => {
        const card = cards[hit.key], picked = selected.includes(hit.key);
        return <article key={hit.key} className="ln-hit" data-chosen={picked || undefined}>
          <input type="checkbox" aria-label={`选择 ${hit.title}`} checked={picked} onChange={event => setSelected(current => event.target.checked ? [...current, hit.key] : current.filter(key => key !== hit.key))} />
          <div className="min-w-0">
            <div className="ln-hit-head">
              {hit.url ? <Link href={hit.url} target={hit.source === 'local' ? undefined : '_blank'} rel="noreferrer"><strong>{hit.title}</strong></Link> : <strong>{hit.title}</strong>}
              <span className="ln-hit-source">{methodSourceLabels[hit.source]}</span>
              <span className="ln-hit-meta">{[hit.authors, hit.year, hit.venue, hit.license ? `许可：${hit.license}` : ''].filter(Boolean).join(' · ')}</span>
            </div>
            {hit.snippet ? <p className="ln-hit-snippet">{hit.snippet}</p> : null}
            <div className="ln-hit-actions">
              {hit.source !== 'manual' ? <Button type="button" size="sm" disabled={pending} onClick={() => run(hit.key, () => fetchMethod(sessionId, hit.key))}>{busy === hit.key ? '处理中…' : hit.attachmentId ? '重新抓取原文' : '抓取原文'}</Button> : null}
              {hit.attachmentId ? <a href={`/api/attachments/${hit.attachmentId}`} target="_blank" rel="noreferrer">查看抓取的原文</a> : null}
              {hit.attachmentId && aiReady ? <Button type="button" size="sm" disabled={pending} onClick={() => run(hit.key, () => summarizeMethod(sessionId, hit.key))}>{card && !card.byHand ? '重新归纳' : `归纳为方法卡${aiName ? `（${aiName}）` : ''}`}</Button> : null}
              {hit.attachmentId ? <Button type="button" size="sm" variant="primary" disabled={pending || Boolean(draft)} onClick={() => run(hit.key, () => generateDraft(sessionId, hit.key))}>生成规程草稿</Button> : null}
              <span className={`ln-hit-status${hit.fetchError ? ' is-error' : ''}`}>{hit.fetchError ? `抓取失败：${hit.fetchError}` : hit.fetchedAt ? `${hit.source === 'manual' ? '已粘贴' : '已抓取'} ${hit.textChars} 字 · ${hit.fetchedAt.slice(0, 16).replace('T', ' ')}` : '尚未抓取'}</span>
            </div>
            {notes[hit.key] ? <p role="status" className="ln-design-note">{notes[hit.key]}</p> : null}
            {card ? <MethodCardView card={card} /> : null}
            {hit.attachmentId ? <ManualCardForm sessionId={sessionId} hitKey={hit.key} card={card?.byHand ? card : undefined} pending={pending} onDone={text => { note(hit.key, text); router.refresh(); }} /> : null}
          </div>
        </article>;
      })}</div>
    </section>) : <p className="text-sm text-muted">没有找到方法。换个关键词，或在检索设置里打开开放数据库。</p>}

    {chosenHits.length ? <section className="space-y-2" aria-label="候选比较">
      <h2 className="text-sm font-semibold text-ink">候选比较 · {chosenHits.length}</h2>
      <div className="ln-compare"><table>
        <thead><tr><th scope="col" className="is-row">项</th>{chosenHits.map(hit => <th key={hit.key} scope="col">{hit.title}<br /><span className="font-normal">{methodSourceLabels[hit.source]}{hit.license ? ` · ${hit.license}` : ''}</span></th>)}</tr></thead>
        <tbody>
          <tr><th scope="row" className="is-row">概括</th>{chosenHits.map(hit => <td key={hit.key}>{cards[hit.key]?.summary || '尚未归纳'}</td>)}</tr>
          <tr><th scope="row" className="is-row">用时</th>{chosenHits.map(hit => <td key={hit.key}>{cards[hit.key]?.duration || '—'}</td>)}</tr>
          {methodCardSections.map(section => <tr key={section.key}><th scope="row" className="is-row">{section.label}</th>{chosenHits.map(hit => <td key={hit.key}>{cards[hit.key]?.[section.key].length ? <ul>{cards[hit.key][section.key].map((item, index) => <li key={index} className="ln-card-line" data-unverified={item.verified ? undefined : ''}>{item.text}</li>)}</ul> : '—'}</td>)}</tr>)}
          <tr><th scope="row" className="is-row">未核实</th>{chosenHits.map(hit => <td key={hit.key}>{cards[hit.key] ? `${cards[hit.key].unverified} 条` : '—'}</td>)}</tr>
        </tbody>
      </table></div>
      <div className="ln-scale-row">
        <label style={{ flex: '1 1 16rem' }}>选择理由（可选）<input value={reason} onChange={event => setReason(event.target.value)} placeholder="例如：与现有 TRIzol 法衔接，试剂已有" /></label>
        <Button type="button" disabled={pending} onClick={() => run('choose', () => chooseMethods(sessionId, selected, reason))}>{busy === 'choose' ? '保存中…' : '保存选择'}</Button>
      </div>
      {notes.choose ? <p role="status" className="ln-design-note">{notes.choose}</p> : null}
    </section> : null}

    {draft ? <DraftPanel draft={draft} pending={pending} /> : null}
  </div>;
}

/** Sites without an API: open their own search in a new tab, then paste the method here. It joins the hits like a fetched text. */
function PasteMethod({ sessionId, query, pending, onDone }: { sessionId: string; query: string; pending: boolean; onDone: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ title: '', url: '', license: '', text: '' });
  const [adding, start] = useTransition();
  const q = encodeURIComponent(query.trim());
  const links = [['JoVE', `https://www.jove.com/search?query=${q}`], ['Bio-protocol', `https://bio-protocol.org/en/search?q=${q}`], ['protocols.io 网页', `https://www.protocols.io/search?q=${q}`], ['Google Scholar', `https://scholar.google.com/scholar?q=${q}`]] as const;
  return <section className="ln-design-settings" aria-label="粘贴原文">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><strong>没有 API 的网站（JoVE、Bio-protocol…）</strong><span className="ln-design-note">到网站上搜，把方法原文粘贴进来，之后的方法卡、比较、生成草稿一样用：</span></div>
    <div className="ln-hit-actions">{links.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noreferrer">在 {label} 搜索 ↗</a>)}<button type="button" className="focus-ring text-xs text-moss underline" onClick={() => setOpen(value => !value)}>{open ? '收起' : '粘贴原文…'}</button></div>
    {open ? <div className="ln-design-form">
      <label>标题<input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="例如：JoVE 62123 · Lipofectamine siRNA transfection of adherent cells" /></label>
      <div className="ln-source-pair"><label>链接（可选）<input value={draft.url} inputMode="url" onChange={event => setDraft({ ...draft, url: event.target.value })} placeholder="https://www.jove.com/…" /></label><label>许可（可选）<input value={draft.license} onChange={event => setDraft({ ...draft, license: event.target.value })} placeholder="如 CC BY-NC-ND 3.0，或“订阅内容”" /></label></div>
      <label>方法原文<textarea rows={8} value={draft.text} onChange={event => setDraft({ ...draft, text: event.target.value })} placeholder="粘贴 Protocol 部分；一段一个步骤效果最好。" /></label>
      <div><Button type="button" size="sm" variant="primary" disabled={pending || adding || !draft.title.trim() || draft.text.trim().length < 40} onClick={() => start(async () => { const result = await addPastedMethod(sessionId, { title: draft.title, url: draft.url || undefined, license: draft.license || undefined, text: draft.text }); onDone(result.error ?? result.message ?? ''); if (!result.error) { setDraft({ title: '', url: '', license: '', text: '' }); setOpen(false); } })}>加入候选</Button></div>
      <p className="ln-design-note">粘贴的内容只保存在本站附件里，不会发到任何外部服务；只有你点“归纳为方法卡”时才交给模型。</p>
    </div> : null}
  </section>;
}

function MethodCardView({ card }: { card: MethodCard }) {
  return <div className="ln-card" aria-label="方法卡">
    {card.summary ? <p className="ln-card-summary">{card.summary}{card.duration ? ` · 用时 ${card.duration}` : ''}</p> : null}
    <dl className="ln-card-section">{methodCardSections.filter(section => card[section.key].length).map(section => <div key={section.key} className="contents"><dt>{section.label}</dt><dd><ul>{card[section.key].map((item, index) => <li key={index} className="ln-card-line" data-unverified={item.verified ? undefined : ''}>{item.text}{item.quote ? <span className="ln-card-quote">“{item.quote}”</span> : null}</li>)}</ul></dd></div>)}</dl>
    <p className="ln-card-foot">{card.byHand ? '手工填写' : `${card.provider ?? '模型'}${card.model ? ` · ${card.model}` : ''} 归纳，${card.unverified ? `${card.unverified} 条未在原文找到依据` : '每条都在原文找到依据'}`} · {card.madeAt.slice(0, 16).replace('T', ' ')}</p>
  </div>;
}

function ManualCardForm({ sessionId, hitKey, card, pending, onDone }: { sessionId: string; hitKey: string; card?: MethodCard; pending: boolean; onDone: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() => ({ summary: card?.summary ?? '', ...Object.fromEntries(methodCardSections.map(section => [section.key, (card?.[section.key] ?? []).map(item => item.text).join('\n')])) }));
  const [saving, start] = useTransition();
  if (!open) return <button type="button" className="focus-ring text-xs text-moss underline" onClick={() => setOpen(true)}>{card?.byHand ? '修改手工方法卡' : '手工填写方法卡'}</button>;
  return <div className="ln-card ln-card-manual" aria-label="手工方法卡">
    <label className="grid gap-1 text-xs text-muted">一句话概括<input className="ln-prep-note-input" style={{ margin: 0 }} value={draft.summary} onChange={event => setDraft({ ...draft, summary: event.target.value })} /></label>
    {methodCardSections.map(section => <label key={section.key} className="grid gap-1 text-xs text-muted">{section.label}（每行一条）<textarea className="ln-prep-note-input" style={{ margin: 0, height: 'auto' }} rows={2} value={draft[section.key]} onChange={event => setDraft({ ...draft, [section.key]: event.target.value })} /></label>)}
    <div className="flex gap-2"><Button type="button" size="sm" disabled={pending || saving} onClick={() => start(async () => { const result = await saveManualCard(sessionId, hitKey, draft as { summary: string }); onDone(result.error ?? result.message ?? ''); if (!result.error) setOpen(false); })}>保存方法卡</Button><Button type="button" size="sm" onClick={() => setOpen(false)}>取消</Button></div>
  </div>;
}

/** The draft exists: open it, adapt its system, or start an Experiment from it (which runs the preparation check first). */
function DraftPanel({ draft, pending }: { draft: Draft; pending: boolean }) {
  const [working, start] = useTransition();
  const [form, setForm] = useState({ fromValue: '20', fromUnit: 'µL', toValue: '10', toUnit: 'µL', label: '反应体系', explain: true });
  const [result, setResult] = useState<{ error?: string; message?: string; changes?: ScaleChange[]; explanation?: string } | null>(null);
  return <section className="ln-scale" aria-label="规程草稿">
    <h2 className="text-sm font-semibold text-ink">规程草稿 · {draft.humanCode} · {draft.title} v{draft.displayVersion}（{draft.reviewStage === 'draft' ? '草稿' : draft.reviewStage}）</h2>
    <div className="ln-hit-actions">
      <Link href={`/protocols/${draft.protocolId}/versions/${draft.versionId}/edit`}>在编辑器中整理</Link>
      <Link href={`/protocols/${draft.protocolId}?version=${draft.versionId}`}>预览</Link>
      <Link href={`/experiments/new?protocolVersionId=${draft.versionId}`}>建实验（含执行前检查）</Link>
    </div>
    <p className="ln-design-note">体系调整：体积、质量、物质的量按比例换算，时间、温度、浓度、设备设定保持，细胞数与酶活单位列出请人工确认；查表值（按体系的值）不改。结果写入草稿，作为可选的“反应体系”维度，执行时选择。</p>
    <div className="ln-scale-row">
      <label>原体系<input inputMode="decimal" value={form.fromValue} onChange={event => setForm({ ...form, fromValue: event.target.value })} /></label>
      <label>单位<select value={form.fromUnit} onChange={event => setForm({ ...form, fromUnit: event.target.value })}>{volumeUnits.map(unit => <option key={unit}>{unit}</option>)}</select></label>
      <label>新体系<input inputMode="decimal" value={form.toValue} onChange={event => setForm({ ...form, toValue: event.target.value })} /></label>
      <label>单位<select value={form.toUnit} onChange={event => setForm({ ...form, toUnit: event.target.value })}>{volumeUnits.map(unit => <option key={unit}>{unit}</option>)}</select></label>
      <label>维度名称<input value={form.label} onChange={event => setForm({ ...form, label: event.target.value })} /></label>
      <label className="is-check" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><input type="checkbox" checked={form.explain} onChange={event => setForm({ ...form, explain: event.target.checked })} />请模型解释（不改数值）</label>
      <Button type="button" variant="primary" disabled={pending || working || draft.reviewStage !== 'draft'} onClick={() => start(async () => { setResult(await scaleDraft({ versionId: draft.versionId, fromValue: Number(form.fromValue), fromUnit: form.fromUnit, toValue: Number(form.toValue), toUnit: form.toUnit, label: form.label, explain: form.explain })); })}>{working ? '换算中…' : '换算并写入草稿'}</Button>
    </div>
    {result?.error ? <p role="alert" className="text-sm text-error">{result.error}</p> : null}
    {result?.message ? <p role="status" className="text-sm text-success">{result.message}</p> : null}
    {result?.changes?.length ? <ul className="ln-scale-changes">{result.changes.map(change => <li key={change.parameterId} data-rule={change.rule}>{describeScaleChange(change)}</li>)}</ul> : null}
    {result?.explanation ? <p className="ln-scale-explanation">{result.explanation}</p> : null}
  </section>;
}
