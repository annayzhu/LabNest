import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {calculate} from './calculator-engine';
import {chooseUnit} from './unit-choice';
const output=(inputs:Record<string,unknown>,key:string)=>calculate({calculatorId:'dilution',inputs}).outputs.find(o=>o.key===key)!.value;
// The workspace starts from mM / µM / mL; the bench case is 1 mg/mL → 100 ng/mL in 12 mL.
const blank={mode:'final',stockConcentration:'',stockConcentrationUnit:'mM',targetConcentration:'',targetConcentrationUnit:'µM',finalVolume:'',finalVolumeUnit:'mL'};
describe('unit choice relabels the typed number',()=>{
 it('gives 1.2 µL stock whether the value or the unit is set first',()=>{
  let valueFirst:Record<string,unknown>={...blank,stockConcentration:'1',targetConcentration:'100',finalVolume:'12'};
  valueFirst=chooseUnit(valueFirst,'stockConcentrationUnit','mg/mL');
  valueFirst=chooseUnit(valueFirst,'targetConcentrationUnit','ng/mL');
  const unitFirst={...chooseUnit(chooseUnit(blank,'stockConcentrationUnit','mg/mL'),'targetConcentrationUnit','ng/mL'),stockConcentration:'1',targetConcentration:'100',finalVolume:'12'};
  expect(valueFirst).toEqual(unitFirst);
  expect(output(valueFirst,'stockVolumeUl')).toBeCloseTo(1.2,9);
 });
 it('keeps 100 when switching µg/mL to ng/mL and 12 when switching mL to µL',()=>{
  const typed={...blank,stockConcentration:'1',stockConcentrationUnit:'mg/mL',targetConcentration:'100',targetConcentrationUnit:'µg/mL',finalVolume:'12'};
  const relabelled=chooseUnit(chooseUnit(typed,'targetConcentrationUnit','ng/mL'),'finalVolumeUnit','µL');
  expect(relabelled).toMatchObject({targetConcentration:'100',finalVolume:'12'});
  expect(output(typed,'stockVolumeUl')).toBeCloseTo(1200,9);
  expect(output(relabelled,'stockVolumeUl')).toBeCloseTo(0.0012,12);
 });
 it('no calculator unit select rescales the number it labels',()=>{
  for(const file of ['CalculatorWorkspace.tsx','StructuredInputs.tsx','TransfectionEditor.tsx'])expect(readFileSync(new URL(`../../components/calculators/${file}`,import.meta.url),'utf8')).not.toMatch(/\bconvert\(/);
 });
});
