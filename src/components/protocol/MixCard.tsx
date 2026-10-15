'use client';
import { readableError } from '@/lib/form-actions';
import { useContext, useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Beaker, Check, ClipboardCopy, Plus, Printer, X } from 'lucide-react';
import { chipAmount, chipReferenceId, isMaterialAmount, protocolChipView } from '@/lib/protocol-chips';
import { mixPer, mixQuantityLabel, mixTitle, mixView, newMixParameter, type MixProposal, type MixView, type ProtocolMix } from '@/lib/protocol-mix';
import { prefixedClientId as uid } from '@/lib/client-mutation-id';

import { ProtocolChip } from './ProtocolChip';
import { useProtocolEditor } from './ProtocolEditorContext';
import { resolveProtocolSystem } from '@/lib/structured-protocol';
import { ChipRenderContext, ChipText } from './ChipText';
import { RunChipContext, stepResolution, type RunChipStep } from './RunChip';
import './protocol.css';

const amount = (value: number | undefined, unit: string) => value === undefined ? '—' : chipAmount(Number(value.toPrecision(4)), unit);

/** 配液卡. In a Protocol it reads per reaction (values by system as chips); on the Run page it scales to this run and is confirmed. */
export function MixCard({ mix }: { mix: ProtocolMix }) {
  const run = useContext(RunChipContext);
  return run ? <RunMixCard mix={mix} step={run} /> : <ProtocolMixCard mix={mix} />;
}

function ProtocolMixCard({ mix }: { mix: ProtocolMix }) {
  const context = useContext(ChipRenderContext);
  // Across all systems fixed amounts are already known; a lens or a run supplies the rest.
  const view = mixView(mix, context?.systems, context?.resolution ?? (context?.systems ? resolveProtocolSystem(context.systems, context.lens ?? {}).parameters : {}));
  const per = mixPer(mix);
  return <figure className="ln-mix-card">
    <figcaption><Beaker aria-hidden /><strong>{mixTitle(mix)}</strong><span>每{per} · 余量 {mix.overagePercent}%</span></figcaption>
    <table><thead><tr><th scope="col">组分</th><th scope="col">每{per}</th><th scope="col"><span className="sr-only">加入方式</span></th></tr></thead>
      <tbody>{mix.components.map(component => <tr key={component.id}><th scope="row">{component.name || view.lines.find(line => line.id === component.id)?.name}</th><td><ChipText text={component.amount} /></td><td>{component.mode === 'separate' ? <span className="ln-mix-mode">单独加</span> : null}</td></tr>)}</tbody></table>
    <p className="ln-mix-aliquot">{view.lines.every(line => line.perReaction !== undefined) ? view.aliquot : `执行时按本次${mixQuantityLabel(mix)}换算合计并写出分装操作。`}</p>
  </figure>;
}

function plainText(mix: ProtocolMix, view: MixView) {
  const per = mixPer(mix);
  return [`${mixTitle(mix)} · ${view.quantity ?? '—'} ${per}（余量 ${mix.overagePercent}%）`, `组分\t每${per}\t合计`,
    ...view.lines.map(line => `${line.name}\t${amount(line.perReaction, line.unit)}\t${line.mode === 'separate' ? `${amount(line.total, line.unit)}（单独加）` : amount(line.total, line.unit)}`), view.aliquot].join('\n');
}

function RunMixCard({ mix, step }: { mix: ProtocolMix; step: RunChipStep }) {
  const router = useRouter();
  const key = `${step.stepId}:${mix.id}`, per = mixPer(mix), label = mixQuantityLabel(mix);
  const receipt = step.mixes[key];
  const runQuantity = step.quantities[label];
  const [typed, setTyped] = useState<string | null>(null);
  const [struck, setStruck] = useState<Set<string> | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const typedQuantity = typed !== null && /^\d+(\.\d+)?$/.test(typed.trim()) ? Number(typed) : undefined;
  const quantity = typedQuantity ?? (receipt?.quantitySource === 'card' ? receipt.quantity : runQuantity);
  const quantitySource = typedQuantity !== undefined && typedQuantity !== runQuantity ? 'card' as const : receipt?.quantitySource === 'card' && typed === null ? 'card' as const : 'run' as const;
  const view = mixView(mix, step.systems, stepResolution(step), quantity);
  const current = Boolean(receipt && receipt.fingerprint === view.fingerprint);
  const crossed = struck ?? new Set(step.strikes[key] ?? []);
  const editable = step.editable && !step.completed;
  const confirm = () => startTransition(async () => {
    setError('');
    const { confirmRunMix } = await import('@/app/experiments/[id]/run/actions');
    const result = await confirmRunMix({ experimentId: step.experimentId, stepId: step.stepId, mixId: mix.id, expectedRevision: step.revision, quantity: quantity!, quantitySource, fingerprint: view.fingerprint });
    if (result.error) setError(readableError(result.error)); else { setTyped(null); router.refresh(); }
  });
  // One line at a time, so the phone and the watch never undo each other's lines; the server's state wins on refresh.
  const toggle = (lineId: string) => {
    if (!current || !editable) return;
    const strike = !crossed.has(lineId);
    setStruck(new Set([...crossed].filter(id => id !== lineId).concat(strike ? [lineId] : [])));
    startTransition(async () => {
      const { strikeRunMixLine } = await import('@/app/experiments/[id]/run/actions');
      const result = await strikeRunMixLine({ experimentId: step.experimentId, stepId: step.stepId, mixId: mix.id, lineId, struck: strike });
      setStruck(null);
      if (result.error) setError(readableError(result.error)); else router.refresh();
    });
  };
  const copy = async () => { try { await navigator.clipboard.writeText(plainText(mix, view)); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { setError('无法复制，请手动选择文字'); } };
  const print = () => {
    const popup = window.open('', '_blank', 'width=720,height=640');
    if (!popup) { setError('浏览器阻止了打印窗口'); return; }
    const escape = (text: string) => text.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]!);
    // The print window has no app stylesheet: it takes the page's own ink and hairline tokens.
    const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    popup.document.write(`<!doctype html><meta charset="utf-8"><title>${escape(mixTitle(mix))}</title><style>body{font:14px/1.5 -apple-system,"PingFang SC",sans-serif;margin:24px;color:${token('--ink')}}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid ${token('--hairline')};padding:6px 8px;text-align:left}td.n{text-align:right;font-variant-numeric:tabular-nums}td.t{font-size:18px;font-weight:600}</style><h1 style="font-size:18px">${escape(mixTitle(mix))} · ${quantity ?? '—'} ${escape(per)}（余量 ${mix.overagePercent}%）</h1><table><tr><th>组分</th><th>每${escape(per)}</th><th>合计</th></tr>${view.lines.map(line => `<tr><td>${escape(line.name)}${line.mode === 'separate' ? '（单独加）' : ''}</td><td class="n">${escape(amount(line.perReaction, line.unit))}</td><td class="n t">${escape(amount(line.total, line.unit))}</td></tr>`).join('')}</table><p>${escape(view.aliquot)}</p>`);
    popup.document.close(); popup.focus(); popup.print();
  };
  const status = current ? `已确认 · ${new Date(receipt!.confirmedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}` : receipt ? '数值已变化，需重新确认' : '尚未确认';
  return <figure className="ln-mix-card is-run" data-state={current ? 'confirmed' : receipt ? 'stale' : 'draft'} aria-busy={pending || undefined}>
    <figcaption>
      <Beaker aria-hidden /><strong>{mixTitle(mix)}</strong>
      <label className="ln-mix-quantity">本次<input inputMode="numeric" aria-label={`本次${label}`} disabled={!editable || pending} value={typed ?? (quantity !== undefined ? String(quantity) : '')} placeholder="—" onChange={event => setTyped(event.target.value)} />{per}<span>余量 {mix.overagePercent}%</span></label>
      <span className="ln-mix-status">{current ? <Check aria-hidden /> : null}{status}</span>
    </figcaption>
    {quantity === undefined ? <p className="ln-mix-hint">请在“实验准备”填写{label}，或在此临时填写本卡的数量。</p> : quantitySource === 'card' && runQuantity !== undefined ? <p className="ln-mix-hint">本卡按 {quantity} {per}，与实验准备的 {runQuantity} 不同。</p> : null}
    <table>
      <thead><tr><th scope="col">组分</th><th scope="col">每{per}</th><th scope="col">合计</th></tr></thead>
      <tbody>{view.lines.map(line => <tr key={line.id} data-struck={crossed.has(line.id) || undefined} onClick={() => toggle(line.id)} title={current && editable ? '加完后点一下划掉（不计入进度）' : undefined}>
        <th scope="row">{current && editable ? <button type="button" className="ln-mix-strike focus-ring" aria-pressed={crossed.has(line.id)} aria-label={`${line.name}${crossed.has(line.id) ? '已加，点按撤销' : '加完后划掉'}`} onClick={event => { event.stopPropagation(); toggle(line.id); }}>{line.name}</button> : line.name}{line.mode === 'separate' ? <span className="ln-mix-mode">单独加</span> : null}</th>
        <td>{line.pending ?? amount(line.perReaction, line.unit)}</td>
        <td className="ln-mix-total">{amount(line.total, line.unit)}</td>
      </tr>)}</tbody>
    </table>
    <p className="ln-mix-aliquot">{view.aliquot}</p>
    {view.warnings.length ? <ul className="ln-mix-warnings">{view.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}
    <div className="ln-mix-actions">
      {editable ? <button type="button" className="focus-ring is-primary" disabled={pending || !view.ready || current} onClick={confirm}>{current ? '已确认' : receipt ? '重新确认' : '确认配液卡'}</button> : null}
      <button type="button" className="focus-ring" onClick={copy} disabled={!view.ready}><ClipboardCopy aria-hidden />{copied ? '已复制' : '复制'}</button>
      <button type="button" className="focus-ring" onClick={print} disabled={!view.ready}><Printer aria-hidden />打印</button>
      {current ? <span className="ln-mix-hint">加完一项点一下划掉；手表同步。</span> : null}
    </div>
    {error ? <p role="alert" className="ln-chip-error">{error}</p> : null}
  </figure>;
}

/** Edit a mix card in the Protocol: each component's name, its per-reaction amount (a chip, so it can differ by system) and whether it goes into the premix. */
export function MixEditor({ mix, onChange, getPos }: { mix: ProtocolMix; onChange: (mix: ProtocolMix) => void; getPos: () => number | undefined }) {
  const api = useProtocolEditor();
  const per = mixPer(mix);
  const lists = useId();
  const setComponent = (id: string, patch: Partial<ProtocolMix['components'][number]>) => onChange({ ...mix, components: mix.components.map(item => item.id === id ? { ...item, ...patch } : item) });
  const rename = (component: ProtocolMix['components'][number], name: string) => {
    setComponent(component.id, { name });
    const id = chipReferenceId(component.amount), material = api.materials.find(item => item.name === name.trim());
    if (id) api.updateSystems(systems => ({ ...systems, parameters: systems.parameters.map(p => p.id === id ? { ...p, label: name, ...(material ? { materialRef: { name: material.name, ...(material.rowId ? { rowId: material.rowId } : {}) } } : { materialRef: undefined }) } : p) }));
  };
  const add = () => {
    const parameter = newMixParameter(uid);
    api.updateSystems(systems => ({ ...systems, parameters: [...systems.parameters, parameter] }));
    onChange({ ...mix, components: [...mix.components, { id: uid('component'), name: '', amount: `{{${parameter.id}}}`, mode: 'premix' }] });
  };
  const number = (text: string, fallback: number) => { const value = Number(text); return Number.isFinite(value) && value >= 0 ? value : fallback; };
  return <div className="ln-mix-editor">
    <div className="ln-mix-editor-head">
      <Beaker aria-hidden />
      <input aria-label="配液卡名称" className="ln-program-input is-title" value={mix.title} placeholder="预混液" onChange={event => onChange({ ...mix, title: event.target.value })} />
      <label>每<input aria-label="每份是什么" className="ln-program-input is-per" value={mix.per} list={`${lists}-per`} onChange={event => onChange({ ...mix, per: event.target.value })} /></label>
      <datalist id={`${lists}-per`}><option value="反应" /><option value="孔" /><option value="样本" /><option value="管" /></datalist>
      <label>余量<input aria-label="余量百分比" className="ln-program-input is-cycles" inputMode="decimal" value={mix.overagePercent} onChange={event => onChange({ ...mix, overagePercent: Math.min(100, number(event.target.value, mix.overagePercent)) })} />%</label>
      <label>移液下限<input aria-label="移液下限（µL）" className="ln-program-input is-cycles" inputMode="decimal" value={mix.minPipetteUl} onChange={event => onChange({ ...mix, minPipetteUl: number(event.target.value, mix.minPipetteUl) })} />µL</label>
    </div>
    <table className="ln-mix-editor-table"><thead><tr><th scope="col">组分</th><th scope="col">每{per}</th><th scope="col">加入方式</th><th scope="col"><span className="sr-only">删除</span></th></tr></thead>
      <tbody>{mix.components.map(component => {
        const id = chipReferenceId(component.amount) ?? '';
        return <tr key={component.id}>
          <td><input aria-label="组分名称" className="ln-program-input is-label" value={component.name} placeholder="如 2× SYBR Mix" list={`${lists}-materials`} onChange={event => rename(component, event.target.value)} /></td>
          <td><button type="button" className="focus-ring ln-chip-hit ln-mix-amount" aria-label="编辑用量" onClick={event => { const pos = getPos(); if (typeof pos === 'number') api.openChip({ pos, id, anchor: event.currentTarget, focus: 'value' }); }}><ProtocolChip view={protocolChipView(id, api.systems)} lens={api.lens} /></button></td>
          <td><span className="ln-chip-modes" role="radiogroup" aria-label="加入方式"><button type="button" className="focus-ring" role="radio" aria-checked={component.mode === 'premix'} onClick={() => setComponent(component.id, { mode: 'premix' })}>预混</button><button type="button" className="focus-ring" role="radio" aria-checked={component.mode === 'separate'} title={`不进预混液，每${per}单独加入`} onClick={() => setComponent(component.id, { mode: 'separate' })}>单独加</button></span></td>
          <td><button type="button" className="focus-ring ln-chip-icon-button" aria-label={`删除${component.name || '组分'}`} disabled={mix.components.length < 2} onClick={() => onChange({ ...mix, components: mix.components.filter(item => item.id !== component.id) })}><X aria-hidden /></button></td>
        </tr>;
      })}</tbody></table>
    <datalist id={`${lists}-materials`}>{api.materials.map(material => <option key={`${material.name}:${material.rowId}`} value={material.name} />)}</datalist>
    <button type="button" className="focus-ring ln-chip-link is-add" onClick={add}><Plus aria-hidden />组分</button>
    <p className="ln-chip-note">用量写每{per}的量，可以按体系取值；执行时按本次{per}数和余量换算合计，并写出分装操作。</p>
  </div>;
}

/** Mix cards made at the bench from this step's chips (this run only), and offering one to the Protocol's next version. */
export function RunStepMixes({ step, mixes }: { step: RunChipStep; mixes: ProtocolMix[] }) {
  const router = useRouter();
  const [choosing, setChoosing] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [title, setTitle] = useState('现场配液');
  const [per, setPer] = useState('反应');
  const perList = useId();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const resolution = stepResolution(step);
  const amounts = step.fields.filter(field => field.source === 'chip' && isMaterialAmount(field.unit));
  if (!step.editable && !mixes.length) return null;
  const create = () => startTransition(async () => {
    const { createRunMix } = await import('@/app/experiments/[id]/run/actions');
    const result = await createRunMix({ experimentId: step.experimentId, stepId: step.stepId, expectedRevision: step.revision, title, per, parameterIds: chosen });
    if (result.error) setMessage(readableError(result.error)); else { setChoosing(false); setChosen([]); setMessage(''); router.refresh(); }
  });
  const propose = (mixId: string) => startTransition(async () => {
    const { proposeRunMix } = await import('@/app/experiments/[id]/run/actions');
    const result = await proposeRunMix({ experimentId: step.experimentId, stepId: step.stepId, mixId });
    setMessage(result.error ? readableError(result.error) : '已提议：规程作者在编辑页可一键加入下一个版本。');
  });
  return <div className="ln-run-mixes">
    {mixes.map(mix => <div key={mix.id} className="ln-run-mix-extra"><span className="ln-mix-tag">执行时补充</span><MixCard mix={mix} />{step.editable ? <button type="button" className="focus-ring ln-chip-link" disabled={pending} onClick={() => propose(mix.id)}>提议加入规程</button> : null}</div>)}
    {step.editable && !step.completed && amounts.length >= 2 ? choosing
      ? <div className="ln-run-mix-chooser" role="group" aria-label="现场生成配液卡">
        <p className="ln-chip-note">选几个用量一起配，按每{per}的量换算合计。只记入本次执行。</p>
        {amounts.map(field => { const value = resolution[field.id]; return <label key={field.id} className="ln-chip-check"><input type="checkbox" checked={chosen.includes(field.id)} onChange={event => setChosen(current => event.target.checked ? [...current, field.id] : current.filter(id => id !== field.id))} />{field.label}<span className="ln-chip-note">{value?.status === 'resolved' ? chipAmount(value.value!, value.unit) : '待确定'}</span></label>; })}
        <div className="ln-run-mix-chooser-row"><label>名称<input value={title} onChange={event => setTitle(event.target.value)} /></label><label>每<input value={per} onChange={event => setPer(event.target.value)} list={perList} /></label><datalist id={perList}><option value="反应" /><option value="孔" /><option value="样本" /></datalist></div>
        <div className="ln-mix-actions"><button type="button" className="focus-ring is-primary" disabled={pending || chosen.length < 1 || !per.trim()} onClick={create}>生成配液卡</button><button type="button" className="focus-ring" onClick={() => setChoosing(false)}>取消</button></div>
      </div>
      : <button type="button" className="focus-ring ln-chip-link is-add" onClick={() => setChoosing(true)}><Plus aria-hidden />现场配液卡</button> : null}
    {message ? <p role="status" className="ln-chip-note">{message}</p> : null}
  </div>;
}

/** In the Protocol editor: mix cards made at the bench and offered from runs. Adding puts the card in its step; saving keeps it. */
export function MixProposals({ proposals, onAdd, onDismiss }: { proposals: MixProposal[]; onAdd: (proposal: MixProposal) => void; onDismiss?: (proposalId: string) => Promise<{ error?: string }> }) {
  const api = useProtocolEditor();
  const [hidden, setHidden] = useState<string[]>([]);
  // The same card offered twice is one proposal; adding hides every copy.
  const visible = proposals.filter((proposal, index) => !hidden.includes(proposal.mix.id) && proposals.findIndex(other => other.mix.id === proposal.mix.id) === index);
  if (!visible.length) return null;
  return <aside className="ln-mix-proposals" aria-label="执行时补充的配液卡">
    {visible.map(proposal => {
      const missing = proposal.mix.components.filter(component => !api.systems?.parameters.some(p => p.id === chipReferenceId(component.amount))).length;
      return <div key={proposal.id} className="ln-mix-proposal">
        <Beaker aria-hidden />
        <p><strong>{mixTitle(proposal.mix)}</strong> · {proposal.mix.components.length} 个组分<span>{proposal.runCode ? `来自 ${proposal.runCode}` : '来自执行'}{proposal.stepTitle ? ` · ${proposal.stepTitle}` : ''}{missing ? ` · ${missing} 个用量在此版本中已删除，加入后需重新填写` : ''}</span></p>
        <button type="button" className="focus-ring ln-chip-done" onClick={() => { onAdd(proposal); setHidden(current => [...current, proposal.mix.id]); }}>加入该步骤</button>
        {onDismiss ? <button type="button" className="focus-ring ln-chip-link" onClick={() => { setHidden(current => [...current, proposal.mix.id]); void Promise.all(proposals.filter(other => other.mix.id === proposal.mix.id).map(other => onDismiss(other.id))); }}>忽略</button> : null}
      </div>;
    })}
  </aside>;
}
