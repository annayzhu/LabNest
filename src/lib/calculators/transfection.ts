import {convert,parseScalar} from './quantities';
import {operation,type LiquidOperation} from './operations';
import type {CalculatorResult,CalculatorOutput} from './calculator-engine';
export type Material='dna'|'multi-dna'|'sirna'|'multi-sirna'|'shrna-plasmid'|'dna-sirna';
export type NucleicRow={name:string;kind:'dna'|'shrna-plasmid'|'sirna';stock:string;stockUnit:string;dose:string;sizeBasis:'bp'|'mw';size:string};
export type DoseReagent={name:string;basis:'direct'|'dna'|'sirna'|'custom';amount:string;basisName:string;basisUnit:string;basisAmount:string};
export type TubeVolume={mode:'add'|'final';value:string};
export type TransfectionGroup={name:string;wells:string;overage:string;finalVolume:string;dnaMode:'amount'|'mass-ratio'|'molar-ratio';totalDna:string;rnaMode:'each-nm'|'each-pmol'|'total-nm'|'total-pmol';totalRna:string;rows:NucleicRow[];reagent:DoseReagent;auxiliaries:DoseReagent[];a:TubeVolume;b:TubeVolume;single:TubeVolume;diluent:string;order:string};
export type TransfectionPlan={version:3;material:Material;mixing:'single'|'two-tube';protocol:string;groups:TransfectionGroup[]};
/** Validate persisted shape without converting or overwriting the source draft. */
export function isTransfectionPlan(value:unknown):value is TransfectionPlan{
 const object=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
 const strings=(v:Record<string,unknown>,keys:string[])=>keys.every(k=>typeof v[k]==='string');
 const reagent=(v:unknown)=>object(v)&&strings(v,['name','basis','amount','basisName','basisUnit','basisAmount']);
 const tube=(v:unknown)=>object(v)&&strings(v,['mode','value']);
 return object(value)&&value.version===3&&strings(value,['material','mixing','protocol'])&&Array.isArray(value.groups)&&value.groups.every(g=>object(g)&&strings(g,['name','wells','overage','finalVolume','dnaMode','totalDna','rnaMode','totalRna','diluent','order'])&&Array.isArray(g.rows)&&g.rows.every(r=>object(r)&&strings(r,['name','kind','stock','stockUnit','dose','sizeBasis','size']))&&reagent(g.reagent)&&Array.isArray(g.auxiliaries)&&g.auxiliaries.every(reagent)&&tube(g.a)&&tube(g.b)&&tube(g.single));
}
const l3000='https://documents.thermofisher.com/TFS-Assets/LSG/manuals/lipofectamine3000_protocol.pdf';
export const transfectionProtocols:Record<string,{name:string;mixing:'single'|'two-tube';materials:Material[];source:string;order:string;reagent:string}>={
 'l3000':{name:'Lipofectamine 3000 · MAN0009872 Rev C.0',mixing:'two-tube',materials:['dna','multi-dna','shrna-plasmid','sirna','multi-sirna'],source:l3000,order:'A：稀释核酸，DNA方案另加P3000；B：稀释脂质试剂；将A加入B，按说明书孵育后加入细胞。 / A: dilute nucleic acids, add P3000 for DNA; B: dilute lipid. Add A to B, incubate per guide, then add to cells.',reagent:'Lipofectamine 3000'},
 'l3000-co':{name:'Lipofectamine 3000 · DNA + siRNA FAQ',mixing:'two-tube',materials:['dna-sirna'],source:'https://www.thermofisher.com/order/catalog/product/L3000015/faqs',order:'DNA和siRNA同入A管，P3000按DNA量另设；B管稀释脂质。A加入B后按产品方案孵育、加至细胞。 / DNA and siRNA in A; set P3000 against DNA separately. Dilute lipid in B; combine A into B and follow product incubation.',reagent:'Lipofectamine 3000'},
 'rnaimax-forward':{name:'RNAiMAX · Forward transfection',mixing:'two-tube',materials:['sirna','multi-sirna'],source:'https://www.thermofisher.com/us/en/home/references/protocols/cell-culture/transfection-protocol/rnaimax-forward-transfections-lipofectamine.html',order:'A：稀释siRNA；B：稀释RNAiMAX；分别混匀后合并，按说明孵育，再加到已铺细胞。 / Dilute siRNA in A and RNAiMAX in B, combine, incubate per guide, then add to plated cells.',reagent:'Lipofectamine RNAiMAX'},
 'rnaimax-reverse':{name:'RNAiMAX · Reverse, in-well preparation',mixing:'single',materials:['sirna','multi-sirna'],source:'https://www.thermofisher.com/us/en/home/references/protocols/cell-culture/transfection-protocol/rnaimax-reverse-transfections-lipofectamine.html',order:'在每个孔内稀释siRNA，再加RNAiMAX并按说明孵育，最后加细胞悬液；整批数字是备料合计，不是合成一管。 / Dilute siRNA in each well, add RNAiMAX and incubate per guide, then add cells. Batch figures are supply totals, not a pooled tube.',reagent:'Lipofectamine RNAiMAX'},
};
export const newNucleicRow=(kind:NucleicRow['kind']='dna'):NucleicRow=>({name:'',kind,stock:'',stockUnit:kind==='sirna'?'µM':'µg/µL',dose:'',sizeBasis:'bp',size:''});
export const newDoseReagent=():DoseReagent=>({name:'',basis:'direct',amount:'',basisName:'',basisUnit:'',basisAmount:''});
export function newTransfectionGroup():TransfectionGroup{return {name:'',wells:'',overage:'10',finalVolume:'',dnaMode:'amount',totalDna:'',rnaMode:'each-nm',totalRna:'',rows:[newNucleicRow()],reagent:newDoseReagent(),auxiliaries:[],a:{mode:'final',value:''},b:{mode:'final',value:''},single:{mode:'final',value:''},diluent:'Opti-MEM',order:''};}
export function newTransfectionPlan():TransfectionPlan{return {version:3,material:'dna',mixing:'two-tube',protocol:'custom',groups:[newTransfectionGroup()]};}
export function changeTransfectionMaterial(plan:TransfectionPlan,material:Material):TransfectionPlan{
 const kinds:NucleicRow['kind'][]=material==='dna-sirna'?['dna','sirna']:material==='multi-dna'?['dna','dna']:material==='multi-sirna'?['sirna','sirna']:[material==='shrna-plasmid'?'shrna-plasmid':material==='sirna'?'sirna':'dna'];
 return {...plan,material,protocol:'custom',groups:plan.groups.map(g=>({...g,rows:kinds.map(newNucleicRow),dnaMode:'amount',totalDna:'',rnaMode:'each-nm',totalRna:'',reagent:newDoseReagent(),auxiliaries:[],order:''}))};
}
/** Mode switches clear volume and product-specific values; hidden fields never supply a new plan. */
export function changeTransfectionMixing(plan:TransfectionPlan,mixing:TransfectionPlan['mixing']):TransfectionPlan{return {...plan,mixing,protocol:'custom',groups:plan.groups.map(g=>({...g,a:{mode:'final',value:''},b:{mode:'final',value:''},single:{mode:'final',value:''},reagent:newDoseReagent(),auxiliaries:[],order:''}))};}
export function exampleTransfectionPlan():TransfectionPlan{const p=newTransfectionPlan();p.groups[0]={...p.groups[0],name:'DNA group',wells:'6',finalVolume:'1000',rows:[{...newNucleicRow(),name:'Plasmid',stock:'1',dose:'2'}],reagent:{...newDoseReagent(),name:'Custom lipid',basis:'dna',amount:'3'},a:{mode:'final',value:'62.5'},b:{mode:'final',value:'62.5'},order:'A管核酸稀释后与B管稀释试剂混合，按已验证方案孵育，再加入细胞。 / Dilute nucleic acid in A and reagent in B; combine and follow the validated protocol before adding to cells.'};return p;}
function positive(value:unknown,label:string,zero=false){const n=parseScalar(value);if(!Number.isFinite(n)||(zero?n<0:n<=0))throw Error(`${label}: ${zero?'须≥0 / must be ≥0':'须>0 / must be >0'}`);return n;}
function text(value:unknown,label:string){if(typeof value!=='string'||!value.trim())throw Error(`${label}: 必填 / required`);return value.trim();}
function choice<T extends string>(value:T,choices:readonly T[],label:string):T{if(!choices.includes(value))throw Error(`${label}: 无效选项 / invalid option`);return value;}
function volume(spec:TubeVolume,components:number,label:string){choice(spec.mode,['add','final'],'Volume meaning');const value=positive(spec.value,label,true);const total=spec.mode==='add'?components+value:value;const diluent=spec.mode==='add'?value:value-components;if(diluent<-1e-10||total<=0)throw Error(`${label}: 组分超过本管总体积 / Components exceed tube total`);return {total,diluent:Math.max(0,diluent)};}
function reagentVolume(r:DoseReagent,dna:number,rna:number){text(r.name,'试剂名称 / Reagent name');choice(r.basis,['direct','dna','sirna','custom'],'Reagent basis');const rate=positive(r.amount,'试剂用量 / Reagent amount',true);if(r.basis==='dna'&&dna===0)throw Error('无DNA，不可按DNA质量计试剂 / No DNA for DNA-based reagent');if(r.basis==='sirna'&&rna===0)throw Error('无siRNA，不可按siRNA计试剂 / No siRNA for RNA-based reagent');if(r.basis==='custom'){text(r.basisName,'依据对象 / Basis object');text(r.basisUnit,'依据单位 / Basis unit');return rate*positive(r.basisAmount,'每孔依据量 / Basis per well');}return rate*(r.basis==='dna'?dna:r.basis==='sirna'?rna:1);}
/** Unit-explicit per-well arithmetic; overage is applied once, only to supply/preparation volumes. */
export function calculateTransfection(plan:TransfectionPlan):CalculatorResult{
 if(!isTransfectionPlan(plan))throw Error('方案结构不完整或版本不支持；原数据未修改 / Incomplete or unsupported transfection plan; source preserved');choice(plan.material,['dna','multi-dna','sirna','multi-sirna','shrna-plasmid','dna-sirna'],'Material');choice(plan.mixing,['single','two-tube'],'Mixing');
 const profile=transfectionProtocols[plan.protocol];if(plan.protocol!=='custom'&&!profile)throw Error('Unknown protocol');
 if(profile&&(profile.mixing!==plan.mixing||!profile.materials.includes(plan.material)))throw Error('产品方案与材料或配制模式不兼容 / Protocol incompatible with material or preparation mode');
 if(!Array.isArray(plan.groups)||!plan.groups.length||plan.groups.length>96)throw Error('需要1–96个独立组 / Require 1–96 groups');
 const table:NonNullable<CalculatorResult['table']>=[],operations:LiquidOperation[]=[],outputs:CalculatorOutput[]=[],notes:string[]=[],warnings:string[]=[];const names=new Set<string>();let batchDna=0;
 for(const [gi,g] of plan.groups.entries()){
  const name=text(g.name,'实验组名称 / Group name');if(names.has(name))throw Error('实验组名称重复 / Duplicate group name');names.add(name);
  const wells=positive(g.wells,'孔数 / Wells');if(!Number.isInteger(wells))throw Error('孔数必须为整数 / Integer wells required');const factor=wells*(1+positive(g.overage,'配制余量 / Overage',true)/100),final=positive(g.finalVolume,'每孔最终培养体积 / Final culture volume');
  if(!Array.isArray(g.rows)||!g.rows.length||g.rows.length>96)throw Error('核酸行无效 / Invalid nucleic acid rows');
  choice(g.dnaMode,['amount','mass-ratio','molar-ratio'],'DNA basis');choice(g.rnaMode,['each-nm','each-pmol','total-nm','total-pmol'],'siRNA basis');
  const dnaRows=g.rows.filter(r=>r.kind==='dna'||r.kind==='shrna-plasmid'),rnaRows=g.rows.filter(r=>r.kind==='sirna');
  if(dnaRows.length+rnaRows.length!==g.rows.length)throw Error('必须明确材料形式；病毒转导请使用MOI工具 / Specify material; viral transduction uses MOI');
  if((['dna','shrna-plasmid'].includes(plan.material)&&(dnaRows.length!==1||rnaRows.length))||(plan.material==='multi-dna'&&(dnaRows.length<2||rnaRows.length))||(plan.material==='sirna'&&(rnaRows.length!==1||dnaRows.length))||(plan.material==='multi-sirna'&&(rnaRows.length<2||dnaRows.length))||(plan.material==='dna-sirna'&&(!dnaRows.length||!rnaRows.length)))throw Error('材料类型与核酸行不一致 / Material and nucleic acid rows disagree');
  if(plan.material==='shrna-plasmid'&&g.rows[0].kind!=='shrna-plasmid')throw Error('shRNA必须注明表达质粒 / shRNA expression plasmid required');
  const weight=(r:NucleicRow)=>positive(r.dose,'DNA ratio')*(g.dnaMode==='molar-ratio'?(choice(r.sizeBasis,['bp','mw'],'Molecular size'),positive(r.size,'质粒长度或分子量 / Plasmid length or MW')*(r.sizeBasis==='bp'?660:1)):1);
  const denominator=g.dnaMode==='amount'?1:dnaRows.reduce((s,r)=>s+weight(r),0),rnaRatio=rnaRows.reduce((s,r)=>s+positive(r.dose,'siRNA dose / ratio'),0);
  const rowNames=new Set<string>();let dnaTotal=0,rnaTotal=0;
  const doses=g.rows.map(r=>{
   const component=text(r.name,'核酸名称 / Nucleic acid name');if(rowNames.has(component))throw Error('同组核酸名称重复 / Duplicate nucleic acid name');rowNames.add(component);
   const dna=r.kind!=='sirna';const amount=dna?(g.dnaMode==='amount'?positive(r.dose,'每孔DNA质量 / DNA mass per well'):positive(g.totalDna,'总DNA质量 / Total DNA mass')*weight(r)/denominator):(g.rnaMode.startsWith('total')?positive(g.totalRna,'siRNA总用量 / Total siRNA')*positive(r.dose,'siRNA ratio')/rnaRatio:positive(r.dose,'siRNA dose'))*(g.rnaMode.endsWith('nm')?final/1000:1);
   const stock=convert(positive(r.stock,'母液浓度 / Stock concentration'),r.stockUnit,dna?'µg/µL':'µM');const v=amount/stock;dnaTotal+=dna?amount:0;rnaTotal+=dna?0:amount;return {r,component,amount,volume:v,dna};
  });
  const reagentName=text(g.reagent.name,'试剂名称 / Reagent name');if(profile&&reagentName!==profile.reagent)throw Error('试剂名称与所选产品不符 / Reagent does not match product');
  if(/rnaimax/i.test(reagentName)&&dnaRows.length)throw Error('RNAiMAX不适用于DNA共转染 / RNAiMAX does not support DNA co-transfection');
  if(!Array.isArray(g.auxiliaries))throw Error('Invalid auxiliary list');
  if(rnaRows.length&&!dnaRows.length&&g.auxiliaries.some(r=>/p\s*3000/i.test(r.name)))throw Error('纯siRNA方案不添加P3000 / Do not add P3000 to siRNA-only transfection');
  if(profile&&plan.protocol.startsWith('l3000')&&dnaRows.length&&!g.auxiliaries.some(r=>r.name==='P3000'&&r.basis==='dna'&&Number(r.amount)===2))throw Error('所选DNA方案需P3000 2 µL/µg DNA；其他用量请使用有依据的自定义方案 / Selected DNA protocol requires P3000 2 µL/µg DNA');
  const reagent=reagentVolume(g.reagent,dnaTotal,rnaTotal),aux=g.auxiliaries.map(r=>({name:text(r.name,'辅助试剂 / Auxiliary'),volume:reagentVolume(r,dnaTotal,rnaTotal)})),nucleic=doses.reduce((s,r)=>s+r.volume,0),auxTotal=aux.reduce((s,r)=>s+r.volume,0);
  const a=plan.mixing==='two-tube'?volume(g.a,nucleic+auxTotal,'A管 / Tube A'):volume(g.single,nucleic+auxTotal+reagent,'单体系 / Single mixture');const b=plan.mixing==='two-tube'?volume(g.b,reagent,'B管 / Tube B'):{total:0,diluent:0};const mixed=a.total+b.total;
  if(mixed>final+1e-10)throw Error('混合液超过每孔最终培养体积 / Mixture exceeds final culture volume');
  const diluent=text(g.diluent,'稀释液名称 / Diluent');const order=profile?.order??text(g.order,'加样顺序 / Addition order');const inWell=plan.protocol==='rnaimax-reverse';
  const push=(tube:string,component:string,v:number,extra:Record<string,number|string>={})=>{const row=table.length;table.push({group:name,tube,component,perWellUl:v,batchUl:v*factor,...extra});operations.push(operation(`transfection:${gi}:${row}`,component,inWell?v:v*factor,'µL','add',{group:String(gi),groupName:name,source:component,destination:`${name}:${tube}`,repetitions:inWell?wells:1}));};
  const at=plan.mixing==='two-tube'?'A':'单体系 / Single';for(const d of doses)push(at,d.component,d.volume,d.dna?{dnaMassUg:d.amount}:{rnaPmol:d.amount,finalNm:d.amount*1000/final});for(const r of aux)push(at,r.name,r.volume);push(at,diluent,a.diluent);push(plan.mixing==='two-tube'?'B':at,reagentName,reagent);if(plan.mixing==='two-tube')push('B',diluent,b.diluent);
  const add=(key:string,en:string,cn:string,value:number,unit='µL')=>outputs.push({key:`group${gi}_${key}`,label:`${name} · ${en}`,labelZh:`${name} · ${cn}`,value,unit});
  if(dnaRows.length)add('dna','DNA per well','每孔总DNA',dnaTotal,'µg');if(rnaRows.length)add('rna','siRNA per well','每孔总siRNA',rnaTotal,'pmol');if(rnaTotal)add('rnaFinal','Total siRNA final concentration','siRNA总终浓度',rnaTotal*1000/final,'nM');add('a',plan.mixing==='two-tube'?'Tube A total per well':'Mixture per well',plan.mixing==='two-tube'?'每孔A管总体积':'每孔混合液总体积',a.total);if(plan.mixing==='two-tube')add('b','Tube B total per well','每孔B管总体积',b.total);add('mixed','Mixture added per well','每孔混合液加入量',mixed);add('final','Final culture volume per well','每孔最终培养体积',final);add('medium','Cell medium before addition','加入混合液前培养基/细胞悬液',final-mixed);add('batch','Batch supply incl. overage','含余量整批备料体积',mixed*factor);
  if(plan.mixing==='two-tube')operations.push(operation(`transfection:${gi}:combine`,'合并A至B / Combine A into B',a.total*factor,'µL','transfer',{group:String(gi),groupName:name,source:`${name}:A`,destination:`${name}:B`}));
  if(!inWell)operations.push(operation(`transfection:${gi}:dispense`,'每孔混合液 / Mixture per well',mixed,'µL','dispense',{group:String(gi),groupName:name,source:`${name}:mixture`,destination:`${name}:wells`,repetitions:wells}));
  notes.push(`${name}: ${order}`);batchDna+=dnaTotal*factor;
 }
 if(batchDna)outputs.push({key:'dnaUg',label:'Batch DNA incl. overage',labelZh:'含余量整批DNA',value:batchDna,unit:'µg'});
 notes.push('体积按可加和计算；siRNA nM × 最终培养体积µL ÷1000 = pmol；µM = pmol/µL。余量仅放大备料，不增加每孔剂量。 / Additive volumes; overage increases supplies only.');
 if(plan.groups.some(g=>g.dnaMode==='molar-ratio'))notes.push('质粒摩尔比按长度×660 g/mol/bp估算dsDNA分子量，或使用录入的实际分子量。 / dsDNA estimate: 660 g/mol/bp; prefer actual MW.');
 warnings.push('方案用量需按所用试剂与细胞条件验证；不同实验组分别配制。 / Validate doses for reagent and cells; prepare each experimental group separately.');
 if(profile)notes.push(`${profile.name}: ${profile.source}；体积采用所选“加入/补足”含义并计入所有组分，不能把厂商近似体积当成精确总量。 / All component volumes counted; do not substitute nominal protocol volumes for measured totals.`);
 return {calculatorId:'transfection',methodVersion:'transfection-v3',outputs,outputMap:Object.fromEntries(outputs.map(o=>[o.key,o.value])),table,operations,warnings,notes,instructions:plan.groups.map(g=>`${g.name}: ${profile?.order??g.order}`)};
}

/** A set of selected wells represents one treatment; no implicit multi-group assignment. */
export function transfectionPlateValues(plan:TransfectionPlan,wellCount:number){
 if(plan.groups.length!==1||Number(plan.groups[0].wells)!==wellCount)throw Error('请按实验组分别选择孔位，且孔数需一致 / Select matching wells for one group at a time');
 return calculateTransfection(plan).outputMap;
}
