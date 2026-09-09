"use client";
import { previewRunConsumption, type RunConsumptionSource } from "@/lib/run-consumption";
import { QuantityInput } from "./QuantityInput";
import { convert, parseScalar } from "@/lib/calculators/quantities";
import {newClientMutationId} from "@/lib/client-mutation-id";
import { createPortal } from "react-dom";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formInputClass, preventImplicitEnterSubmit } from "./forms";
import { Button } from "./ui/Button";
import { enqueueMobileMutation } from "@/lib/mobile-mutation-queue";
type Row = {
  id: string;
  name: string;
  expected: number | null;
  actual: number | null;
  unit: string;
  source: string;
  inventoryItemId: string | null;
  containerId: string | null;
  status: string;
  error: string | null;
  correctionOfId: string | null;
};
type Stock = {
  id: string;
  name: string;
  unit: string;
  managementMode: string;
  lotNumber: string | null;
  containers: { id: string; holder: string | null }[];
};
export function RunMaterials({
  experimentId,
  rows,
  stock,
  editable,
  consumptionSources = [],
  parameterValues = {},
}: {
  consumptionSources?: RunConsumptionSource[];
  parameterValues?: Record<string,string|number|boolean>;
  experimentId: string;
  rows: Row[];
  stock: Stock[];
  editable: boolean;
  planned?: {materialName:string;quantity:number;unit:string;formula?:string}[];
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [review, setReview] = useState(false);
  const sessionKey = useRef('create');
  type Draft = {draftId:string|null;name:string;expected:string;actual:string;unit:string;source:string;inventory:string;container:string;correction:string|null;mode:string};
  const drafts = useRef<Record<string,Draft>>({});
  const [dialogActive,setDialogActive] = useState(false);
  function applyDraft(d:Draft) {setDraftId(d.draftId);setName(d.name);setExpected(d.expected);setActual(d.actual);setUnit(d.unit);setSource(d.source);setInventory(d.inventory);setContainer(d.container);setCorrection(d.correction);setMode(d.mode);}
  const blankDraft: Draft = {draftId:null,name:'',expected:'',actual:'',unit:'mL',source:'manual',inventory:'',container:'',correction:null,mode:'manual'};
  function rowDraft(row: Row, correcting=false): Draft {return {draftId:correcting?null:row.id,name:row.name,expected:row.expected===null?'':String(row.expected),actual:row.actual===null?'':String(row.actual),unit:row.unit,source:correcting?`correction:${row.id}`:row.source,inventory:row.inventoryItemId??'',container:correcting?'':row.containerId??'',correction:correcting?row.id:row.correctionOfId,mode:'manual'};}
  function openDialog(key='create', initial=blankDraft) {
    if (busy) return;
    if(key!==sessionKey.current) {
      drafts.current[sessionKey.current]={draftId,name,expected,actual,unit,source,inventory,container,correction,mode};
      applyDraft(drafts.current[key] ?? initial);
      sessionKey.current=key;
    }
    setDialogActive(true);setMounted(true);requestAnimationFrame(()=>dialogRef.current?.showModal());
  }
  function closeDialog() { setDialogActive(false); dialogRef.current?.close(); triggerRef.current?.focus(); }
  async function remove(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/experiments/${experimentId}/materials`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id})});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setStatus('使用记录已删除；库存未改变。'); router.refresh();
    } catch(error) { setStatus(error instanceof Error ? error.message : '删除失败，请重试'); }
    finally {setBusy(false);}
  }
  const [mode,setMode] = useState('manual');
  const [versionId,setVersionId] = useState(consumptionSources[0]?.id ?? '');
  const [parameterDraft,setParameterDraft] = useState(parameterValues);
  const [preview,setPreview] = useState<ReturnType<typeof previewRunConsumption>>([]);
  const [previewError,setPreviewError] = useState('');
  const [name, setName] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [unit, setUnit] = useState("mL");
  const [source, setSource] = useState("manual");
  const [inventory, setInventory] = useState("");
  const [container, setContainer] = useState("");
  const [correction, setCorrection] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  function adjustment(row: Row) {
    const original = rows.find(r=>r.id===row.correctionOfId);
    if (!original || original.actual===null || row.actual===null) return '';
    try {const prior=original.unit===row.unit?original.actual:convert(original.actual,original.unit,row.unit);const delta=Number((prior-row.actual).toPrecision(12));return `；账面调整 ${delta>0?'+':''}${delta} ${row.unit}（更正用量，不代表实物退库）`;} catch{return '；单位不兼容，不能扣减';}
  }
  const selected = stock.find((s) => s.id === inventory);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const id = draftId ?? newClientMutationId();
    setDraftId(id);
    const payload = {
      action: "save",
      id,
      name,
      expected: expected.trim() ? Number(expected) : null,
      actual: actual.trim() ? Number(actual) : null,
      unit,
      source,
      inventoryItemId: inventory || null,
      containerId: container || null,
      correctionOfId: correction,
    };
    try {
      if (!navigator.onLine) {
        await enqueueMobileMutation({
          actionType: "run.material",
          clientMutationId: id,
          deviceCreatedAt: new Date().toISOString(),
          state: "pending",
          retryCount: 0,
          payload: { experimentId, row: payload },
        });
        setStatus("已存本机，等待同步；尚未扣减库存。");
      } else {
        const r = await fetch(`/api/experiments/${experimentId}/materials`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await r.json();
        if (!r.ok) throw new Error(result.error);
        setStatus("使用记录已保存，尚未执行库存扣减。");
        router.refresh();
      }
      if ((event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-continue") !== "true") closeDialog();
      setDraftId(null);
      setName("");
      setExpected("");
      setActual("");
      setCorrection(null);
      setInventory('');setContainer('');setSource('manual');setMode('manual');setPreview([]);
      delete drafts.current[sessionKey.current];sessionKey.current='create';applyDraft(drafts.current.create ?? blankDraft);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "保存失败，输入仍保留",
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    try {
      const r = await fetch(`/api/experiments/${experimentId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          ids: selection,
        }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setStatus(
        result.some((r: { status: string }) => !["submitted","recorded"].includes(r.status))
          ? "部分扣减待处理，使用记录已保留。"
          : "已完成确认。",
      );
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "提交失败，可重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="border-t border-hairline py-4">
      <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-semibold">本次使用的试剂与耗材</h2>{editable ? <button ref={triggerRef} type="button" className="focus-ring min-h-11 px-3 text-moss" onClick={()=>openDialog()}>添加</button> : null}</div>
      {!rows.length ? <p className="text-sm text-muted">尚未记录</p> : null}
      <div className="overflow-x-auto" hidden={!rows.length}>
        <table className="ln-run-material-table w-full text-left text-sm">
          <thead>
            <tr>
              {["物料", "预计", "实际", "库存处理", "操作"].map((h) => (
                <th key={h} className="px-2 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-hairline">
                <td data-label="物料" className="p-2">{row.name}</td>
                <td data-label="预计" className="p-2 text-right tabular-nums">
                  {row.expected ?? "未记录"} {row.unit}
                </td>
                <td data-label="实际" className="p-2 text-right tabular-nums">
                  {row.actual ?? "未确认"} {row.unit}
                </td>
                <td data-label="来源" className="p-2">
                  {row.status === "pending" && editable ? <label className="flex gap-2"><input type="checkbox" aria-label={`选择扣减 ${row.name}`} checked={selection.includes(row.id)} onChange={event=>setSelection(old=>event.target.checked?[...old,row.id]:old.filter(id=>id!==row.id))}/>待确认扣减</label> : row.status === 'submitted' ? '已扣减' : '仅记录'}
                  <details><summary className="cursor-pointer text-muted">来源与详情</summary><p>{row.source === 'manual' ? '手动填写' : row.source.startsWith('correction:') ? '更正记录' : '依据规程'}</p>{row.source.startsWith('Consumption:') ? <p className="break-words">{row.source.split('|').slice(1).join('|') || row.source}</p> : null}<p>{stock.find(s=>s.id===row.inventoryItemId)?.name ?? '不管理库存'}</p>{row.containerId ? <p>{row.containerId}</p> : null}{row.error ? <p role="alert" className="text-error">{row.error}</p> : null}</details>
                </td>
                <td data-label="操作" className="p-2">
                  {row.status !== "submitted" && editable ? <button type="button" className="focus-ring ml-2 min-h-11 text-moss" onClick={()=>openDialog(`edit:${row.id}`,rowDraft(row))}>编辑</button>:null}
                  {row.status !== "submitted" && editable ? <button type="button" disabled={busy} className="focus-ring ml-2 min-h-11 text-error" onClick={()=>remove(row.id)}>删除</button>:null}
                  {row.status === "submitted" &&
                  editable &&
                  !rows.some((r) => r.correctionOfId === row.id) ? (
                    <button
                      type="button"
                      className="focus-ring ml-2 min-h-11 text-moss"
                      onClick={()=>openDialog(`correction:${row.id}`,rowDraft(row,true))}
                    >
                      登记更正
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable ? (
        <>
          {mounted ? createPortal(<dialog ref={dialogRef} aria-label="添加耗材" className="ln-material-dialog bg-surface text-ink" onCancel={event=>{if(busy){event.preventDefault();return;}setDialogActive(false);triggerRef.current?.focus();}}>
          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{correction ? '更正耗材记录' : sessionKey.current.startsWith('edit:') ? '编辑耗材' : '添加耗材'}</h3><Button type="button" disabled={busy} onClick={closeDialog}>关闭</Button></div>
          {status && dialogActive ? <p role="alert" className="my-2 text-sm">{status}</p> : null}
          <form
            onSubmit={save}
            onKeyDown={preventImplicitEnterSubmit}
            className="mt-4 flex flex-wrap items-end gap-3"
          >
            <fieldset disabled={busy} className="contents"><label className="text-sm">添加方式<select aria-label="添加方式" className={formInputClass} value={mode} onChange={e=>{setMode(e.target.value);if(e.target.value==='manual')setSource('manual');}}><option value="manual">手动填写</option><option value="protocol">依据规程</option></select></label>
            {mode==='protocol' ? <div className="w-full space-y-3"><label>规程版本<select aria-label="规程版本" className={formInputClass} value={versionId} onChange={e=>{setVersionId(e.target.value);setPreview([]);}}>{consumptionSources.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label>{!consumptionSources.length ? <p>锁定版本没有可用的耗材规则。</p> : null}{consumptionSources.find(v=>v.id===versionId)?.keys.map(key=><label key={key} className="block">{key}<input className={formInputClass} value={String(parameterDraft[key]??'')} onChange={e=>{setParameterDraft(p=>({...p,[key]:e.target.value}));setPreview([]);}}/></label>)}<Button type="button" onClick={()=>{try{const selected=consumptionSources.find(v=>v.id===versionId);if(!selected)throw Error('请选择含耗材规则的锁定版本。');setPreview(previewRunConsumption(selected,parameterDraft));setPreviewError('');}catch(e){setPreviewError(e instanceof Error?e.message:'参数无效');}}}>计算预计量</Button>{previewError ? <p role="alert" className="text-error">{previewError}</p>:null}{preview.map(p=><div key={p.source}><p>{p.materialName}：{p.quantity} {p.unit}</p><p className="text-sm text-muted">{p.basis}</p><Button type="button" disabled={rows.some(row=>row.source===p.source || row.source.startsWith(p.source+'|'))} onClick={()=>{setName(p.materialName);setExpected(String(p.quantity));setUnit(p.unit);setSource(p.source+'|'+p.basis);}}>选择此项</Button>{rows.some(row=>row.source===p.source || row.source.startsWith(p.source+'|'))?<span>已添加，请编辑原记录</span>:null}</div>)}</div>:null}
            <label className="text-sm">
              名称
              <input
                required
                className={formInputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="text-sm">
              预计
              <input
                className={formInputClass}
                type="number"
                min="0"
                step="any"
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
              />
            </label>
            <QuantityInput label="实际" name="actual" value={actual} unit={unit || "mL"} onChange={(next, nextUnit) => {
              try { const nextExpected = nextUnit !== unit && expected.trim() ? String(Number(convert(parseScalar(expected),unit,nextUnit).toPrecision(14))) : expected; setExpected(nextExpected); setActual(next); setUnit(nextUnit); }
              catch { setStatus("请先完成预计用量，再切换单位。"); }
            }} />
            <p className="w-full text-sm text-muted">{source === 'manual' ? '手动填写' : correction ? '更正已扣减记录：保存后仍需明确确认库存调整。' : '依据规程：'+source.replace('Consumption: ', '')}</p>
            <label className="text-sm">
              库存来源
              <select
                className={formInputClass}
                value={inventory}
                disabled={!!correction}
                onChange={(e) => {
                  setInventory(e.target.value);
                  setContainer("");
                }}
              >
                <option value="">不管理库存</option>
                {stock.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.lotNumber ?? "批号未记录"} · {s.id.slice(-6)}
                  </option>
                ))}
              </select>
            </label>
            {selected?.managementMode === "package" ? (
              <label className="text-sm">
                实际瓶
                <select
                  required
                  className={formInputClass}
                  value={container}
                  onChange={(e) => setContainer(e.target.value)}
                >
                  <option value="">请选择已领用的瓶</option>
                  {selected.containers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} · {c.holder ?? "持有人未记录"}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <Button type="button" disabled={!expected.trim()} onClick={()=>setActual(expected)}>将预计量确认为实际量</Button>
            <Button type="submit" disabled={busy || (mode==='protocol' && !source.startsWith('Consumption:'))}>
              {correction ? "保存更正" : "保存使用记录"}
            </Button>
            <Button type="submit" data-continue="true" disabled={busy}>添加并继续</Button>
          </fieldset></form></dialog>, document.body) : null}
          {selection.length ? (
            <Button
              type="button"
              className="mt-4"
              disabled={busy}
              onClick={()=>setReview(true)}
            >
              核对所选 {selection.length} 项扣减
            </Button>
          ) : null}
          {review ? <div className="mt-3 border-t border-hairline py-3"><p>仅扣减以下已选用量；保存记录本身不会扣库。</p><ul>{rows.filter(r=>selection.includes(r.id)).map(r=><li key={r.id}>{r.name}：{r.actual ?? '未确认'} {r.unit}{adjustment(r)}</li>)}</ul><Button type="button" disabled={busy || !selection.length} onClick={async()=>{await confirm();setReview(false);setSelection([]);}}>确认扣减所选项</Button><Button type="button" onClick={()=>setReview(false)}>取消</Button></div> : null}
        </>
      ) : null}
      {status && !dialogActive ? (
        <p role="status" className="mt-3 text-sm">
          {status}
        </p>
      ) : null}
    </section>
  );
}
