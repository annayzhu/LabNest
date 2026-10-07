import {describe,it,expect} from 'vitest';
import {switchReactionMixMode} from './reaction-mix-mode';
import {calculate} from './calculator-engine';

describe('reaction mix mode drafts',()=>{
 it('returns to the original single reaction counts and preserves every independently edited group',()=>{
  const single={samples:'3',replicates:'2',controls:'1',reactionVolumeUl:10,overagePercent:10,rows:[{name:'DNA',volume:'1',premix:false}]};
  const multi=switchReactionMixMode(single,'multiple');
  multi.groups=[{name:'A',reactions:'8',rows:[{name:'Buffer',volume:'2',premix:true}]},{name:'B',reactions:'4',rows:[{name:'DNA',volume:'3',premix:false}]}];
  const back=switchReactionMixMode(multi,'single');
  expect([back.samples,back.replicates,back.controls]).toEqual(['3','2','1']);
  expect(back.rows).toEqual(single.rows);
  expect(calculate({calculatorId:'master-mix',inputs:back}).outputMap.actualReactions).toBe(7);
  const restored=switchReactionMixMode(back,'multiple');
  expect(restored.groups).toEqual(multi.groups);
  expect(multi.groups).toHaveLength(2);
 });
 it('requires an explicit source group for a multi-group preset without a single draft',()=>{
  const multiple={reactionVolumeUl:10,overagePercent:0,groups:[{name:'A',reactions:'2',rows:[]},{name:'B',reactions:'4',rows:[{name:'DNA',volume:'1',premix:false}]}]};
  expect(()=>switchReactionMixMode(multiple,'single')).toThrow('Choose');
  const single=switchReactionMixMode(multiple,'single',1);
  expect(single.samples).toBe('4');
  expect(single.rows).toEqual(multiple.groups[1].rows);
  expect(single.__mixSingleSource).toBe('B');
  expect(switchReactionMixMode(single,'multiple').groups).toEqual(multiple.groups);
 });
});
