import type {CalculatorResult} from '@/lib/calculators/calculator-engine';
export function FitPlot({result}:{result:CalculatorResult}) {
 const rows=result.table?.filter(row=>typeof row.concentration==='number'&&typeof row.fitted==='number');
 if(!rows?.length)return null;
 const logarithmic=rows.every(row=>Number(row.concentration)>0);
 const xs=rows.map(row=>logarithmic?Math.log10(Number(row.concentration)):Number(row.concentration)), ys=rows.flatMap(row=>[Number(row.observed),Number(row.fitted)]), xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
 const x=(value:number)=>45+(value-xmin)/(xmax-xmin||1)*400,y=(value:number)=>215-(value-ymin)/(ymax-ymin||1)*180;
 return <figure><svg role="img" aria-label="Observed response and fitted curve; log10 concentration" viewBox="0 0 500 260" className="w-full"><path d="M45 25V215H455" fill="none" stroke="currentColor"/><polyline points={rows.map((row,i)=>`${x(xs[i])},${y(Number(row.fitted))}`).join(' ')} fill="none" stroke="#476d80" strokeWidth="2"/>{rows.map((row,i)=><circle key={i} cx={x(xs[i])} cy={y(Number(row.observed))} r="3.5" fill="#4F5961"/>)}<text x="45" y="235" fontSize="12">{xmin.toPrecision(3)}</text><text x="425" y="235" fontSize="12">{xmax.toPrecision(3)}</text><text x="190" y="253" fontSize="12">{logarithmic?'log₁₀ concentration':'Concentration'}</text><text x="3" y="30" fontSize="11">{ymax.toPrecision(3)}</text><text x="3" y="215" fontSize="11">{ymin.toPrecision(3)}</text></svg><figcaption className="text-xs text-muted">● Observed / 实测 · — Fitted / 拟合</figcaption></figure>;
}
