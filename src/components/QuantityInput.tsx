"use client";
import { useState } from "react";
import { compatibleUnits, convert, parseScalar } from "@/lib/calculators/quantities";

/** Display conversion reuses Calculator units; a storage unit can keep an existing ledger unchanged. */
export function QuantityInput({ label, name, unitName = "unit", initialValue = "", initialUnit = "mL", storageUnit, required = false, value, unit, onChange, options }: {
  label: string; name: string; unitName?: string; initialValue?: string; initialUnit?: string; storageUnit?: string; required?: boolean;
  value?: string; unit?: string; onChange?: (value: string, unit: string) => void; options?: string[];
}) {
  const [localValue, setLocalValue] = useState(initialValue);
  const [localUnit, setLocalUnit] = useState(initialUnit);
  const [error, setError] = useState("");
  const [custom, setCustom] = useState(false);
  const current = value ?? localValue, selected = unit ?? localUnit;
  const choices = [...new Set(storageUnit ? [storageUnit,...compatibleUnits(storageUnit)] : [selected,...compatibleUnits(selected),...(options ?? ["mL","µL","L","g","mg","µg","box","bottle","vial","pack","reaction"])])];
  function change(next: string, nextUnit: string) { setLocalValue(next); setLocalUnit(nextUnit); onChange?.(next,nextUnit); }
  let saved = current;
  try { if (storageUnit && storageUnit !== selected && current.trim()) saved = String(Number(convert(parseScalar(current),selected,storageUnit).toPrecision(14))); } catch { saved = ""; }
  return <div className="quantity-field min-w-0"><label className="block text-sm">{label}<span className="quantity-control">
    <input aria-label={label} type="text" inputMode="decimal" required={required} pattern={String.raw`\+?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+\-]?[0-9]+)?`} value={current} onChange={e => { change(e.target.value,selected); setError(""); }} className="focus-ring min-w-0 bg-transparent px-2 tabular-nums" />
    {custom ? <input aria-label={`${label}自定义单位`} value={selected} maxLength={32} required onChange={e => change(current,e.target.value)} className="focus-ring min-w-0 bg-transparent px-1" /> : choices.length > 1 ? <select aria-label={`${label}单位`} value={selected} className="focus-ring min-w-0 bg-transparent px-1" onChange={e => {
      if (e.target.value === "__custom") { if (current.trim()) { setError("请先清空数量，再设置自定义单位。"); return; } setCustom(true); change("", ""); return; }
      try { const next = current.trim() ? String(Number(convert(parseScalar(current),selected,e.target.value).toPrecision(14))) : ""; change(next,e.target.value); setError(""); }
      catch { setError("请先完成数值；更换材料维度请先清空数量，跨维度换算需要明确规格或浓度。"); }
    }}>{choices.map(option => <option key={option}>{option}</option>)}{!storageUnit ? <option value="__custom">自定义单位…</option> : null}</select> : <span className="px-2 text-sm">{selected}</span>}
  </span></label><input type="hidden" name={name} value={saved} /><input type="hidden" name={unitName} value={storageUnit ?? selected} />{error ? <p role="alert" className="text-xs text-error">{error}</p> : null}</div>;
}
