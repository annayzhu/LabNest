import {describe,it,expect} from 'vitest';
import {calculate} from './calculator-engine';
import {reactionMixSteps,reactionMixClipboard} from './reaction-mix-presentation';
import {resultCsv,resultClipboard} from './result-presentation';
const rows=[{name:'Master mix',volume:'5',premix:true},{name:'H2O',volume:'3.6',premix:true},{name:'GAPDH-F',volume:'0.2',premix:true},{name:'GAPDH-R',volume:'0.2',premix:true}];
export const mixFixture={reactionVolumeUl:9,overagePercent:10,groups:[{name:'G_mix',reactions:'24',rows}]};
describe('Reaction preparation public copy',()=>{
 it('matches the supplied single-group plain text without recomputing quantities',()=>{
  const result=calculate({calculatorId:'master-mix',inputs:mixFixture});const before=JSON.stringify(result);
  expect(resultClipboard(result,true)).toBe('独立配液组: 1\n各组预混总量（分别配制）: 237.6 µL\n\nG_mix: 预混液: 9 µL × 24\nMaster mix每反应: 5 µL; 预混; 整批: 132 µL;\nH2O每反应: 3.6 µL; 预混; 整批: 95.04 µL;\nGAPDH-F每反应: 0.2 µL; 预混; 整批: 5.28 µL;\nGAPDH-R每反应: 0.2 µL; 预混; 整批: 5.28 µL;');
  expect(JSON.stringify(result)).toBe(before);
 });
});

it('orders the supplied six steps from the same operations and knows wells only with plate context',()=>{
 const result=calculate({calculatorId:'master-mix',inputs:{...mixFixture,__context:{wellIds:['A1']}}});
 expect(reactionMixSteps(result,true)).toEqual(['G_mix配制','Master mix: 132 µL → G_mix','H2O: 95.04 µL → G_mix','GAPDH-F: 5.28 µL → G_mix','GAPDH-R: 5.28 µL → G_mix','G_mix预混液: 9 µL × 24 孔加样']);
 expect(reactionMixSteps(calculate({calculatorId:'master-mix',inputs:mixFixture}),true).at(-1)).toBe('G_mix预混液: 9 µL × 24 个反应');
});
it('keeps groups separate, uses actual separate additions, and converts displayed quantities without changing input',()=>{
 const result=calculate({calculatorId:'master-mix',inputs:{reactionVolumeUl:10,overagePercent:10,groups:[{name:'G_one',reactions:'24',rows:[...rows,{name:'Template',volume:'1',premix:false}]},{name:'G_two',reactions:'2',rows:[...rows,{name:'Template',volume:'1',premix:false}]}]}});
 const text=resultClipboard(result,true);
 expect(text).toContain('G_one: 预混液: 9 µL × 24\n预混总量: 237.6 µL');
 expect(text).toContain('G_two: 预混液: 9 µL × 2\n预混总量: 19.8 µL');
 expect(text.match(/Template每反应: 1 µL; 单独加入;/g)).toHaveLength(2);
 expect(reactionMixClipboard(result,true,'1')).not.toContain('G_one');
 expect(reactionMixSteps(result,true)).toContain('Template: 1 µL × 24 个反应，单独加入');
 const before=JSON.stringify(result.rawInputs),display={...result,displayUnits:{'table:perReactionUl':'mL','table:batchUl':'mL'}};
 expect(resultClipboard(display,true)).toContain('Master mix每反应: 0.005 mL; 预混; 整批: 0.132 mL;');
 expect(Number(resultCsv(display,true).split('\r\n')[1].split(',')[3].replaceAll('"',''))).toBeCloseTo(0.132,12);expect(JSON.stringify(display.rawInputs)).toBe(before);
 expect(resultClipboard(display,false)).not.toMatch(/预混|单独|Yes|是/);
 expect(resultClipboard({...display,status:'partial'},true)).toBe('');
});
