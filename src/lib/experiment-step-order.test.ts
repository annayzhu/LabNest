import {expect,it} from 'vitest';
import {experimentStepOrder} from './experiment-step-order';
it('reorders saved IDs rather than transferring their completion, notes or timers',()=>{
 const steps=[{id:'a',groupKey:'v1'},{id:'b',groupKey:'v1'},{id:'c',groupKey:'v2'}];
 expect(experimentStepOrder(steps,['b','a','c'])).toEqual([{id:'b',order:1},{id:'a',order:2},{id:'c',order:1}]);
 expect(()=>experimentStepOrder(steps,['a','a','c'])).toThrow('exactly once');
 expect(()=>experimentStepOrder(steps,['c','a','b'])).toThrow('group');
});
