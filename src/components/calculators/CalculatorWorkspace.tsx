"use client";
import { CommonTasks } from "./CommonTasks";
import { TaskIcon } from "./TaskIcon";
import { TaskHelp } from "./TaskHelp";
import { StorageRecovery } from "./StorageRecovery";
import { retryCalculatorStorage } from "@/lib/calculators/calculator-storage";
import { newClientMutationId } from "@/lib/client-mutation-id";

import { enqueueMobileMutation, requestMobileMutationSync, listMobileMutations, mobileQueueChangedEvent } from "@/lib/mobile-mutation-queue";
import { compatibleUnits, convert, parseScalar, units } from "@/lib/calculators/quantities";
import { defaultTasks, isFieldVisible, legacyTaskMap } from "@/lib/calculators/task-definitions";
import { MixEditor, SampleEditor, RecipeEditor, type RecipeRow, ReactionGroups, type ReactionGroup, CurveEditor } from "./StructuredInputs";
import type { MixRow, SampleRow } from "@/lib/calculators/planning";
import { recordVisit, saveDraft, restoreLegacyInputs } from "@/lib/calculators/calculator-storage";
import { ResultPanel } from "./ResultPanel";
import { resultClipboard } from "@/lib/calculators/result-presentation";
import { OfflineCalculator } from "./OfflineCalculator";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Calculator, Check, Copy, FlaskConical, History, Pin, PinOff, RotateCcw, Save, Search, Upload, X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { calculate, getCalculatorCatalog, getCalculatorDefinition, type CalculatorDefinition, type CalculatorResult } from "@/lib/calculators/calculator-engine";
import { restoreCalculatorResult, addHistoryEntry, addPreset, deletePreset, getCalculatorStorageIssue, loadCalculatorState, saveCalculatorState, toggleFavorite, type CalculatorState } from "@/lib/calculators/calculator-storage";

const categoryLabels = {
  "cell-culture": ["Cells", "细胞"],
  protein: ["Protein", "蛋白"],
  solutions: ["Solutions", "配液"],
  "molecular-biology": ["Nucleic acids", "核酸"],
  "virology-microbiology": ["Microbiology", "微生物"],
  general: ["Units & equipment", "单位与设备"],
} as const;

function useCalculatorState() {
  const [state, setState] = useState<CalculatorState | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState("");
  const pending=useRef<CalculatorState|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>{const flush=()=>{clearTimeout(timer.current);if(pending.current){saveCalculatorState(pending.current);pending.current=null;}};window.addEventListener('pagehide',flush);return()=>{window.removeEventListener('pagehide',flush);flush();};},[]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setState(loadCalculatorState());
      setPersistenceWarning(getCalculatorStorageIssue());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const update = (next: CalculatorState, delay=0) => {
    setState(next);pending.current=next;clearTimeout(timer.current);
    const persist=()=>{saveCalculatorState(next);pending.current=null;setPersistenceWarning(getCalculatorStorageIssue());};
    if(delay)timer.current=setTimeout(persist,delay);else persist();
  };
  const retry=()=>{clearTimeout(timer.current);pending.current=null;setState(retryCalculatorStorage());setPersistenceWarning(getCalculatorStorageIssue());};
  return { state, update, persistenceWarning, retry };
}

export function CalculatorCatalog() {
  const {locale}=useI18n(), zh=locale==='zh';
  const {state,update,persistenceWarning,retry}=useCalculatorState();
  const [query,setQuery]=useState('');
  const catalog=getCalculatorCatalog();
  const visible=catalog.filter(tool=>!legacyTaskMap[tool.id]);
  const filtered=visible.filter(tool=>[tool.name,tool.nameZh,...tool.aliases].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  const pins=state?.favoritesConfigured?state.favorites:defaultTasks;
  const toolLink=(id:string)=>{const tool=catalog.find(t=>t.id===id);return tool?<Link className="block min-h-11 min-w-0 rounded-lg border border-hairline p-3 hover:bg-warm" href={`/tools/calculator/${id}`}><strong className="text-sm">{zh?tool.nameZh:tool.name}</strong><p className="mt-1 text-xs text-muted">{zh?tool.shortDescriptionZh:tool.shortDescription}</p></Link>:null;};
  return <div className="calculator-catalog mx-auto max-w-4xl space-y-2"><div className="flex items-center gap-2"><h1 className="min-w-0 text-sm font-semibold">{zh?'实验计算':'Lab Calculations'}</h1><label className="flex min-h-11 flex-1 min-w-0 items-center gap-2 rounded-lg border border-hairline px-3"><Search className="h-4 w-4"/><input aria-label={zh?'搜索计算':'Search calculations'} className="min-h-11 min-w-0 flex-1 bg-transparent outline-none" value={query} onChange={e=>setQuery(e.target.value)} placeholder={zh?'稀释、铺板、抗体、ng/μL…':'Search…'}/></label></div>
    <StorageRecovery message={persistenceWarning} onRetry={retry} zh={zh}/>
    {!query?<><CommonTasks pins={pins} state={state} update={update} zh={zh}/ ><section><h2 className="mb-2 text-sm font-semibold">{zh?'最近使用':'Recently used'}</h2>{state?.recent.slice(0,3).map(item=><div key={item.calculatorId}>{toolLink(item.calculatorId)}<p className="mb-2 text-xs text-muted">{(()=>{const tool=catalog.find(tool=>tool.id===item.calculatorId);if(!tool)return item.summary;if([tool.shortDescription,tool.shortDescriptionZh].includes(item.summary))return zh?tool.shortDescriptionZh:tool.shortDescription;return tool.fields.reduce((summary,field)=>summary.replaceAll(zh?field.label:field.labelZh,zh?field.labelZh:field.label),item.summary);})()}</p></div>)}{!state?.recent.length?<p className="text-xs text-muted">{zh?'打开任务后会显示在这里。':'Opened tasks appear here.'}</p>:null}</section></>:null}
    {Object.entries(categoryLabels).map(([category,labels])=>{const tools=filtered.filter(t=>t.category===category);return tools.length?<details key={`${category}-${Boolean(query)}`} open={Boolean(query)} className="rounded-lg border border-hairline"><summary className="min-h-11 cursor-pointer p-3 font-medium">{zh?labels[1]:labels[0]}</summary><div className="space-y-2 p-3">{tools.map(tool=><div key={tool.id} className="grid grid-cols-[minmax(0,1fr)_44px] gap-2">{toolLink(tool.id)}<button aria-label={zh?'固定工具':'Pin task'} onClick={()=>state&&update(toggleFavorite({...state,favorites:[...pins]},tool.id))}><Pin className="h-4 w-4"/></button></div>)}</div></details>:null;})}
    {!filtered.length?<p>{zh?'未找到匹配任务':'No matching tasks'}</p>:null}
    <details><summary className="min-h-11 cursor-pointer">{zh?'我的配方':'My recipes'} ({state?.presets.length??0})</summary>{state?.presets.map(item=><Link className="block min-h-11" key={item.id} href={`/tools/calculator/${item.calculatorId}`}>{item.name}</Link>)}</details>
    <details><summary className="min-h-11 cursor-pointer">{zh?'计算记录':'Calculation records'} ({state?.history.length??0})</summary>{state?.history.map(item=><Link className="block min-h-11 text-sm" key={item.id} href={`/tools/calculator/${item.calculatorId}?record=${encodeURIComponent(item.id)}`}>{zh?item.calculatorNameZh:item.calculatorName} · {new Date(item.createdAt).toLocaleString(locale)}</Link>)}</details>
  </div>;
}

type PlateContext = { workspaceId: string; plateId: string; plateName: string; plateSize: number; wellIds: string[] };

export function CalculatorWorkbench({ calculatorId, initialInputs = {}, plateContext, embedded = false, embeddedLocale }: { calculatorId: string; initialInputs?: Record<string, string | number>; plateContext?: PlateContext; embedded?: boolean; embeddedLocale?: "zh" | "en" }) {
  const definition = useMemo(() => getCalculatorDefinition(calculatorId), [calculatorId]);
  const { locale: appLocale } = useI18n();
  const locale = embeddedLocale ?? appLocale;
  const zh = locale === "zh";
  const { state, update, persistenceWarning, retry } = useCalculatorState();
  const defaults = useMemo(() => {
    const defaults:Record<string,unknown>=Object.fromEntries(definition.fields.map(field=>[field.key,field.type==='select'?field.defaultValue??'':'']));
    const supplied=Object.keys(initialInputs).some(key=>['stockConcentration','fold'].includes(key))&&!initialInputs.mode?restoreLegacyInputs(calculatorId,initialInputs).inputs:initialInputs;
    for(const field of definition.fields){if(supplied[field.key]!==undefined)defaults[field.key]=supplied[field.key];if(supplied[`${field.key}Unit`]!==undefined)defaults[`${field.key}Unit`]=supplied[`${field.key}Unit`];}
    if(plateContext){if(definition.fields.some(field=>field.key==='wells'))defaults.wells=String(plateContext.wellIds.length);if(calculatorId==='master-mix'){defaults.samples=String(plateContext.wellIds.length);defaults.replicates='1';defaults.controls='0';}}
    return defaults;
  }, [definition,initialInputs,calculatorId,plateContext]);
  const [inputs, setInputs] = useState<Record<string, unknown>>(defaults);
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [manualCopy,setManualCopy]=useState("");
  const [presetName, setPresetName] = useState("");
  const [operator,setOperator]=useState("");
  const [recordStatus,setRecordStatus]=useState("");
  const mutationId=useRef<string|null>(null);
  useEffect(()=>{
    const read=async()=>{if(!mutationId.current)return;try{const mutation=(await listMobileMutations()).find(item=>item.clientMutationId===mutationId.current);if(mutation?.lastError)setRecordStatus(`${zh?'本机意图已保留；服务器尚未接受：':'Local intent retained; server has not accepted: '}${mutation.lastError}`);}catch{/* Queue storage exposes its own failure when saving. */}};
    window.addEventListener(mobileQueueChangedEvent,read);
    return()=>window.removeEventListener(mobileQueueChangedEvent,read);
  },[zh]);
  const [example,setExample]=useState(false);
  const [sourceRecord,setSourceRecord]=useState<string>();
  const [historical,setHistorical]=useState(false);
  const visitRef=useRef(false);
  useEffect(()=>{
    if(!state||visitRef.current)return;
    const frame=window.requestAnimationFrame(()=>{
    visitRef.current=true;
    const previous=state.drafts[calculatorId]?.inputs;
    if(previous)setInputs(current=>{const next={...current};for(const field of definition.fields){const unit=previous[`${field.key}Unit`];if(!String(current[field.key]??'').trim()&&typeof unit==='string'&&units[unit])next[`${field.key}Unit`]=unit;}return next;});
    const record=state.history.find(item=>item.id===initialInputs.record);
    if(record){setResult(restoreCalculatorResult(record));setHistorical(true);setSourceRecord(record.id);}
    update(recordVisit(state,calculatorId,zh?definition.shortDescriptionZh:definition.shortDescription));
    });return ()=>window.cancelAnimationFrame(frame);
  },[state,calculatorId,definition,initialInputs.record,update,zh]);
  function edit(next:Record<string,unknown>, nextExample=example) {
    if(initialInputs.experimentId&&initialInputs.experimentStepId)next={...next,__context:{experimentId:initialInputs.experimentId,experimentStepId:initialInputs.experimentStepId}};
    else if(plateContext)next={...next,__context:plateContext};
    mutationId.current=null;setManualCopy("");setCopied(false);setRecordStatus("");setInputs(next);setHistorical(false);setResult(null);setError('');setExample(nextExample);
    if(state)update(saveDraft(state,calculatorId,next,nextExample),200);
    if(!['master-mix','normalization','ic50-ec50','elisa-4pl','bradford-bca'].includes(calculatorId)&&!Array.isArray(next.samples)) {
      try {setResult(calculate({calculatorId,inputs:next}));} catch { /* Partial input never keeps the previous result. */ }
    }
  }
  function restore(inputs:Record<string,unknown>,version?:string) {const restored=version?.endsWith("-v2")?{inputs}:restoreLegacyInputs(calculatorId,inputs);edit(restored.inputs,false);if(restored.warning)setError(restored.warning);}


  function runCalculation(event?: FormEvent) {
    event?.preventDefault();setManualCopy("");setCopied(false);
    try {
      const next = calculate({ calculatorId, inputs });
      setResult(next);
      if(state)update(recordVisit(state,calculatorId,definition.fields.filter(field=>isFieldVisible(calculatorId,field.key,inputs)&&field.type==='number').slice(0,3).map(field=>`${zh?field.labelZh:field.label}: ${inputs[field.key]??''} ${inputs[`${field.key}Unit`]??field.unit??''}`).join(' · ')));
      setError("");
    } catch (calculationError) {
      setResult(null);
      const raw=calculationError instanceof Error?calculationError.message:'Calculation failed.';
      setError(definition.fields.reduce((message,field)=>message.replaceAll(field.key,zh?field.labelZh:field.label),raw));
    }
  }

  function saveResult() {
    if (!state || !result || historical || example) return;
    const id = newClientMutationId();
    update(addHistoryEntry(state, { id, calculatorId, calculatorName: definition.name, calculatorNameZh: definition.nameZh, createdAt: new Date().toISOString(), methodVersion: result.methodVersion, inputs, inputUnits: Object.fromEntries(definition.fields.filter((field) => field.unit && field.unit !== "integer").map((field) => [field.key, String(inputs[`${field.key}Unit`]??field.unit!)])), outputs: result.outputs, warnings: result.warnings, snapshot: structuredClone(result), example, sourceRecordId: sourceRecord, context: plateContext ? {...plateContext} : undefined }));
  }

  async function recordExperiment() {
    if(!result||example||historical||!operator.trim()||!initialInputs.experimentId||!initialInputs.experimentStepId)return;
    mutationId.current??=newClientMutationId();
    try {await enqueueMobileMutation({clientMutationId:mutationId.current,actionType:'calculation.create',deviceCreatedAt:new Date().toISOString(),state:'pending',retryCount:0,payload:{experimentId:String(initialInputs.experimentId),experimentStepId:String(initialInputs.experimentStepId),operator:operator.trim(),calculatorId,inputs,snapshot:result}});requestMobileMutationSync();setRecordStatus(zh?'已加入统一同步队列；同步状态可在待同步记录查看。':'Added to sync queue; check sync status for completion.');}catch{setRecordStatus(zh?'无法保存到本机队列，请保留页面。':'Cannot save locally; keep this page open.');}
  }
  function savePreset() {
    if (!state || !presetName.trim()) return;
    const id = newClientMutationId();
    update(addPreset(state, { id, calculatorId, name: presetName.trim(), createdAt: new Date().toISOString(), methodVersion:definition.methodVersion,source:example?"synthetic example":"user-defined", inputs }));
    setPresetName("");
  }

  function applyToPlate() {
    if (!result || !plateContext || historical || example) return;
    if(inputs.wells!==undefined&&Number(inputs.wells)!==plateContext.wellIds.length){setError(zh?"孔数与所选孔位不一致，请确认关联。":"Well count does not match selection; review context.");return;}
    const plateInputs={...inputs};
    for(const field of definition.fields){if(!field.unit||!isFieldVisible(calculatorId,field.key,inputs)||!String(inputs[field.key]??'').trim())continue;const from=String(inputs[`${field.key}Unit`]??field.unit);if(compatibleUnits(field.unit).includes(from)){plateInputs[field.key]=convert(parseScalar(inputs[field.key]),from,field.unit);plateInputs[`${field.key}Unit`]=field.unit;}}
    const payload = { ...result, type: "labnest:calculator-result", calculatorId, calculatorName: zh ? definition.nameZh : definition.name, plateContext, inputs:plateInputs, rawInputs:inputs, outputs: result.outputs, table: result.table, methodVersion: result.methodVersion };
    if (window.opener) {
      window.opener.postMessage(payload, window.location.origin);
      window.close();
      return;
    }
    if (window.parent !== window) window.parent.postMessage(payload, window.location.origin);
  }

  async function copyResult() {
    if (!result) return;
    const content=(example?'EXAMPLE / 示例\n':'')+resultClipboard(result,zh);
    try {await navigator.clipboard.writeText(content);setCopied(true);setManualCopy('');window.setTimeout(()=>setCopied(false),1600);}catch{setCopied(false);setManualCopy(content);}

  }

  if (calculatorId === "colony-counter") {
    return <div className="space-y-4"><StorageRecovery message={persistenceWarning} onRetry={retry} zh={zh}/><ColonyCounter definition={definition} zh={zh} state={state} update={update} /></div>;
  }

  const presets = state?.presets.filter((item) => item.calculatorId === calculatorId) ?? [];
  const history = state?.history.filter((item) => item.calculatorId === calculatorId).slice(0, 5) ?? [];
  const favorite = state?.favoritesConfigured ? state.favorites.includes(calculatorId) : defaultTasks.includes(calculatorId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {!embedded ? <Link href="/tools/calculator" className="focus-ring flex min-h-11 w-9 shrink-0 items-center justify-center rounded-[var(--ln-radius-control-lg)] border border-hairline text-muted hover:bg-warm hover:text-ink" aria-label={zh ? "返回计算器" : "Back to calculators"}><ArrowLeft className="h-4 w-4" /></Link> : null}
          <div className="min-w-0"><TaskIcon taskId={calculatorId}/><h1 className="font-serif text-[21px] font-medium text-ink md:text-[24px]">{zh ? definition.nameZh : definition.name}</h1><p className="text-xs leading-5 text-muted">{zh ? definition.shortDescriptionZh : definition.shortDescription}</p></div>
        </div>
        {state && !embedded ? <button type="button" onClick={() => update(toggleFavorite({...state,favorites:state.favoritesConfigured?state.favorites:defaultTasks}, calculatorId))} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-[var(--ln-radius-control-lg)] border border-hairline px-3 text-xs font-medium text-graphite hover:bg-warm">{favorite ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}{favorite ? (zh ? "取消固定" : "Unpin") : (zh ? "固定" : "Pin")}</button> : null}
      </div>

      {['molarity','percent-solution'].includes(calculatorId)?<nav aria-label="Solution modes" className="flex gap-4 text-sm"><Link className="min-h-11 text-moss" href="/tools/calculator/molarity">摩尔浓度 / Molarity</Link><Link className="min-h-11 text-moss" href="/tools/calculator/percent-solution">百分浓度 / Percentage</Link></nav>:null}
      {['master-mix','transfection'].includes(calculatorId)?<nav aria-label="Reaction modes" className="flex gap-4 text-sm"><Link className="min-h-11 text-moss" href="/tools/calculator/master-mix">PCR / Master Mix</Link><Link className="min-h-11 text-moss" href="/tools/calculator/transfection">转染 / Transfection</Link></nav>:null}
      {calculatorId==='hemocytometer'&&result&&!example&&!historical?<Link className="block min-h-11 text-moss" href={`/tools/calculator/seeding?stockCellsPerMl=${result.outputMap.viableCellsPerMl}`}>{zh?'用此活细胞浓度铺板':'Seed using this viable-cell concentration'}</Link>:null}
      {initialInputs.experimentId&&initialInputs.experimentStepId?<div className="space-y-2 rounded-lg border border-hairline p-3"><p className="text-xs">{zh?'关联实验 / 步骤':'Linked experiment / step'}: {initialInputs.experimentId} / {initialInputs.experimentStepId}</p><a className="block min-h-11 text-moss" href={`/experiments/${encodeURIComponent(String(initialInputs.experimentId))}/run#step-${encodeURIComponent(String(initialInputs.experimentStepId))}`}>{zh?'返回实验步骤':'Return to experiment step'}</a><input className="min-h-11 w-full rounded border border-hairline px-3" aria-label="Operator" placeholder={zh?'记录人':'Recorded by'} value={operator} onChange={e=>setOperator(e.target.value)}/><button type="button" className="min-h-11 text-moss disabled:opacity-40" disabled={!result||historical||example||!operator.trim()} onClick={recordExperiment}>{zh?'记入实验':'Record in experiment'}</button><p role="status" className="text-xs">{recordStatus}</p></div>:null}
      <TaskHelp ids={[calculatorId]} zh={zh}/>{plateContext ? <div className="flex items-center gap-2 rounded-[var(--ln-radius-control-lg)] border border-info/20 bg-info-surface px-3 py-2 text-xs text-info"><FlaskConical className="h-4 w-4 shrink-0" /><span>{zh ? `来自“${plateContext.plateName}”的 ${plateContext.wellIds.length} 个孔；结果可回写到这些孔位。` : `${plateContext.wellIds.length} wells from “${plateContext.plateName}”; results can be sent back to these wells.`}</span></div> : null}
      <StorageRecovery message={persistenceWarning} onRetry={retry} zh={zh}/>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.72fr)]">
        <Card>
          <CardHeader title={zh ? "输入" : "Inputs"} action={<button type="button" onClick={() => { edit(defaults,false); }} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-moss"><RotateCcw className="h-3.5 w-3.5" />{zh ? "重置" : "Reset"}</button>} />
          <CardBody>
            <form onSubmit={runCalculation} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {definition.fields.filter(field=>isFieldVisible(calculatorId,field.key,inputs)&&!(calculatorId==='wb-loading'&&Array.isArray(inputs.samples)&&field.key==='sampleConcentrationUgUl')).map((field) => <div key={field.key} className={`min-w-0 ${field.unit&&compatibleUnits(field.unit).length>1?"grid max-w-[18rem] grid-cols-[minmax(0,1fr)_auto] items-end gap-1.5":""}`}>{['points','standards'].includes(field.key)&&field.type==='textarea'?<CurveEditor zh={zh} value={String(inputs[field.key]??'')} onChange={value=>edit({...inputs,[field.key]:value})}/>:<FieldControl field={{...field,unit:field.unit&&compatibleUnits(field.unit).length>1?"":String(inputs[`${field.key}Unit`]??field.unit??"")}} zh={zh} value={inputs[field.key]??''} onChange={(value)=>edit({...inputs,[field.key]:value})}/>} {field.unit&&compatibleUnits(field.unit).length>1?<select aria-label={`${zh?field.labelZh:field.label} ${zh?'单位':'unit'}`} className="min-h-11 min-w-0 max-w-[105px] rounded-lg border border-hairline px-2 text-sm" value={String(inputs[`${field.key}Unit`]??field.unit)} onChange={event=>{try { const previous=String(inputs[`${field.key}Unit`]??field.unit);const value=String(inputs[field.key]??'').trim();edit({...inputs,[field.key]:value?String(convert(parseScalar(value),previous,event.target.value)):'',[`${field.key}Unit`]:event.target.value});}catch{setError(zh?'请先完成数值输入，再切换单位。':'Complete the number before changing units.');}}}>{(['dilution','reagent-dosing','fold-dilution'].includes(calculatorId)&&['stockConcentration','targetConcentration','initialConcentration'].includes(field.key)?Object.keys(units).filter(unit=>['molar-concentration','mass-concentration'].includes(units[unit].dimension)):compatibleUnits(field.unit)).map(unit=><option key={unit}>{unit}</option>)}</select>:null}</div>)}
              </div>
              {['media-recipe','buffer-recipe'].includes(calculatorId)?<RecipeEditor zh={zh} rows={Array.isArray(inputs.recipeRows)?inputs.recipeRows as RecipeRow[]:String(inputs.components??'').split(/\r?\n/).filter(Boolean).map(line=>{const [name,amount,unit]=line.split(',');return{name,amount,unit};})} onChange={recipeRows=>edit({...inputs,recipeRows})}/>:null}
              {calculatorId==='master-mix'&&!Array.isArray(inputs.groups)?<MixEditor zh={zh} rows={Array.isArray(inputs.rows)?inputs.rows as MixRow[]:[]} onChange={rows=>edit({...inputs,rows})}/>:null}
              {calculatorId==='master-mix'?<><button className="min-h-11 text-sm text-moss" type="button" onClick={()=>{const next={...inputs};if(Array.isArray(next.groups))delete next.groups;else next.groups=[];edit(next);}}>{zh?'切换单组 / 多组独立配液':'Switch single / separate mix groups'}</button>{Array.isArray(inputs.groups)?<ReactionGroups zh={zh} groups={inputs.groups as ReactionGroup[]} onChange={groups=>edit({...inputs,groups})}/>:null}</>:null}
              {calculatorId==='normalization'||(calculatorId==='wb-loading'&&Array.isArray(inputs.samples))?<SampleEditor zh={zh} unit={calculatorId==='normalization'?'ng/µL':'µg/µL'} rows={Array.isArray(inputs.samples)?inputs.samples as SampleRow[]:[]} onChange={samples=>edit({...inputs,samples})}/>:null}
              {calculatorId==='wb-loading'?<button className="min-h-11 text-sm text-moss" type="button" onClick={()=>{const next={...inputs};if(Array.isArray(next.samples))delete next.samples;else next.samples=[];edit(next);}}>{zh?'切换单样本 / 批量':'Switch single / batch'}</button>:null}
              <div className="flex flex-wrap gap-3"><button type="button" className="min-h-11 text-sm text-moss" onClick={()=>edit({...defaults,...definition.exampleInputs},true)}>{zh?'载入示例':'Load example'}</button>{state?.drafts[calculatorId]?<button className="min-h-11 text-sm text-moss" type="button" onClick={()=>edit(state.drafts[calculatorId].inputs,state.drafts[calculatorId].example)}>{zh?'恢复上次草稿':'Restore draft'}</button>:null}</div>
              {example?<p role="status" className="text-sm text-warning">{zh?'示例：不可写入正式记录。请重置后输入实验参数。':'Example: cannot save a formal record. Reset and enter experimental inputs.'}</p>:null}
              <details><summary className="min-h-11 cursor-pointer text-xs">{zh?'移液设备与舍入（可选）':'Pipetting equipment and rounding (optional)'}</summary><div className="grid gap-2 sm:grid-cols-2">{[['pipetteMinimumUl','设备下限µL','Equipment minimum µL'],['pipetteStepUl','移液步进µL','Pipetting increment µL']].map(([key,labelZh,label])=><label key={key} className="text-xs">{zh?labelZh:label}<input className="mt-1 min-h-11 w-full rounded border border-hairline px-2" value={String(inputs[key]??'')} onChange={e=>edit({...inputs,[key]:e.target.value})}/></label>)}</div></details>
              {error ? <p role="alert" className="rounded-[var(--ln-radius-control-lg)] border border-danger/25 bg-danger-surface px-3 py-2 text-xs leading-5 text-danger">{error}</p> : null}
              <button type="submit" className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--ln-radius-control-lg)] bg-moss px-4 text-sm font-semibold text-warm sm:w-auto"><Calculator className="h-4 w-4" />{zh ? "计算" : "Calculate"}</button>
            </form>
          </CardBody>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title={zh ? "结果" : "Result"} action={result ? <button type="button" onClick={copyResult} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-moss">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? (zh ? "已复制" : "Copied") : (zh ? "复制" : "Copy")}</button> : undefined} />
            <CardBody>
              {manualCopy&&result?<label className="block text-xs">{zh?'剪贴板不可用，请手动复制':'Clipboard unavailable; copy manually'}<textarea className="w-full" readOnly value={manualCopy}/></label>:null}
              {result ? <><p className="text-xs text-muted">{historical?'原始快照；单位转换仅临时显示 / Original snapshot; unit conversion is temporary':''}</p>{historical?<button type="button" className="min-h-11 text-moss" onClick={()=>{const old=state?.history.find(item=>item.id===sourceRecord);if(old)restore(old.inputs,old.methodVersion);}}>{zh?'用当前方法重算（新记录）':'Recalculate with current method (new record)'}</button>:null}<ResultPanel result={result} zh={zh} onUnit={(key,unit)=>{const displayUnits={...result.displayUnits,[key]:unit};if(historical){setResult({...result,displayUnits});return;}const next={...inputs,__displayUnits:displayUnits};setInputs(next);setResult({...result,displayUnits,rawInputs:next});mutationId.current=null;if(state)update(saveDraft(state,calculatorId,next,example),200);}} onSave={saveResult} disabled={historical||example} onApplyToPlate={plateContext&&!historical&&!example ? applyToPlate : undefined} /></> : <p className="py-5 text-center text-sm text-muted">{zh ? "填写输入并运行计算。" : "Enter values and run the calculation."}</p>}
            </CardBody>
          </Card>
          <details className="rounded-lg border border-hairline p-3"><summary className="min-h-11 cursor-pointer text-sm">{zh?'方法与假设':'Method and assumptions'}</summary><p className="text-xs leading-5 text-graphite">{zh?definition.methodZh:definition.method}</p><p className="mt-2 text-xs text-muted">{definition.methodVersion}</p></details>
        </div>
      </div>

      <OfflineCalculator zh={zh}/>
      <details><summary className="min-h-11 cursor-pointer text-sm">{zh?"常用配方与计算记录":"Recipes and calculation records"}</summary><div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title={zh ? "预设" : "Presets"} /><CardBody className="space-y-3"><div className="flex gap-2"><input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder={zh ? "预设名称" : "Preset name"} className="min-h-11 min-w-0 flex-1 rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm/30 px-3 text-sm outline-none focus:border-moss" /><button type="button" onClick={savePreset} disabled={!presetName.trim()} className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-[var(--ln-radius-control-lg)] border border-hairline px-3 text-xs font-medium text-graphite disabled:opacity-40"><Save className="h-3.5 w-3.5" />{zh ? "保存" : "Save"}</button></div>{presets.length ? <div className="space-y-1">{presets.map((preset) => <div key={preset.id} className="flex items-center gap-1"><button type="button" onClick={() => { restore(preset.inputs,preset.methodVersion); }} className="min-w-0 flex-1 truncate rounded-full bg-sage-surface px-3 py-1 text-left text-xs font-medium text-moss">{preset.name}</button><button type="button" onClick={() => state && update(deletePreset(state, preset.id))} className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-danger-surface hover:text-danger" aria-label={zh ? "删除预设" : "Delete preset"}><X className="h-3.5 w-3.5" /></button></div>)}</div> : <p className="text-xs text-muted">{zh ? "尚无预设。" : "No presets yet."}</p>}</CardBody></Card>
        <Card><CardHeader title={zh ? "最近结果" : "Recent results"} /><CardBody className="space-y-2">{history.length ? history.map((item) => <button type="button" key={item.id} onClick={() => { setHistorical(true);setSourceRecord(item.id);setResult(restoreCalculatorResult(item)); }} className="flex w-full items-center justify-between gap-3 rounded-[var(--ln-radius-control-md)] px-2 py-1.5 text-left text-xs hover:bg-warm"><span className="truncate text-graphite">{new Date(item.createdAt).toLocaleString(locale)}</span><History className="h-3.5 w-3.5 shrink-0 text-muted" /></button>) : <p className="text-xs text-muted">{zh ? "保存后的结果会显示在这里。" : "Saved results appear here."}</p>}</CardBody></Card>
      </div></details>
    </div>
  );
}

function FieldControl({ field, zh, value, onChange }: { field: CalculatorDefinition["fields"][number]; zh: boolean; value: unknown; onChange: (value: string | number) => void }) {
  const label = zh ? field.labelZh : field.label;
  const shared = "mt-1.5 w-full rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm/30 px-3 text-sm text-ink outline-none transition focus:border-moss focus:bg-surface";
  return <label className={field.type === "textarea" ? "sm:col-span-2" : ""}><span className="flex items-center justify-between gap-2 text-xs font-medium text-graphite"><span>{label}</span>{field.unit && field.unit !== "integer" ? <span className="font-mono text-[10px] font-normal text-muted">{field.unit}</span> : null}</span>{field.type === "select" ? <select value={String(value??"")} onChange={(event) => onChange(event.target.value)} className={`${shared} min-h-11`}>{field.options?.map((option) => <option key={option.value} value={option.value}>{zh ? option.labelZh : option.label}</option>)}</select> : field.type === "textarea" ? <textarea rows={5} value={String(value??"")} onChange={(event) => onChange(event.target.value)} className={`${shared} py-2 font-mono text-xs`} /> : <input type="text" inputMode={field.type === "number" ? "decimal" : undefined} value={String(value??"")} onChange={(event) => onChange(event.target.value)} className={`${shared} min-h-11`} />}</label>;
}



type DetectedSpot = { x: number; y: number; radius: number };
type ReviewMark = { x: number; y: number; kind: "add" | "remove" };
type ExcludedRegion = { x: number; y: number; radius: number };

function ColonyCounter({ definition, zh, state, update }: { definition: CalculatorDefinition; zh: boolean; state: CalculatorState | null; update: (state: CalculatorState) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [threshold, setThreshold] = useState(125);
  const [minimumArea, setMinimumArea] = useState(20);
  const [spots, setSpots] = useState<DetectedSpot[]>([]);
  const [reviewMarks, setReviewMarks] = useState<ReviewMark[]>([]);
  const [excludedRegions, setExcludedRegions] = useState<ExcludedRegion[]>([]);
  const [manualAdjustment, setManualAdjustment] = useState(0);
  const [mode, setMode] = useState<"add" | "remove" | "exclude">("add");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function redraw(nextSpots = spots, nextMarks = reviewMarks, nextExcluded = excludedRegions) {
    const canvas = canvasRef.current, image = imageRef.current;
    if (!canvas || !image) return;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#6e7f68";
    context.lineWidth = 2;
    nextSpots.forEach((spot) => { context.beginPath(); context.arc(spot.x, spot.y, Math.max(4, spot.radius), 0, Math.PI * 2); context.stroke(); });
    nextMarks.forEach((mark) => {
      context.strokeStyle = mark.kind === "add" ? "#315f9b" : "#9a4650";
      context.lineWidth = 3;
      context.beginPath(); context.arc(mark.x, mark.y, 9, 0, Math.PI * 2); context.stroke();
      context.beginPath();
      if (mark.kind === "add") { context.moveTo(mark.x - 5, mark.y); context.lineTo(mark.x + 5, mark.y); context.moveTo(mark.x, mark.y - 5); context.lineTo(mark.x, mark.y + 5); }
      else { context.moveTo(mark.x - 5, mark.y - 5); context.lineTo(mark.x + 5, mark.y + 5); context.moveTo(mark.x + 5, mark.y - 5); context.lineTo(mark.x - 5, mark.y + 5); }
      context.stroke();
    });
    context.setLineDash([6, 4]);
    context.strokeStyle = "#9a6a25";
    nextExcluded.forEach((region) => { context.beginPath(); context.arc(region.x, region.y, region.radius, 0, Math.PI * 2); context.stroke(); });
    context.setLineDash([]);
  }

  function detect() {
    const canvas = canvasRef.current, image = imageRef.current;
    if (!canvas || !image) return;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const width = canvas.width, height = canvas.height;
    const mask = new Uint8Array(width * height);
    for (let index = 0; index < mask.length; index += 1) {
      const offset = index * 4;
      const gray = pixels.data[offset] * 0.299 + pixels.data[offset + 1] * 0.587 + pixels.data[offset + 2] * 0.114;
      mask[index] = gray < threshold ? 1 : 0;
    }
    const visited = new Uint8Array(mask.length), detected: DetectedSpot[] = [];
    for (let start = 0; start < mask.length; start += 1) {
      if (!mask[start] || visited[start]) continue;
      const queue = [start]; visited[start] = 1;
      let head = 0, area = 0, sumX = 0, sumY = 0;
      while (head < queue.length) {
        const current = queue[head++], x = current % width, y = Math.floor(current / width);
        area += 1; sumX += x; sumY += y;
        for (const neighbor of [current - 1, current + 1, current - width, current + width]) {
          if (neighbor >= 0 && neighbor < mask.length && !visited[neighbor] && mask[neighbor] && Math.abs((neighbor % width) - x) <= 1) { visited[neighbor] = 1; queue.push(neighbor); }
        }
      }
      if (area >= minimumArea && area <= width * height * 0.08) detected.push({ x: sumX / area, y: sumY / area, radius: Math.sqrt(area / Math.PI) });
    }
    setSpots(detected); setReviewMarks([]); setExcludedRegions([]); setManualAdjustment(0); setConfirmed(false); redraw(detected, [], []);
  }

  function loadImage(file: File | undefined) {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file), image = new Image();
    image.onload = () => {
      imageRef.current = image;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = Math.min(1, 900 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      redraw([]);
    };
    image.src = url; setPreviewUrl(url); setSpots([]); setReviewMarks([]); setExcludedRegions([]); setManualAdjustment(0); setConfirmed(false);
  }

  function handleCanvasClick(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!imageRef.current) return;
    const canvas = event.currentTarget, rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * canvas.width / rect.width, y = (event.clientY - rect.top) * canvas.height / rect.height;
    if (mode === "add" || mode === "remove") {
      const nextMarks = [...reviewMarks, { x, y, kind: mode }];
      setReviewMarks(nextMarks);
      setManualAdjustment((value) => value + (mode === "add" ? 1 : -1));
      redraw(spots, nextMarks, excludedRegions);
    }
    if (mode === "exclude") {
      const region = { x, y, radius: 32 };
      const nextExcluded = [...excludedRegions, region];
      const nextSpots = spots.filter((spot) => Math.hypot(spot.x - x, spot.y - y) > region.radius);
      setExcludedRegions(nextExcluded); setSpots(nextSpots); redraw(nextSpots, reviewMarks, nextExcluded);
    }
    setConfirmed(false);
  }

  function saveCount() {
    if (!state || !confirmed) return;
    const result = calculate({ calculatorId: definition.id, inputs: { automaticCount: spots.length, manualAdjustment } });
    update(addHistoryEntry(state, { id: newClientMutationId(), calculatorId: definition.id, calculatorName: definition.name, calculatorNameZh: definition.nameZh, createdAt: new Date().toISOString(), methodVersion: result.methodVersion, inputs: { automaticCount: spots.length, manualAdjustment, threshold, minimumArea }, inputUnits: {}, outputs: result.outputs, warnings: result.warnings }));
  }

  const finalCount = Math.max(0, spots.length + manualAdjustment);
  return <div className="space-y-4"><div className="flex items-center gap-3"><Link href="/tools/calculator" className="focus-ring flex min-h-11 w-9 items-center justify-center rounded-[var(--ln-radius-control-lg)] border border-hairline text-muted"><ArrowLeft className="h-4 w-4" /></Link><div><h1 className="font-serif text-[21px] font-medium text-ink md:text-[24px]">{zh ? definition.nameZh : definition.name}</h1><p className="text-xs text-muted">{zh ? "照片仅在当前浏览器会话中参与计数，不进入结果、历史或导出。" : "The photo is used only in this browser session and never enters results, history, or exports."}</p></div></div><div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]"><Card><CardHeader title={zh ? "图像与识别标记" : "Image & detection overlay"} /><CardBody><div className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-[var(--ln-radius-panel-inner)] border border-dashed border-hairline bg-warm/35">{previewUrl ? <canvas ref={canvasRef} onClick={handleCanvasClick} className="max-h-[68vh] max-w-full cursor-crosshair object-contain" /> : <label className="flex cursor-pointer flex-col items-center gap-3 px-6 py-12 text-center"><Upload className="h-7 w-7 text-muted" /><span className="text-sm font-medium text-graphite">{zh ? "上传平皿或噬菌斑照片" : "Upload a plate or plaque image"}</span><span className="text-xs leading-5 text-muted">{zh ? "JPG / PNG；图像不会保存" : "JPG / PNG; image is not persisted"}</span><input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => loadImage(event.target.files?.[0])} /></label>}</div>{previewUrl ? <div className="mt-3 flex flex-wrap gap-2"><label className="focus-ring inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--ln-radius-control-lg)] border border-hairline px-3 text-xs font-medium"><Upload className="h-3.5 w-3.5" />{zh ? "更换照片" : "Replace image"}<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => loadImage(event.target.files?.[0])} /></label><button type="button" onClick={detect} className="focus-ring min-h-11 rounded-[var(--ln-radius-control-lg)] bg-moss px-3 text-xs font-semibold text-warm">{zh ? "重新识别" : "Detect again"}</button></div> : null}</CardBody></Card><div className="space-y-4"><Card><CardHeader title={zh ? "识别设置" : "Detection settings"} /><CardBody className="space-y-4"><label className="block text-xs font-medium text-graphite">{zh ? "灰度阈值" : "Threshold"}<input type="range" min="20" max="235" value={threshold} onChange={(event) => { setThreshold(Number(event.target.value)); setConfirmed(false); }} className="mt-2 w-full accent-[var(--color-moss)]" /><span className="font-mono text-[10px] text-muted">{threshold}</span></label><label className="block text-xs font-medium text-graphite">{zh ? "最小区域" : "Minimum area"}<input type="number" min="2" value={minimumArea} onChange={(event) => { setMinimumArea(Number(event.target.value)); setConfirmed(false); }} className="mt-1.5 min-h-11 w-full rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm/30 px-3" /></label><div className="grid grid-cols-3 gap-1">{(["add", "remove", "exclude"] as const).map((item) => <button key={item} type="button" onClick={() => setMode(item)} className={`h-8 rounded-[var(--ln-radius-control-md)] text-[11px] font-medium ${mode === item ? "bg-sage-surface text-moss" : "border border-hairline text-muted"}`}>{zh ? { add: "补加", remove: "扣除", exclude: "排除区" }[item] : item}</button>)}</div><p className="text-[11px] leading-5 text-muted">{zh ? "选择模式后点击图像：补加/扣除计数，或排除局部识别区域。" : "Choose a mode, then click the image to add/remove a count or exclude a local region."}</p></CardBody></Card><Card><CardHeader title={zh ? "计数结果" : "Count"} /><CardBody className="space-y-3"><div className="grid grid-cols-2 gap-2"><div className="rounded-[var(--ln-radius-control-lg)] bg-warm p-3"><p className="text-[10px] text-muted">{zh ? "自动识别" : "Detected"}</p><p className="mt-1 font-mono text-xl font-semibold text-ink">{spots.length}</p></div><div className="rounded-[var(--ln-radius-control-lg)] bg-sage-surface p-3"><p className="text-[10px] text-moss">{zh ? "复核后" : "Reviewed"}</p><p className="mt-1 font-mono text-xl font-semibold text-moss">{finalCount}</p></div></div><p className="text-xs text-muted">{zh ? "人工调整" : "Manual adjustment"}: {manualAdjustment > 0 ? "+" : ""}{manualAdjustment}</p><button type="button" disabled={!previewUrl || spots.length + manualAdjustment < 0} onClick={() => setConfirmed(true)} className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--ln-radius-control-lg)] bg-moss text-xs font-semibold text-warm disabled:opacity-40"><Check className="h-3.5 w-3.5" />{confirmed ? (zh ? "已确认" : "Confirmed") : (zh ? "确认计数" : "Confirm count")}</button><button type="button" disabled={!confirmed || !state} onClick={saveCount} className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--ln-radius-control-lg)] border border-moss text-xs font-semibold text-moss disabled:opacity-40"><Save className="h-3.5 w-3.5" />{zh ? "仅保存数字与参数" : "Save numbers & settings only"}</button></CardBody></Card></div></div></div>;
}
