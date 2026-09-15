import type {LiquidOperation} from '@/lib/calculators/operations';
import {formatQuantity} from '@/lib/calculators/result-presentation';
/** The on-screen plan and printable snapshot use the same immutable operations. */
export function LiquidOperations({operations,zh=true}:{operations:LiquidOperation[];zh?:boolean}){
 return <ol className="space-y-1 break-words text-xs" data-liquid-operations>{operations.map(o=><li key={o.id}>{o.group?`${o.groupName??o.group} · `:''}{o.sample?`${o.sample} · `:''}{o.component}: {o.role==='make-up-to'?'定容至 / Make up to ':''}{formatQuantity(o.quantity.value)} {o.quantity.unit}{o.repetitions>1?` × ${o.repetitions} 次 / times`:''}<span className="block text-muted">{readable(o.source,o,zh,true)} → {readable(o.destination,o,zh,false)}</span></li>)}</ol>;
}

function readable(id:string,o:LiquidOperation,zh:boolean,source:boolean) {
 if (!id.includes(':') && !['specified-stock','preparation','prepared-batch','wells','vials','prepared-complex'].includes(id)) return id;
 if(source) return id.startsWith('stock:')||id==='specified-stock' ? o.component : (zh?'已配制混合液':'Prepared mixture');
 if(id.startsWith('premix:')) return o.groupName || (zh?'预混液':'Premix');
 return o.sample || o.groupName || (zh?'配制容器':'Preparation vessel');
}
