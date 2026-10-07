import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { calculate, getCalculatorDefinition } from './calculator-engine';
import { buildPlateLiquidPlan, plateReactionScopes } from './plate-integration';

const require = createRequire(import.meta.url);
const workspace = require('../../../public/tools/free-plate-layout/workspace-core.js');
const wells = Array.from({length:24},(_,i)=>`${String.fromCharCode(65+Math.floor(i/6))}${i%6+1}`);
const context = {workspaceId:'ws',plateId:'p1',plateName:'Plate 1',plateSize:24,wellIds:wells,requestId:'session-1'};
const rows = [{id:'mix',name:'SYBR',volume:'10',premix:true},{id:'f',name:'Forward',volume:'0.5',premix:true},{id:'r',name:'Reverse',volume:'0.5',premix:true},{id:'dna',name:'Template',volume:'1',premix:false,sampleId:'individual'}];
const mix = (inputs:Record<string,unknown>) => calculate({calculatorId:'master-mix',inputs});
const input = {samples:'24',replicates:'1',controls:'0',overagePercent:'10',reactionVolumeUl:'20',rows};

describe('main Calculator to saved plate preparation',()=>{
 it('retains editable rows, sources and warnings; pools only compatible premix bases with reserve once',()=>{
  const p1=buildPlateLiquidPlan(mix(input),context);
  const p2=buildPlateLiquidPlan(mix({...input,samples:'12'}),{...context,plateId:'p2',plateName:'Plate 2',wellIds:wells.slice(0,12)});
  expect(p1.input.rows).toEqual(rows);
  expect(p1.resultSnapshot.operations).toEqual(mix(input).operations);
  expect(p1.contributions.filter(c=>c.applyOverage!==false).reduce((n,c)=>n+c.preparedVolume,0)).toBeCloseTo(501.6);
  const summary=workspace.mergeLiquidContributions([...p1.contributions,...p2.contributions],{overagePercent:10});
  const premix=summary.groups.filter((g: {tubeRole:string})=>g.tubeRole==='premix');
  const separate=summary.groups.filter((g: {tubeRole:string})=>g.tubeRole==='separate');
  expect(premix).toHaveLength(1);
  expect(premix[0].components.reduce((n:number,c:{preparedVolume:number})=>n+c.preparedVolume,0)).toBeCloseTo(752.4);
  expect(separate).toHaveLength(2);
  expect(separate.reduce((n:number,g:{components:{preparedVolume:number}[]})=>n+g.components.reduce((s,c)=>s+c.preparedVolume,0),0)).toBe(36);
 });
 it('rejects reaction count mismatch, duplicate wells and partial or historical results',()=>{
  const result=mix(input);
  expect(()=>buildPlateLiquidPlan(result,{...context,wellIds:wells.slice(0,12)})).toThrow(/孔|well/i);
  expect(()=>buildPlateLiquidPlan(result,{...context,wellIds:[...wells.slice(0,23),wells[0]]})).toThrow(/孔|well/i);
  expect(()=>buildPlateLiquidPlan({...result,status:'partial'},context)).toThrow();
  expect(()=>buildPlateLiquidPlan({...result,methodVersion:'old'},context)).toThrow();
 });
 it('maps multiple groups to explicit, disjoint selected well ranges',()=>{
  const result=mix({...input,groups:[{name:'A',reactions:'10',rows},{name:'B',reactions:'14',rows}]});
  expect(plateReactionScopes(result,context).map(g=>[g.name,g.wellIds])).toEqual([['A',wells.slice(0,10)],['B',wells.slice(10)]]);
  const changed=mix({...input,rows:rows.map(r=>r.name==='SYBR'?{...r,volume:'9'}:r)});
  expect(buildPlateLiquidPlan(changed,context).contributions[0].groupKey).not.toBe(buildPlateLiquidPlan(mix(input),context).contributions[0].groupKey);
 });
 it('does not pool different concentration recipes with the same per-reaction volume',()=>{
  const concentration=(stock:string,target:string)=>({...input,rows:[{...rows[0],inputMode:'concentration',stock,target,stockUnit:'µM',targetUnit:'µM'},...rows.slice(1)]});
  const one=buildPlateLiquidPlan(mix(concentration('2','1')),context);
  const two=buildPlateLiquidPlan(mix(concentration('4','2')),context);
  expect(one.contributions[0].perWellVolume).toBe(two.contributions[0].perWellVolume);
  expect(one.contributions[0].groupKey).not.toBe(two.contributions[0].groupKey);
 });
 it('pools the same premix across distinct templates and group labels; templates retain board identity',()=>{
  const one=buildPlateLiquidPlan(mix({...input,groups:[{name:'Treatment A',reactions:'24',rows:rows.map(row=>row.premix?row:{...row,name:'Template A'})}]}),context);
  const two=buildPlateLiquidPlan(mix({...input,groups:[{name:'Treatment B',reactions:'24',rows:rows.map(row=>row.premix?row:{...row,name:'Template B'})}]}),{...context,plateId:'p2'});
  const summary=workspace.mergeLiquidContributions([...one.contributions,...two.contributions],{overagePercent:10});
  expect(summary.groups.filter((g:{tubeRole:string})=>g.tubeRole==='premix')).toHaveLength(1);
  expect(summary.groups.filter((g:{tubeRole:string})=>g.tubeRole==='separate')).toHaveLength(2);
 });
 it.each(['seeding','hydrogel','kill-curve','fold-dilution','moi'])('saves typed liquid operations and provenance for %s without copying display labels',calculatorId=>{
  const example=structuredClone(getCalculatorDefinition(calculatorId).exampleInputs);
  if('wells' in example)example.wells='24';
  if('plates' in example)example.plates='1';
  const result=calculate({calculatorId,inputs:example});
  const plan=buildPlateLiquidPlan(result,context);
  expect(plan.input).toEqual(example);
  expect(plan.resultSnapshot.operations).toEqual(result.operations);
  expect(plan.contributions.every(c=>Number.isFinite(c.baseVolume)&&c.source&&c.scopeWellIds.length)).toBe(true);
  expect(plan.resultSnapshot.warnings).toEqual(result.warnings);
 });
});

describe('one effective preparation per plate without deleting old inputs',()=>{
 it('invalidates generated summaries when removing or duplicating boards',()=>{
  let ws=workspace.addPlate(workspace.createWorkspace());
  ws.latestLiquidSummary={groups:[{sources:ws.plates.map((p:{id:string})=>({plateId:p.id}))}]};
  expect(workspace.removePlate(ws,ws.plates[1].id).latestLiquidSummary).toBeNull();
  expect(workspace.duplicatePlate(ws,ws.plates[0].id).latestLiquidSummary).toBeNull();
 });
 it('migrates multiple saved plans, preserves archive through JSON and excludes stale plans',()=>{
  const old={id:'old',name:'old recipe',updatedAt:'2026-01-01',input:{retain:'original'}};
  const newer={id:'new',name:'new recipe',updatedAt:'2026-02-01'};
  const stale={id:'stale',updatedAt:'2026-03-01',status:'stale'};
  const migrated=workspace.normalizeWorkspace({version:2,id:'ws',plates:[{id:'p1',liquidPlans:[old,newer,stale]}],latestLiquidSummary:{obsolete:true}});
  expect(migrated.plates[0].liquidPlans.map((p:{id:string})=>p.id)).toEqual(['new']);
  expect(migrated.latestLiquidSummary).toBeNull();
  const restored=workspace.normalizeWorkspace(JSON.parse(JSON.stringify(migrated)));
  expect(restored.plates[0].archivedLiquidPlans.find((p:{id:string})=>p.id==='old').input).toEqual({retain:'original'});
  expect(workspace.usableLiquidPlan(stale)).toBe(false);
  const published=workspace.publishLiquidPlan(restored.plates[0],{id:'replacement',name:'replacement'});
  expect(published.liquidPlans).toHaveLength(1);
  expect(published.liquidPlans[0].id).toBe('new');
  expect(published.archivedLiquidPlans).toHaveLength(2);
 });
});
