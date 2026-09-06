/** Volume-balance primitives. Callers supply compatible concentrations and µL.
 * Methods and independent worked examples: docs/calculator/spec-v1.0.md §7, §14.
 */
import { parseScalar, convert } from './quantities';
export function dilution(stock: number, target: number, volume: number) {
  if (![stock, target, volume].every(Number.isFinite) || stock <= 0 || target < 0 || target > stock || volume <= 0) throw new Error('目标浓度或体积不可行 / Target concentration or volume is infeasible');
  const sample = target * volume / stock;
  return { sample, diluent: volume - sample, final: volume };
}
export function addStock(stock: number, target: number, initial: number, volume: number) {
  if (![stock, target, initial, volume].every(Number.isFinite) || volume <= 0 || initial < 0 || target < initial || stock <= target) throw new Error('加入模式要求母液浓度 > 目标浓度 ≥ 初始浓度 / Require stock > target ≥ initial');
  const sample = (target - initial) * volume / (stock - target);
  return { sample, diluent: volume, final: volume + sample };
}
export function serialPlan(start: number, factor: number, count: number, volume: number, retained: boolean) {
  if (![start, factor, count, volume].every(Number.isFinite) || start <= 0 || factor <= 1 || !Number.isInteger(count) || count < 1 || count > 384 || volume <= 0) throw new Error('梯度参数无效 / Invalid gradient parameters');
  const prepared = Array<number>(count).fill(volume);
  if (retained) for (let index = count - 2; index >= 0; index--) prepared[index] = volume + prepared[index + 1] / factor;
  return prepared.map((mixed, index) => {
    const transfer = index < count - 1 ? prepared[index + 1] / factor : 0;
    return { tube: index + 1, concentration: start / factor ** index, source: index ? `Tube ${index}` : '已备起始液 / Prepared starting solution', takeUl: index ? mixed / factor : mixed, diluentUl: index ? mixed - mixed / factor : 0, mixedUl: mixed, transferUl: transfer, remainingUl: mixed - transfer };
  });
}
export type MixRow = { name: string; volume: string; premix: boolean; group?: string; inputMode?: string; stock?: string; target?: string; stockUnit?: string; targetUnit?: string };
export function mixPlan(rows: MixRow[], reactions: number, extra: number, final: number) {
  if (!Number.isInteger(reactions) || reactions <= 0 || !Number.isFinite(extra) || extra < 0 || !Number.isFinite(final) || final <= 0 || !rows.length) throw new Error('反应参数不完整 / Incomplete reaction parameters');
  const volumes = rows.map(row => row.inputMode==='concentration'?dilution(convert(parseScalar(row.stock),row.stockUnit??'mM',row.targetUnit??'µM'),parseScalar(row.target),final).sample:parseScalar(row.volume));
  if (rows.some(row => !row.name.trim()) || volumes.some(v => v < 0)) throw new Error('请检查组分名称及用量 / Check component names and volumes');
  const sum = volumes.reduce((a,b) => a+b,0);
  if (sum > final + 1e-10) throw new Error('组分超过单反应体积 / Components exceed reaction volume');
  const table = rows.map((row,index) => ({ component: row.name, perReactionUl: volumes[index], premix: row.premix ? '是 / Yes' : '独立加样 / Separate', batchUl: row.premix ? volumes[index] * (reactions + extra) : '', group: row.group || 'default' }));
  if (final - sum > 1e-10) table.push({ component: '水 / Water', perReactionUl: final - sum, premix: '是 / Yes', batchUl: (final - sum) * (reactions + extra), group: 'default' });
  return { table, total: table.reduce((s,row) => s + (typeof row.batchUl === 'number' ? row.batchUl : 0),0), separate: rows.reduce((s,row,index) => s + (row.premix ? 0 : volumes[index]),0) };
}
export type SampleRow = { id: string; concentration: string; available: string };
export function batchPlan(rows: SampleRow[], target: number, volume: number, bufferFold?: number, other = 0) {
  return rows.map(row => {
    try {
      if (!row.id.trim() || rows.filter(other => other.id.trim() === row.id.trim()).length > 1) throw new Error('样本ID缺失或重复 / Missing or duplicate ID');
      const concentration = parseScalar(row.concentration);
      let plan;
      if (bufferFold !== undefined) {
        if (concentration <= 0 || bufferFold < 1 || volume <= 0 || target <= 0 || other < 0) throw new Error('参数无效 / Invalid parameters');
        const sample = target / concentration, buffer = volume / bufferFold;
        if (sample + buffer + other > volume) throw new Error('浓度不足 / Insufficient concentration');
        plan = { sample, diluent: volume - sample - buffer - other, buffer };
      } else plan = { ...dilution(concentration, target, volume), buffer: 0 };
      if (row.available.trim() && parseScalar(row.available) < plan.sample) throw new Error('可用样品不足 / Insufficient available sample');
      return { id: row.id, originalConcentration: row.concentration, availableUl: row.available, status: '有效 / Valid', sampleUl: plan.sample as number | string, diluentUl: plan.diluent as number | string, bufferUl: plan.buffer as number | string };
    } catch (error) {
      return { id: row.id, originalConcentration: row.concentration, availableUl: row.available, status: (error as Error).message, sampleUl: '', diluentUl: '', bufferUl: '' };
    }
  });
}

export type ReducingAgent = { name: string; mode: 'volume-fraction' | 'target-concentration' | 'included'; volumeUl: number; definition: string };
/** WB retains every independent component; invalid rows never acquire numeric zero placeholders. */
export function wbPlan(rows: SampleRow[], target: number, volume: number, bufferFold: number, agent: ReducingAgent) {
 const table=batchPlan(rows,target,volume,bufferFold,agent.volumeUl);
 return table.map(row=>{
  const valid=typeof row.sampleUl==='number';
  const full={...row,concentrationUnit:'µg/µL',targetProteinUg:target,reducingAgent:agent.name,reducingMode:agent.mode,reducingDefinition:agent.definition,reducingAgentUl:valid?agent.volumeUl:'',totalUl:valid?volume:'',volumeUnit:'µL'};
  if(valid && Math.abs(Number(full.sampleUl)+Number(full.bufferUl)+Number(full.reducingAgentUl)+Number(full.diluentUl)-volume)>Math.max(1e-9,volume*1e-9))throw new Error('WB volume balance failed');
  return full;
 });
}
