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
