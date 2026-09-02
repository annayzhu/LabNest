"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Calculator, Check, Clock3, Copy, FlaskConical, History, Pin, PinOff, RotateCcw, Save, Search, Trash2, Upload, X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useModalDialog } from "@/components/ui/ModalDialogProvider";
import { calculate, getCalculatorCatalog, getCalculatorDefinition, type CalculatorDefinition, type CalculatorResult } from "@/lib/calculators/calculator-engine";
import { addHistoryEntry, addPreset, clearHistory, deleteHistoryEntry, deletePreset, getCalculatorStorageIssue, loadCalculatorState, saveCalculatorState, toggleFavorite, type CalculatorState } from "@/lib/calculators/calculator-storage";

const categoryLabels = {
  "cell-culture": ["Cell culture", "细胞培养"],
  solutions: ["Solutions & dosing", "溶液与加药"],
  "molecular-biology": ["Molecular biology", "分子生物学"],
  "virology-microbiology": ["Virology & microbiology", "病毒与微生物"],
  general: ["General", "通用工具"],
} as const;

function useCalculatorState() {
  const [state, setState] = useState<CalculatorState | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState("");
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setState(loadCalculatorState());
      setPersistenceWarning(getCalculatorStorageIssue());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const update = (next: CalculatorState) => {
    setState(next);
    saveCalculatorState(next);
    setPersistenceWarning(getCalculatorStorageIssue());
  };
  return { state, update, persistenceWarning };
}

export function CalculatorCatalog() {
  const { locale } = useI18n();
  const zh = locale === "zh";
  const [query, setQuery] = useState("");
  const { state, update, persistenceWarning } = useCalculatorState();
  const dialog = useModalDialog();
  const catalog = getCalculatorCatalog();
  const normalized = query.trim().toLocaleLowerCase();
  const filtered = catalog.filter((tool) => !normalized || [tool.name, tool.nameZh, tool.shortDescription, tool.shortDescriptionZh, ...tool.aliases].join(" ").toLocaleLowerCase().includes(normalized));
  const favoriteTools = state ? catalog.filter((tool) => state.favorites.includes(tool.id)) : [];
  const recentIds = state ? [...new Set(state.history.map((item) => item.calculatorId))].slice(0, 5) : [];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card>
          <CardBody className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--ln-radius-panel-inner)] bg-sage-surface text-moss"><Calculator className="h-5 w-5" aria-hidden /></span>
              <div className="min-w-0">
                <h2 className="font-serif text-xl font-medium text-ink">{zh ? "实验计算器" : "Experimental Calculator"}</h2>
                <p className="mt-0.5 text-sm leading-5 text-muted">{zh ? "31 个浏览器本地计算模块；结果由你确认后才保存。" : "31 browser-local modules. Results are saved only after you confirm."}</p>
              </div>
            </div>
            <label className="mt-4 flex h-10 items-center gap-2 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-warm/45 px-3 focus-within:border-moss">
              <Search className="h-4 w-4 text-muted" aria-hidden />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted" placeholder={zh ? "搜索中文、英文或别名…" : "Search name, Chinese, or alias…"} />
              {query ? <button type="button" onClick={() => setQuery("")} className="text-muted hover:text-ink" aria-label={zh ? "清空搜索" : "Clear search"}><X className="h-4 w-4" /></button> : null}
            </label>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={zh ? "常用与最近" : "Pinned & recent"} />
          <CardBody className="space-y-2 p-3">
            {favoriteTools.length || recentIds.length ? (
              <>
                {favoriteTools.slice(0, 4).map((tool) => <CompactToolLink key={`favorite-${tool.id}`} tool={tool} zh={zh} marker={<Pin className="h-3.5 w-3.5" />} />)}
                {!favoriteTools.length && recentIds.map((id) => catalog.find((tool) => tool.id === id)).filter(Boolean).map((tool) => <CompactToolLink key={`recent-${tool!.id}`} tool={tool!} zh={zh} marker={<Clock3 className="h-3.5 w-3.5" />} />)}
              </>
            ) : <p className="px-1 py-2 text-xs leading-5 text-muted">{zh ? "固定常用工具或完成一次计算后，这里会显示快捷入口。" : "Pin a tool or complete a calculation to create shortcuts here."}</p>}
          </CardBody>
        </Card>
      </div>

      {persistenceWarning ? <p role="status" className="rounded-[var(--ln-radius-control-lg)] border border-warning/25 bg-warning-surface px-3 py-2 text-xs text-warning">{zh ? "浏览器存储不可用或空间不足；本次更改仅保留在当前页面。" : persistenceWarning}</p> : null}

      {Object.entries(categoryLabels).map(([category, labels]) => {
        const tools = filtered.filter((tool) => tool.category === category);
        if (!tools.length) return null;
        return (
          <Card key={category}>
            <CardHeader title={zh ? labels[1] : labels[0]} action={<span className="font-mono text-[11px] text-muted">{tools.length}</span>} />
            <CardBody className="divide-y divide-hairline p-0">
              {tools.map((tool) => {
                const favorite = state?.favorites.includes(tool.id) ?? false;
                return (
                  <div key={tool.id} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 transition hover:bg-warm/45">
                    <Link href={`/tools/calculator/${tool.id}`} className="focus-ring min-w-0 rounded-[var(--ln-radius-control-sm)]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink group-hover:text-moss">{zh ? tool.nameZh : tool.name}</span>
                        {tool.plateAware ? <span className="rounded-full bg-info-surface px-2 py-0.5 text-[10px] font-medium text-info">{zh ? "板感知" : "Plate-aware"}</span> : null}
                      </div>
                      <p className="mt-0.5 text-xs leading-5 text-muted">{zh ? tool.shortDescriptionZh : tool.shortDescription}</p>
                    </Link>
                    {state ? <button type="button" onClick={() => update(toggleFavorite(state, tool.id))} className="focus-ring flex h-8 w-8 items-center justify-center rounded-[var(--ln-radius-control-md)] text-muted hover:bg-sage-surface hover:text-moss" aria-label={favorite ? (zh ? "取消固定" : "Unpin") : (zh ? "固定工具" : "Pin tool")}>{favorite ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}</button> : null}
                  </div>
                );
              })}
            </CardBody>
          </Card>
        );
      })}
      {!filtered.length ? <Card><CardBody><p className="text-sm text-muted">{zh ? "没有找到匹配的计算工具。" : "No calculators match this search."}</p></CardBody></Card> : null}
      {state?.history.length ? <Card><CardHeader title={zh ? "本机计算历史" : "Local calculation history"} action={<button type="button" onClick={async () => { if (await dialog.confirm({ title: zh ? "清空全部计算历史？" : "Clear all calculation history?", description: zh ? "此操作无法撤销。" : "This action cannot be undone.", confirmLabel: zh ? "清空" : "Clear history", cancelLabel: zh ? "取消" : "Cancel", tone: "destructive" })) update(clearHistory(state)); }} className="text-xs font-medium text-muted hover:text-danger">{zh ? "清空" : "Clear"}</button>} /><CardBody className="divide-y divide-hairline p-0">{state.history.slice(0, 10).map((item) => <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5"><Link href={`/tools/calculator/${item.calculatorId}`} className="min-w-0"><p className="truncate text-xs font-semibold text-graphite">{zh ? item.calculatorNameZh : item.calculatorName}</p><p className="mt-0.5 truncate font-mono text-[10px] text-muted">{new Date(item.createdAt).toLocaleString(locale)} · {item.methodVersion}</p></Link><button type="button" onClick={() => update(deleteHistoryEntry(state, item.id))} className="focus-ring flex h-8 w-8 items-center justify-center rounded-[var(--ln-radius-control-md)] text-muted hover:bg-danger-surface hover:text-danger" aria-label={zh ? "删除此条历史" : "Delete history entry"}><Trash2 className="h-3.5 w-3.5" /></button></div>)}</CardBody></Card> : null}
    </div>
  );
}

function CompactToolLink({ tool, zh, marker }: { tool: CalculatorDefinition; zh: boolean; marker: React.ReactNode }) {
  return <Link href={`/tools/calculator/${tool.id}`} className="focus-ring flex items-center gap-2 rounded-[var(--ln-radius-control-md)] px-2 py-1.5 text-xs font-medium text-graphite hover:bg-warm hover:text-moss"><span className="text-muted">{marker}</span><span className="truncate">{zh ? tool.nameZh : tool.name}</span></Link>;
}

type PlateContext = { workspaceId: string; plateId: string; plateName: string; plateSize: number; wellIds: string[] };

export function CalculatorWorkbench({ calculatorId, initialInputs = {}, plateContext, embedded = false, embeddedLocale }: { calculatorId: string; initialInputs?: Record<string, string | number>; plateContext?: PlateContext; embedded?: boolean; embeddedLocale?: "zh" | "en" }) {
  const definition = getCalculatorDefinition(calculatorId);
  const { locale: appLocale } = useI18n();
  const locale = embeddedLocale ?? appLocale;
  const zh = locale === "zh";
  const { state, update, persistenceWarning } = useCalculatorState();
  const defaults = useMemo(() => Object.fromEntries(definition.fields.map((field) => [field.key, initialInputs[field.key] ?? field.defaultValue ?? ""])), [definition, initialInputs]);
  const [inputs, setInputs] = useState<Record<string, unknown>>(defaults);
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [presetName, setPresetName] = useState("");

  function runCalculation(event?: FormEvent) {
    event?.preventDefault();
    try {
      const next = calculate({ calculatorId, inputs });
      setResult(next);
      setError("");
    } catch (calculationError) {
      setResult(null);
      setError(calculationError instanceof Error ? calculationError.message : "Calculation failed.");
    }
  }

  function saveResult() {
    if (!state || !result) return;
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
    update(addHistoryEntry(state, { id, calculatorId, calculatorName: definition.name, calculatorNameZh: definition.nameZh, createdAt: new Date().toISOString(), methodVersion: result.methodVersion, inputs, inputUnits: Object.fromEntries(definition.fields.filter((field) => field.unit && field.unit !== "integer").map((field) => [field.key, field.unit!])), outputs: result.outputs, warnings: result.warnings }));
  }

  function savePreset() {
    if (!state || !presetName.trim()) return;
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
    update(addPreset(state, { id, calculatorId, name: presetName.trim(), createdAt: new Date().toISOString(), inputs }));
    setPresetName("");
  }

  function applyToPlate() {
    if (!result || !plateContext) return;
    const payload = { type: "labnest:calculator-result", calculatorId, calculatorName: zh ? definition.nameZh : definition.name, plateContext, inputs, outputs: result.outputs, table: result.table, methodVersion: result.methodVersion };
    if (window.opener) {
      window.opener.postMessage(payload, window.location.origin);
      window.close();
      return;
    }
    if (window.parent !== window) window.parent.postMessage(payload, window.location.origin);
  }

  async function copyResult() {
    if (!result) return;
    const content = result.outputs.map((item) => `${zh ? item.labelZh : item.label}: ${item.value}${item.unit ? ` ${item.unit}` : ""}`).join("\n");
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (calculatorId === "colony-counter") {
    return <div className="space-y-4">{persistenceWarning ? <p role="status" className="rounded-[var(--ln-radius-control-lg)] border border-warning/25 bg-warning-surface px-3 py-2 text-xs text-warning">{zh ? "浏览器存储不可用或空间不足；本次更改仅保留在当前页面。" : persistenceWarning}</p> : null}<ColonyCounter definition={definition} zh={zh} state={state} update={update} /></div>;
  }

  const presets = state?.presets.filter((item) => item.calculatorId === calculatorId) ?? [];
  const history = state?.history.filter((item) => item.calculatorId === calculatorId).slice(0, 5) ?? [];
  const favorite = state?.favorites.includes(calculatorId) ?? false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {!embedded ? <Link href="/tools/calculator" className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ln-radius-control-lg)] border border-hairline text-muted hover:bg-warm hover:text-ink" aria-label={zh ? "返回计算器" : "Back to calculators"}><ArrowLeft className="h-4 w-4" /></Link> : null}
          <div className="min-w-0"><h1 className="font-serif text-[21px] font-medium text-ink md:text-[24px]">{zh ? definition.nameZh : definition.name}</h1><p className="text-xs leading-5 text-muted">{zh ? definition.shortDescriptionZh : definition.shortDescription}</p></div>
        </div>
        {state && !embedded ? <button type="button" onClick={() => update(toggleFavorite(state, calculatorId))} className="focus-ring inline-flex h-9 items-center gap-2 rounded-[var(--ln-radius-control-lg)] border border-hairline px-3 text-xs font-medium text-graphite hover:bg-warm">{favorite ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}{favorite ? (zh ? "取消固定" : "Unpin") : (zh ? "固定" : "Pin")}</button> : null}
      </div>

      {plateContext ? <div className="flex items-center gap-2 rounded-[var(--ln-radius-control-lg)] border border-info/20 bg-info-surface px-3 py-2 text-xs text-info"><FlaskConical className="h-4 w-4 shrink-0" /><span>{zh ? `来自“${plateContext.plateName}”的 ${plateContext.wellIds.length} 个孔；结果可回写到这些孔位。` : `${plateContext.wellIds.length} wells from “${plateContext.plateName}”; results can be sent back to these wells.`}</span></div> : null}
      {persistenceWarning ? <p role="status" className="rounded-[var(--ln-radius-control-lg)] border border-warning/25 bg-warning-surface px-3 py-2 text-xs text-warning">{zh ? "浏览器存储不可用或空间不足；本次更改仅保留在当前页面。" : persistenceWarning}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.72fr)]">
        <Card>
          <CardHeader title={zh ? "输入" : "Inputs"} action={<button type="button" onClick={() => { setInputs(defaults); setResult(null); setError(""); }} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-moss"><RotateCcw className="h-3.5 w-3.5" />{zh ? "重置" : "Reset"}</button>} />
          <CardBody>
            <form onSubmit={runCalculation} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {definition.fields.map((field) => <FieldControl key={field.key} field={field} zh={zh} value={inputs[field.key]} onChange={(value) => { setInputs((current) => ({ ...current, [field.key]: value })); setResult(null); setError(""); }} />)}
              </div>
              {error ? <p role="alert" className="rounded-[var(--ln-radius-control-lg)] border border-danger/25 bg-danger-surface px-3 py-2 text-xs leading-5 text-danger">{error}</p> : null}
              <button type="submit" className="focus-ring inline-flex h-10 w-full items-center justify-center gap-2 rounded-[var(--ln-radius-control-lg)] bg-moss px-4 text-sm font-semibold text-warm sm:w-auto"><Calculator className="h-4 w-4" />{zh ? "计算" : "Calculate"}</button>
            </form>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title={zh ? "结果" : "Result"} action={result ? <button type="button" onClick={copyResult} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-moss">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? (zh ? "已复制" : "Copied") : (zh ? "复制" : "Copy")}</button> : undefined} />
            <CardBody>
              {result ? <ResultPanel result={result} zh={zh} onSave={saveResult} onApplyToPlate={plateContext ? applyToPlate : undefined} /> : <p className="py-5 text-center text-sm text-muted">{zh ? "填写输入并运行计算。" : "Enter values and run the calculation."}</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={zh ? "方法" : "Method"} />
            <CardBody><p className="text-xs leading-5 text-graphite">{zh ? definition.methodZh : definition.method}</p><p className="mt-2 font-mono text-[10px] text-muted">{definition.methodVersion}</p></CardBody>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title={zh ? "预设" : "Presets"} /><CardBody className="space-y-3"><div className="flex gap-2"><input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder={zh ? "预设名称" : "Preset name"} className="h-9 min-w-0 flex-1 rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm/30 px-3 text-sm outline-none focus:border-moss" /><button type="button" onClick={savePreset} disabled={!presetName.trim()} className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-[var(--ln-radius-control-lg)] border border-hairline px-3 text-xs font-medium text-graphite disabled:opacity-40"><Save className="h-3.5 w-3.5" />{zh ? "保存" : "Save"}</button></div>{presets.length ? <div className="space-y-1">{presets.map((preset) => <div key={preset.id} className="flex items-center gap-1"><button type="button" onClick={() => { setInputs(preset.inputs); setResult(null); }} className="min-w-0 flex-1 truncate rounded-full bg-sage-surface px-3 py-1 text-left text-xs font-medium text-moss">{preset.name}</button><button type="button" onClick={() => state && update(deletePreset(state, preset.id))} className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-danger-surface hover:text-danger" aria-label={zh ? "删除预设" : "Delete preset"}><X className="h-3.5 w-3.5" /></button></div>)}</div> : <p className="text-xs text-muted">{zh ? "尚无预设。" : "No presets yet."}</p>}</CardBody></Card>
        <Card><CardHeader title={zh ? "最近结果" : "Recent results"} /><CardBody className="space-y-2">{history.length ? history.map((item) => <button type="button" key={item.id} onClick={() => { setInputs(item.inputs); setResult({ calculatorId, methodVersion: item.methodVersion, outputs: item.outputs, outputMap: Object.fromEntries(item.outputs.map((output) => [output.key, output.value])), warnings: item.warnings, notes: [] }); }} className="flex w-full items-center justify-between gap-3 rounded-[var(--ln-radius-control-md)] px-2 py-1.5 text-left text-xs hover:bg-warm"><span className="truncate text-graphite">{new Date(item.createdAt).toLocaleString(locale)}</span><History className="h-3.5 w-3.5 shrink-0 text-muted" /></button>) : <p className="text-xs text-muted">{zh ? "保存后的结果会显示在这里。" : "Saved results appear here."}</p>}</CardBody></Card>
      </div>
    </div>
  );
}

function FieldControl({ field, zh, value, onChange }: { field: CalculatorDefinition["fields"][number]; zh: boolean; value: unknown; onChange: (value: string | number) => void }) {
  const label = zh ? field.labelZh : field.label;
  const shared = "mt-1.5 w-full rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm/30 px-3 text-sm text-ink outline-none transition focus:border-moss focus:bg-surface";
  return <label className={field.type === "textarea" ? "sm:col-span-2" : ""}><span className="flex items-center justify-between gap-2 text-xs font-medium text-graphite"><span>{label}</span>{field.unit && field.unit !== "integer" ? <span className="font-mono text-[10px] font-normal text-muted">{field.unit}</span> : null}</span>{field.type === "select" ? <select value={String(value)} onChange={(event) => onChange(event.target.value)} className={`${shared} h-10`}>{field.options?.map((option) => <option key={option.value} value={option.value}>{zh ? option.labelZh : option.label}</option>)}</select> : field.type === "textarea" ? <textarea rows={5} value={String(value)} onChange={(event) => onChange(event.target.value)} className={`${shared} py-2 font-mono text-xs`} /> : <input type={field.type} value={String(value)} min={field.min} step={field.step} onChange={(event) => onChange(field.type === "number" ? event.target.valueAsNumber : event.target.value)} className={`${shared} h-10`} />}</label>;
}

function ResultPanel({ result, zh, onSave, onApplyToPlate }: { result: CalculatorResult; zh: boolean; onSave: () => void; onApplyToPlate?: () => void }) {
  return <div className="space-y-3"><dl className="divide-y divide-hairline">{result.outputs.map((output) => <div key={output.key} className="flex items-baseline justify-between gap-4 py-2 first:pt-0"><dt className="text-xs text-muted">{zh ? output.labelZh : output.label}</dt><dd className="text-right font-mono text-sm font-semibold text-ink">{typeof output.value === "number" ? output.value.toLocaleString(undefined, { maximumSignificantDigits: 8 }) : output.value}{output.unit ? <span className="ml-1 text-[10px] font-normal text-muted">{output.unit}</span> : null}</dd></div>)}</dl>{result.table?.length ? <div className="max-h-64 overflow-auto rounded-[var(--ln-radius-control-lg)] border border-hairline"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-warm"><tr>{Object.keys(result.table[0]).map((key) => <th key={key} className="px-2 py-1.5 font-medium text-graphite">{key}</th>)}</tr></thead><tbody>{result.table.map((row, index) => <tr key={index} className="border-t border-hairline">{Object.values(row).map((value, cell) => <td key={cell} className="px-2 py-1.5 font-mono text-ink">{value}</td>)}</tr>)}</tbody></table></div> : null}{result.warnings.map((warning) => <p key={warning} className="rounded-[var(--ln-radius-control-md)] bg-warning-surface px-3 py-2 text-xs leading-5 text-warning">{warning}</p>)}{result.notes.map((note) => <p key={note} className="text-[11px] leading-5 text-muted">{note}</p>)}{onApplyToPlate ? <button type="button" onClick={onApplyToPlate} className="focus-ring inline-flex h-9 w-full items-center justify-center gap-2 rounded-[var(--ln-radius-control-lg)] bg-moss px-3 text-xs font-semibold text-warm"><FlaskConical className="h-3.5 w-3.5" />{zh ? "写回所选孔位" : "Send to selected wells"}</button> : null}<button type="button" onClick={onSave} className="focus-ring inline-flex h-9 w-full items-center justify-center gap-2 rounded-[var(--ln-radius-control-lg)] border border-moss px-3 text-xs font-semibold text-moss hover:bg-sage-surface"><Save className="h-3.5 w-3.5" />{zh ? "保存到本机历史" : "Save to local history"}</button></div>;
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
    update(addHistoryEntry(state, { id: crypto.randomUUID(), calculatorId: definition.id, calculatorName: definition.name, calculatorNameZh: definition.nameZh, createdAt: new Date().toISOString(), methodVersion: result.methodVersion, inputs: { automaticCount: spots.length, manualAdjustment, threshold, minimumArea }, inputUnits: {}, outputs: result.outputs, warnings: result.warnings }));
  }

  const finalCount = Math.max(0, spots.length + manualAdjustment);
  return <div className="space-y-4"><div className="flex items-center gap-3"><Link href="/tools/calculator" className="focus-ring flex h-9 w-9 items-center justify-center rounded-[var(--ln-radius-control-lg)] border border-hairline text-muted"><ArrowLeft className="h-4 w-4" /></Link><div><h1 className="font-serif text-[21px] font-medium text-ink md:text-[24px]">{zh ? definition.nameZh : definition.name}</h1><p className="text-xs text-muted">{zh ? "照片仅在当前浏览器会话中参与计数，不进入结果、历史或导出。" : "The photo is used only in this browser session and never enters results, history, or exports."}</p></div></div><div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]"><Card><CardHeader title={zh ? "图像与识别标记" : "Image & detection overlay"} /><CardBody><div className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-[var(--ln-radius-panel-inner)] border border-dashed border-hairline bg-warm/35">{previewUrl ? <canvas ref={canvasRef} onClick={handleCanvasClick} className="max-h-[68vh] max-w-full cursor-crosshair object-contain" /> : <label className="flex cursor-pointer flex-col items-center gap-3 px-6 py-12 text-center"><Upload className="h-7 w-7 text-muted" /><span className="text-sm font-medium text-graphite">{zh ? "上传平皿或噬菌斑照片" : "Upload a plate or plaque image"}</span><span className="text-xs leading-5 text-muted">{zh ? "JPG / PNG；图像不会保存" : "JPG / PNG; image is not persisted"}</span><input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => loadImage(event.target.files?.[0])} /></label>}</div>{previewUrl ? <div className="mt-3 flex flex-wrap gap-2"><label className="focus-ring inline-flex h-9 cursor-pointer items-center gap-2 rounded-[var(--ln-radius-control-lg)] border border-hairline px-3 text-xs font-medium"><Upload className="h-3.5 w-3.5" />{zh ? "更换照片" : "Replace image"}<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => loadImage(event.target.files?.[0])} /></label><button type="button" onClick={detect} className="focus-ring h-9 rounded-[var(--ln-radius-control-lg)] bg-moss px-3 text-xs font-semibold text-warm">{zh ? "重新识别" : "Detect again"}</button></div> : null}</CardBody></Card><div className="space-y-4"><Card><CardHeader title={zh ? "识别设置" : "Detection settings"} /><CardBody className="space-y-4"><label className="block text-xs font-medium text-graphite">{zh ? "灰度阈值" : "Threshold"}<input type="range" min="20" max="235" value={threshold} onChange={(event) => { setThreshold(Number(event.target.value)); setConfirmed(false); }} className="mt-2 w-full accent-[var(--color-moss)]" /><span className="font-mono text-[10px] text-muted">{threshold}</span></label><label className="block text-xs font-medium text-graphite">{zh ? "最小区域" : "Minimum area"}<input type="number" min="2" value={minimumArea} onChange={(event) => { setMinimumArea(Number(event.target.value)); setConfirmed(false); }} className="mt-1.5 h-9 w-full rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm/30 px-3" /></label><div className="grid grid-cols-3 gap-1">{(["add", "remove", "exclude"] as const).map((item) => <button key={item} type="button" onClick={() => setMode(item)} className={`h-8 rounded-[var(--ln-radius-control-md)] text-[11px] font-medium ${mode === item ? "bg-sage-surface text-moss" : "border border-hairline text-muted"}`}>{zh ? { add: "补加", remove: "扣除", exclude: "排除区" }[item] : item}</button>)}</div><p className="text-[11px] leading-5 text-muted">{zh ? "选择模式后点击图像：补加/扣除计数，或排除局部识别区域。" : "Choose a mode, then click the image to add/remove a count or exclude a local region."}</p></CardBody></Card><Card><CardHeader title={zh ? "计数结果" : "Count"} /><CardBody className="space-y-3"><div className="grid grid-cols-2 gap-2"><div className="rounded-[var(--ln-radius-control-lg)] bg-warm p-3"><p className="text-[10px] text-muted">{zh ? "自动识别" : "Detected"}</p><p className="mt-1 font-mono text-xl font-semibold text-ink">{spots.length}</p></div><div className="rounded-[var(--ln-radius-control-lg)] bg-sage-surface p-3"><p className="text-[10px] text-moss">{zh ? "复核后" : "Reviewed"}</p><p className="mt-1 font-mono text-xl font-semibold text-moss">{finalCount}</p></div></div><p className="text-xs text-muted">{zh ? "人工调整" : "Manual adjustment"}: {manualAdjustment > 0 ? "+" : ""}{manualAdjustment}</p><button type="button" disabled={!previewUrl} onClick={() => setConfirmed(true)} className="focus-ring inline-flex h-9 w-full items-center justify-center gap-2 rounded-[var(--ln-radius-control-lg)] bg-moss text-xs font-semibold text-warm disabled:opacity-40"><Check className="h-3.5 w-3.5" />{confirmed ? (zh ? "已确认" : "Confirmed") : (zh ? "确认计数" : "Confirm count")}</button><button type="button" disabled={!confirmed || !state} onClick={saveCount} className="focus-ring inline-flex h-9 w-full items-center justify-center gap-2 rounded-[var(--ln-radius-control-lg)] border border-moss text-xs font-semibold text-moss disabled:opacity-40"><Save className="h-3.5 w-3.5" />{zh ? "仅保存数字与参数" : "Save numbers & settings only"}</button></CardBody></Card></div></div></div>;
}
