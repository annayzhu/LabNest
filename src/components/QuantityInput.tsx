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
  const current = value ?? localValue, selected = unit ?? localUnit;
  const choices = [...new Set([selected,...(options ?? compatibleUnits(selected))])];
  function change(next: string, nextUnit: string) { setLocalValue(next); setLocalUnit(nextUnit); onChange?.(next,nextUnit); }
  let saved = current;
  try { if (storageUnit && current.trim()) saved = String(Number(convert(parseScalar(current),selected,storageUnit).toPrecision(14))); } catch { saved = ""; }
  return <div className="quantity-field min-w-0"><label className="block text-sm">{label}<span className="quantity-control">
    <input aria-label={label} type="text" inputMode="decimal" required={required} pattern={String.raw`\+?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+\-]?[0-9]+)?`} value={current} onChange={e => { change(e.target.value,selected); setError(""); }} className="focus-ring min-w-0 bg-transparent px-2 tabular-nums" />
    {choices.length > 1 ? <select aria-label={`${label}单位`} value={selected} className="focus-ring min-w-0 bg-transparent px-1" onChange={e => {
      try { const next = current.trim() ? String(Number(convert(parseScalar(current),selected,e.target.value).toPrecision(14))) : ""; change(next,e.target.value); setError(""); }
      catch { setError("请先完成数值；跨维度换算需要明确规格或浓度。"); }
    }}>{choices.map(option => <option key={option}>{option}</option>)}</select> : <span className="px-2 text-sm">{selected}</span>}
  </span></label><input type="hidden" name={name} value={saved} /><input type="hidden" name={unitName} value={storageUnit ?? selected} />{error ? <p role="alert" className="text-xs text-error">{error}</p> : null}</div>;
}
