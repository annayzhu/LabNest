import type {LiquidOperation} from '@/lib/calculators/operations';
import {formatQuantity} from '@/lib/calculators/result-presentation';
/** The on-screen plan and printable snapshot use the same immutable operations. */
export function LiquidOperations({operations}:{operations:LiquidOperation[]}){
 return <ol className="space-y-1 break-words text-xs" data-liquid-operations>{operations.map(o=><li key={o.id}>{o.group?`${o.groupName??o.group} · `:''}{o.sample?`${o.sample} · `:''}{o.component}: {o.role==='make-up-to'?'定容至 / Make up to ':''}{formatQuantity(o.quantity.value)} {o.quantity.unit}{o.repetitions>1?` × ${o.repetitions} 次 / times`:''}<span className="block text-muted">{o.source} → {o.destination}</span></li>)}</ol>;
}
