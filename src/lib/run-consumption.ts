import { parseScalar } from "./calculators/quantities";
import { normalizeProtocolDocument, projectProtocolDocument } from './protocol-document';
import { calculateConsumption, type ProtocolParameterValues } from './protocol';
import type { ConsumptionRule } from './types';
export type RunConsumptionSource = {id:string;label:string;rules:ConsumptionRule[];keys:string[]};
/** Only the locked snapshot defines eligible rules; the current catalog is not consulted. */
export function runConsumptionSources(snapshot: unknown): RunConsumptionSource[] {
  const versions = snapshot && typeof snapshot==='object' && 'versions' in snapshot ? snapshot.versions : null;
  if (!Array.isArray(versions)) return [];
  return versions.flatMap((v,index)=> {
    if (!v || typeof v!=='object') return [];
    const document=normalizeProtocolDocument(v.contentJson);
    const rules=document ? projectProtocolDocument(document).consumptionRules : [];
    if (!rules.length) return [];
    return [{id:typeof v.protocolVersionId==='string'?v.protocolVersionId:`snapshot-${index}`,label:`${v.protocolTitle || '规程名称未记录'} · ${v.displayVersion || '版本未记录'}`,rules,keys:[...new Set(rules.flatMap(rule=>rule.formula.match(/[A-Za-z_][A-Za-z0-9_]*/g)??[]))]}];
  });
}
export function previewRunConsumption(source:RunConsumptionSource, values:ProtocolParameterValues) {
  const missing=source.keys.filter(key=>values[key]===undefined || String(values[key]).trim()==='');
  if (missing.length) throw new Error(`请填写参数：${missing.join('、')}`);
  return calculateConsumption(source.rules,Object.fromEntries(source.keys.map(key=>[key,parseScalar(String(values[key]))]))).map((row,index)=>{
    if(!Number.isFinite(row.quantity)||row.quantity<0)throw new Error('预计量必须是非负有限数值。');
    return {...row,source:`Consumption:${source.id}:${index}`,basis:`${source.label}；${row.formula}；${source.keys.map(key=>`${key}=${values[key]}`).join('，')}`};
  });
}
