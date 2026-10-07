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
 it('offers retained alternate mode inputs even when the active draft is empty',()=>{
  expect(hasRestorableInputs({samples:'',rows:[],__mixModeDrafts:{multiple:[{name:'处理B',reactions:'4',rows:[{name:'DNA',volume:'2'}]}]}})).toBe(true);
  expect(hasRestorableInputs({__wbSampleDraft:[{id:'样本A',concentration:'2',available:'20'}]})).toBe(true);
 });
});
