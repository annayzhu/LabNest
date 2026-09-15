import {writeFileSync} from 'node:fs';
import {calculate,getCalculatorDefinition} from '../src/lib/calculators/calculator-engine';
import {exampleTransfectionPlan,changeTransfectionMaterial,changeTransfectionMixing,newDoseReagent} from '../src/lib/calculators/transfection';
const cases:Array<{id:string;name:string;inputs:Record<string,unknown>;outputs:unknown;status:unknown}>=[];
function add(id:string,name:string,patch:Record<string,unknown>){const inputs={...getCalculatorDefinition(id).exampleInputs,...patch};const r=calculate({calculatorId:id,inputs});cases.push({id,name,inputs,outputs:r.outputMap,status:r.status});}
for(const [mode,patch] of Object.entries({final:{},add:{initialConcentration:0},fold:{stockFold:10,targetFold:2},ratio:{ratio:1000},parts:{stockParts:1,diluentParts:10}}))add('dilution',mode,{mode,...patch});
add('hemocytometer','custom geometry',{countRegion:'custom',areaMm2:1,depthMm:0.1});
add('split','different areas',{areaMode:'different',sourceAreaCm2:10,targetAreaCm2:5});
for(const mode of ['mass','concentration','volume'])add('molarity',mode,{mode,massG:0.5844,molecularWeight:58.44,concentrationM:0.1,volumeL:0.1});
for(const type of ['w/v','v/v','w/w'])add('percent-solution',type,{type,percentage:10,targetMassG:100});
for(const mode of ['amount','mass','mass-molar'])add('resuspension',mode,{mode,mass:1,molecularWeight:100,targetMolar:100,targetMass:1});
for(const mode of ['rpm-to-rcf','rcf-to-rpm'])add('centrifuge',mode,{mode,rpm:1000,rcf:111.8,radiusCm:10});
for(const volumeMode of ['mixed','retained'])for(const firstSource of ['prepared','stock'])add('serial-dilution',`${volumeMode}-${firstSource}`,{gradientMode:'geometric',volumeMode,firstSource,sourceConcentration:1000});
for(const gradientMode of ['linear','custom'])add('serial-dilution',gradientMode,{gradientMode,startingConcentration:10,endingConcentration:20,levels:2,customTargets:'10\n20',sourceConcentration:100,totalVolumePerLevel:100});
for(const id of ['media-recipe','buffer-recipe'])for(const recipeMode of ['final','add'])add(id,recipeMode,{recipeMode,baseVolumeMl:100,targetVolumeMl:100,recipeRows:[{name:'Salt',amount:'1',unit:'g'},{name:'Stock',inputMode:recipeMode==='final'?'concentration':'amount',amount:'1',unit:'mL',stock:'100',stockUnit:'mM',target:'1',targetUnit:'mM'}]});
for(const id of ['normalization','wb-loading'])add(id,'20 samples with invalid row',{samples:Array.from({length:20},(_,i)=>({id:`Sample ${i+1}`,concentration:i===9?'invalid':'50',available:'100'}))});
add('cfu','with efficiency',{dnaUg:1});add('cfu','without efficiency',{dnaUg:0});
add('virus-titer','TCID50',{mode:'tcid50',tcidSeries:'0.001,8,8\n0.0001,6,8\n0.00001,2,8\n0.000001,0,8'});
add('wb-loading','buffer already contains reducer',{bufferContainsReducingAgent:'yes'});
add('wb-loading','target active reducer',{bufferContainsReducingAgent:'no',reducingMode:'target-concentration',reducingStockPercent:100,reducingAgentPercent:5});
for(const material of ['dna','multi-dna','sirna','multi-sirna','shrna-plasmid','dna-sirna'] as const)for(const mixing of ['single','two-tube'] as const){
 let plan=changeTransfectionMaterial(exampleTransfectionPlan(),material);plan=changeTransfectionMixing(plan,mixing);const group=plan.groups[0];group.rows=group.rows.map((row,i)=>({...row,name:`Component ${i+1}`,stock:'1',dose:row.kind==='sirna'?'10':'1'}));group.reagent={...newDoseReagent(),name:'Custom lipid',amount:'3'};group.a={mode:'final',value:'50'};group.b={mode:'final',value:'50'};group.single={mode:'final',value:'100'};group.order='Add components in the supplied custom order';
 add('transfection',`${material}-${mixing}`,{transfectionPlan:plan});
}
for(const rnaMode of ['each-nm','each-pmol','total-nm','total-pmol'] as const){const plan=changeTransfectionMaterial(exampleTransfectionPlan(),'multi-sirna'),g=plan.groups[0];g.rnaMode=rnaMode;g.totalRna='10';g.rows=g.rows.map((row,index)=>({...row,name:`siRNA ${index+1}`,stock:'20',dose:'1'}));g.reagent={...newDoseReagent(),name:'Custom lipid',amount:'1'};g.order='Combine A and B';add('transfection',rnaMode,{transfectionPlan:plan});}
for(const dnaMode of ['mass-ratio','molar-ratio'] as const){const plan=changeTransfectionMaterial(exampleTransfectionPlan(),'multi-dna'),g=plan.groups[0];g.dnaMode=dnaMode;g.totalDna='3';g.rows=g.rows.map((row,index)=>({...row,name:`DNA ${index+1}`,stock:'1',dose:'1',size:String((index+1)*3000)}));g.reagent={...newDoseReagent(),name:'Custom lipid',amount:'1'};g.order='Combine A and B';add('transfection',dnaMode,{transfectionPlan:plan});}
const mixRows=[{name:'Mix',volume:'18',premix:true},{name:'Template',volume:'2',premix:false}];add('master-mix','two groups',{groups:[{name:'A',reactions:'2',rows:mixRows},{name:'B',reactions:'3',rows:mixRows}],reactionVolumeUl:20,overagePercent:10});
writeFileSync('docs/calculator/ui-20260915/evidence/mode-cases.json',JSON.stringify(cases,null,2));console.log(cases.length+' synthetic mode fixtures');
