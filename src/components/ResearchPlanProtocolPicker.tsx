"use client";

import { useContextProperties } from "./ContextProperties";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { formInputClass } from "./forms";
import type { ResearchPlanProtocolOption } from "@/lib/research-plan-protocol-picker";

export function ResearchPlanProtocolPicker({ protocols, initialSelectedIds = [], initialPrimaryProtocolId, workspaceId }: {
  protocols: ResearchPlanProtocolOption[]; initialSelectedIds?: string[]; initialPrimaryProtocolId?: string; workspaceId?: string;
}) {
  const properties = useContextProperties();
  const [ids, setIds] = useState(() => [...new Set([...initialSelectedIds, ...(initialPrimaryProtocolId ? [initialPrimaryProtocolId] : [])])].filter(id => protocols.some(p => p.id === id)));
  const [primary, setPrimary] = useState(initialPrimaryProtocolId ?? "");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [checked, setChecked] = useState<string[]>([]);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const selected = protocols.filter(p => ids.includes(p.id));
  const matches = useMemo(() => protocols.filter(p => (filter === "all" || ids.includes(p.id) === (filter === "linked")) && [p.title,p.humanCode,p.scope].some(value => value?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))), [protocols, ids, query, filter]);
  function update(add: boolean) {
    const visible = checked.filter(id => matches.some(p => p.id === id));
    setIds(current => add ? [...new Set([...current,...visible])] : current.filter(id => !visible.includes(id)));
    if (!add && visible.includes(primary)) setPrimary("");
    setChecked([]);
  }
  const manager = <section aria-label="管理关联 Protocol" className="border-y border-hairline py-4" data-print-hidden>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">关联 Protocol · {ids.length}</h2><button type="button" className="min-h-11 px-2 text-moss" onClick={() => setTarget(null)}>完成管理</button></div>
    <div className="flex flex-wrap gap-2"><input type="search" aria-label="搜索关联 Protocol" placeholder="搜索名称或编号" className={formInputClass + " max-w-sm"} value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="关联筛选" className={formInputClass + " max-w-40"} value={filter} onChange={e => setFilter(e.target.value)}><option value="all">全部</option><option value="linked">已关联</option><option value="available">未关联</option></select></div>
    <div className="flex flex-wrap items-center gap-3 py-2"><label><input type="checkbox" aria-label="选择当前筛选全部" checked={matches.length > 0 && matches.every(p => checked.includes(p.id))} onChange={e => setChecked(e.target.checked ? matches.map(p => p.id) : [])} /> 选择当前筛选</label><button type="button" disabled={!checked.length} className="min-h-11 px-2 text-moss" onClick={() => update(true)}>批量添加</button><button type="button" disabled={!checked.length} className="min-h-11 px-2 text-error" onClick={() => update(false)}>解除所选关联</button></div>
    <ul className="divide-y divide-hairline">{matches.map(p => <li key={p.id} className="flex items-center gap-3 py-2"><input type="checkbox" aria-label={`选择 ${p.title}`} checked={checked.includes(p.id)} onChange={e => setChecked(current => e.target.checked ? [...current,p.id] : current.filter(id => id !== p.id))} /><div className="min-w-0 flex-1"><span className="mr-2 text-xs text-muted">{p.humanCode}</span>{p.title}<span className="ml-2 text-xs text-muted">{p.scope}</span></div><span className="text-sm">{ids.includes(p.id) ? "已关联" : "未关联"}</span></li>)}</ul>
    {!matches.length ? <p className="py-3 text-muted">没有匹配的 Protocol</p> : null}
    <label className="block py-2">主要 Protocol<select aria-label="主要 Protocol" value={primary} onChange={e => setPrimary(e.target.value)} className={formInputClass}><option value="">未指定</option>{selected.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
    <p className="text-xs text-muted">随研究方案保存。解除关联保留原 Protocol 和历史 Run 版本。</p>
  </section>;
  return <section aria-label="关联 Protocol 摘要" className="border-t border-hairline py-3">
    {ids.map(id => <input key={id} type="hidden" name="protocolIds" value={id} />)}<input type="hidden" name="primaryProtocolId" value={primary} />
    <h2 className="font-semibold">Protocol · {ids.length}</h2><ul className="divide-y divide-hairline">{selected.slice(0,3).map(p => <li key={p.id} className="py-2 text-sm"><span className="mr-2 text-xs text-muted">{p.humanCode}</span>{p.title}</li>)}</ul>
    <button type="button" className="min-h-11 text-moss" onClick={() => { const main = workspaceId ? document.getElementById(workspaceId) : null; setTarget(main ?? document.querySelector('main')); properties?.select(null); main?.scrollIntoView({block:'start'}); }}>管理全部（{ids.length}）</button>
    {target ? createPortal(manager,target) : null}
  </section>;
}
