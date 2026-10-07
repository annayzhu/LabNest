import {describe,it,expect} from 'vitest';
import {hasRestorableInputs} from './input-draft';
describe('calculator draft availability',()=>{
 it('recognizes nested transfection plans and retains scalar/row drafts',()=>{
  expect(hasRestorableInputs({transfectionPlan:{groups:[{rows:[{name:'中文DNA',dose:'1'}]}]}})).toBe(true);
  expect(hasRestorableInputs({samples:0})).toBe(true);
  expect(hasRestorableInputs({rows:[{name:'Buffer',volume:'2'}]})).toBe(true);
 });
 it('does not offer a draft for display metadata, units or empty values alone',()=>{
  expect(hasRestorableInputs({__displayUnits:{volume:'mL'},startingConcentrationUnit:'µM',rows:[],name:' ',nested:{value:''}})).toBe(false);
 });
});
