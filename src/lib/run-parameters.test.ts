import {describe,it,expect} from 'vitest';
import {runParameterKeys,validateRunParameters} from './run-parameters';
describe('Run parameter editing',()=>{
 const snapshot={versions:[{contentJson:{blocks:[{rows:[['{{ tube_count }}','{{pending}}']]}]}}]};
 it('finds table placeholders and preserves blank unresolved values',()=>{expect(runParameterKeys(snapshot)).toEqual(['pending','tube_count']);expect(validateRunParameters(snapshot,{tube_count:'12',pending:''})).toEqual({tube_count:'12'});});
 it('rejects arbitrary keys and non scalar input without changing snapshot',()=>{const original=JSON.stringify(snapshot);expect(()=>validateRunParameters(snapshot,{other:'2'})).toThrow();expect(()=>validateRunParameters(snapshot,{tube_count:{value:3}})).toThrow();expect(JSON.stringify(snapshot)).toBe(original);});
});
