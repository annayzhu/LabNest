import type {CalculatorDefinition} from "@/lib/calculators/catalog";
import {CalculatorMode} from './CalculatorControls';
import {isModeField} from "@/lib/calculators/workspace-presentation";
export function CalculatorField({ field, zh, value, onChange }: { field: CalculatorDefinition["fields"][number]; zh: boolean; value: unknown; onChange: (value: string | number) => void }) {
  const label = zh ? field.labelZh : field.label;
  // A "please choose" placeholder becomes no selection, so the choice is still explicit.
  const choices=field.options?.filter(option=>option.value)??[];
  if(isModeField(field)&&choices.length>=2)return <CalculatorMode label={label} value={String(value??'')} options={choices.map(option=>({value:option.value,label:zh?option.labelZh:option.label}))} onChange={onChange}/>;
  const shared = "mt-1.5 w-full rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm/30 px-3 text-sm text-ink outline-none transition focus:border-moss focus:bg-surface";
  return <label className={field.type === "textarea" ? "sm:col-span-2" : ""}><span className="flex items-center justify-between gap-2 text-xs font-medium text-graphite"><span>{label}</span>{field.unit && field.unit !== "integer" ? <span className="font-mono text-xs font-normal text-muted">{field.unit}</span> : null}</span>{field.type === "select" ? <select value={String(value??"")} onChange={(event) => onChange(event.target.value)} className={`${shared} min-h-11`}>{field.options?.map((option) => <option key={option.value} value={option.value}>{zh ? option.labelZh : option.label}</option>)}</select> : field.type === "textarea" ? <textarea rows={2} value={String(value??"")} onChange={(event) => onChange(event.target.value)} className={`${shared} py-2 font-mono text-xs`} /> : <input type="text" inputMode={field.type === "number" ? "decimal" : undefined} value={String(value??"")} onChange={(event) => onChange(event.target.value)} className={`${shared} min-h-11`} />}</label>;
}
