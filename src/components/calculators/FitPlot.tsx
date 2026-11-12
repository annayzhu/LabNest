"use client";
import {useEffect,useRef,useState} from 'react';
import type {CalculatorResult} from '@/lib/calculators/calculator-engine';

/** The fitted model as a function of concentration, from the parameters the engine already reported. */
function fittedModel(result:CalculatorResult):((x:number)=>number)|null {
 const value=(key:string)=>{const raw=result.outputMap?.[key];return typeof raw==='number'&&Number.isFinite(raw)?raw:null;};
 const bottom=value('bottom'),top=value('top'),middle=value('midpoint')??value('ec50'),hill=value('hillSlope');
 if(bottom!==null&&top!==null&&middle!==null&&hill!==null)return x=>bottom+(top-bottom)/(1+(middle/x)**hill);
 const slope=value('slope'),intercept=value('intercept');
 if(slope!==null&&intercept!==null)return x=>intercept+slope*x;
 return null;
}
/** Round tick positions covering [min,max]. */
function ticks(min:number,max:number,count=5){
 const span=max-min||Math.abs(max)||1,raw=span/count,power=10**Math.floor(Math.log10(raw)),step=[1,2,5,10].map(m=>m*power).find(s=>s>=raw)??raw;
 const out:number[]=[];for(let v=Math.ceil(min/step-1e-9)*step;v<=max+step*1e-9;v+=step)out.push(Math.abs(v)<step*1e-9?0:v);
 return out;
}
const label=(value:number)=>Number(value.toPrecision(3)).toString();

/** Points are the observed values; the line is the fitted model sampled along the axis, not segments between points. */
export function FitPlot({result,zh=false}:{result:CalculatorResult;zh?:boolean}) {
 const frame=useRef<HTMLElement>(null);
 const [width,setWidth]=useState(520);
 useEffect(()=>{const element=frame.current;if(!element)return;const measure=()=>setWidth(Math.max(280,Math.round(element.clientWidth)));measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();},[]);
 const rows=result.table?.filter(row=>typeof row.concentration==='number'&&typeof row.fitted==='number');
 if(!rows?.length)return null;
 const logarithmic=rows.every(row=>Number(row.concentration)>0);
 const toAxis=(concentration:number)=>logarithmic?Math.log10(concentration):concentration,fromAxis=(position:number)=>logarithmic?10**position:position;
 const xs=rows.map(row=>toAxis(Number(row.concentration))),xmin=Math.min(...xs),xmax=Math.max(...xs);
 const model=fittedModel(result);
 const curve=model?Array.from({length:101},(_,i)=>{const position=xmin+(xmax-xmin)*i/100;return{x:position,y:model(fromAxis(position))};}).filter(point=>Number.isFinite(point.y)):rows.map((row,i)=>({x:xs[i],y:Number(row.fitted)})).sort((a,b)=>a.x-b.x);
 const ys=[...rows.map(row=>Number(row.observed)),...curve.map(point=>point.y)],ylow=Math.min(...ys),yhigh=Math.max(...ys),pad=(yhigh-ylow||1)*0.06,ymin=ylow-pad,ymax=yhigh+pad;
 const height=Math.round(Math.min(360,Math.max(220,width*0.5))),left=52,right=16,top=12,bottom=44,plotWidth=width-left-right,plotHeight=height-top-bottom;
 const x=(value:number)=>left+(value-xmin)/(xmax-xmin||1)*plotWidth,y=(value:number)=>top+plotHeight-(value-ymin)/(ymax-ymin||1)*plotHeight;
 const xTicks=logarithmic?(()=>{const whole:number[]=[];for(let v=Math.ceil(xmin-1e-9);v<=xmax+1e-9;v++)whole.push(v);return whole.length>=2?whole:[xmin,xmax];})():ticks(xmin,xmax),yTicks=ticks(ylow,yhigh);
 const unit=String(result.rawInputs?.concentrationUnit??'');
 return <figure ref={frame} className="calculator-fit-plot"><svg role="img" aria-label={`${zh?'实测与拟合曲线':'Observed response and fitted curve'}; ${logarithmic?'log10':'linear'} ${zh?'浓度':'concentration'}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} fontSize="12" style={{background:'#fff',color:'#4F5961'}}>
  {yTicks.map(tick=><g key={`y${tick}`}><line x1={left} x2={left+plotWidth} y1={y(tick)} y2={y(tick)} stroke="#e6ebe8"/><text x={left-8} y={y(tick)+4} textAnchor="end" fill="currentColor">{label(tick)}</text></g>)}
  {xTicks.map(tick=><g key={`x${tick}`}><line x1={x(tick)} x2={x(tick)} y1={top} y2={top+plotHeight} stroke="#e6ebe8"/><line x1={x(tick)} x2={x(tick)} y1={top+plotHeight} y2={top+plotHeight+4} stroke="currentColor"/><text x={x(tick)} y={top+plotHeight+18} textAnchor="middle" fill="currentColor">{label(fromAxis(tick))}</text></g>)}
  <path d={`M${left} ${top}V${top+plotHeight}H${left+plotWidth}`} fill="none" stroke="currentColor"/>
  <polyline points={curve.map(point=>`${x(point.x).toFixed(1)},${y(point.y).toFixed(1)}`).join(' ')} fill="none" stroke="#476d80" strokeWidth="2" strokeLinejoin="round"/>
  {rows.map((row,i)=><circle key={i} cx={x(xs[i])} cy={y(Number(row.observed))} r="3.5" fill="#fff" stroke="#4F5961" strokeWidth="1.5"/>)}
  <text x={left+plotWidth/2} y={height-8} textAnchor="middle" fill="currentColor">{zh?'浓度':'Concentration'}{unit?` (${unit})`:''}{logarithmic?(zh?'，对数坐标':', log scale'):''}</text>
 </svg><figcaption className="text-xs text-muted">{zh?'点：实测；线：拟合':'Points: observed; line: fitted'}</figcaption></figure>;
}
