import {createElement} from 'react';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ResultPanel} from './ResultPanel';
import {calculate,getCalculatorDefinition} from '@/lib/calculators/calculator-engine';
describe('calculator result reading order',()=>{
 it('shows estimated Tm before sequence statistics and omits irrelevant pipetting UI',()=>{
  const d=getCalculatorDefinition('tm');const result=calculate({calculatorId:d.id,inputs:d.exampleInputs});
  const html=renderToStaticMarkup(createElement(ResultPanel,{result,zh:false,onSave:()=>{},disabled:true}));
  expect(html.indexOf('Estimated Tm')).toBeLessThan(html.indexOf('Primer length'));
  expect(html).not.toContain('Minimum not set');expect(html).not.toContain('No pipetting operation');
 });
});

describe('retained detailed results',()=>{
 it('keeps original concentration and availability accessible for normalization',()=>{
  const d=getCalculatorDefinition('normalization');
  const result=calculate({calculatorId:d.id,inputs:d.exampleInputs});
  const html=renderToStaticMarkup(createElement(ResultPanel,{result,zh:false,onSave:()=>{},disabled:true}));
  expect(html).toContain('Full results');
  expect(html).toContain('Original concentration');
  expect(html).toContain('Available (µL)');
 });
 it('rejects duplicate independent mix names before rendering any pooled result',()=>{
  const rows=[{name:'DNA',volume:'1',premix:false}];
  expect(()=>calculate({calculatorId:'master-mix',inputs:{reactionVolumeUl:10,overagePercent:10,groups:[{name:'Same',reactions:2,rows},{name:'Same',reactions:3,rows}]}})).toThrow(/duplicate/i);
 });
});
