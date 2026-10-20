import {it,expect} from 'vitest';
import {calculate} from './calculator-engine';
import {formatQuantity,resultClipboard,resultCsv} from './result-presentation';
import {recentCalculators} from './calculator-storage';
it('copies only the named scalar with its selected unit without mutating provenance',()=>{
 const result=calculate({calculatorId:'serial-dilution',inputs:{gradientMode:'linear',sourceConcentration:100,startingConcentration:10,endingConcentration:20,levels:2,totalVolumePerLevel:100}});
 const scalar={...result,table:undefined,outputs:[{key:'volume',label:'Volume',labelZh:'体积',value:1000,unit:'µL'}],displayUnits:{volume:'mL'}};
 const before=JSON.stringify(scalar);expect(resultClipboard(scalar,true)).toBe('体积: 1 mL');expect(JSON.stringify(scalar)).toBe(before);
 expect(resultClipboard({...scalar,status:'partial'},true)).toBe('');
 expect(resultClipboard({...scalar,outputs:[{...scalar.outputs[0],value:NaN}]},true)).toBe('');
});
it('preserves parallel tube sources and amounts while leaving audit data in exports',()=>{
 const r=calculate({calculatorId:'serial-dilution',inputs:{gradientMode:'linear',sourceConcentration:100,startingConcentration:10,endingConcentration:20,levels:2,totalVolumePerLevel:100}});
 const text=resultClipboard(r,false);expect(text.match(/母液 \/ Stock/g)).toHaveLength(2);expect(text).toContain('90');expect(text).toContain('80');
 for(const key of ['Operations','Context','Inputs','Warnings','Assumptions',r.methodVersion,'Pipetting check'])expect(text).not.toContain(key);
 expect(resultCsv(r,false)).toContain(r.methodVersion);
});
it('sorts imported recents by time and deduplicates legacy aliases before limiting',()=>{
 const rows=[{calculatorId:'dilution',visitedAt:'2026-01-01',summary:'old'},{calculatorId:'molarity',visitedAt:'2026-01-03',summary:''},{calculatorId:'dilution',visitedAt:'2026-01-04',summary:'new'}];
 expect(recentCalculators(rows).map(r=>r.calculatorId)).toEqual(['dilution','molarity']);expect(rows).toHaveLength(3);
});

it('keeps a nonzero picogram conversion in the displayed and copied result',()=>{
 const result=calculate({calculatorId:'unit-converter',inputs:{value:1,fromUnit:'pg',toUnit:'kg'}});
 const raw=result.outputs[0].value as number;
 expect(raw).toBeCloseTo(1e-15,25);
 expect(Number(formatQuantity(raw))).toBe(1e-15);
 expect(resultClipboard(result,false)).toContain('1e-15 kg');
 for(const value of [1e-13,-1e-15,Number.MIN_VALUE])expect(Number(formatQuantity(value))).not.toBe(0);
 expect([0,0.005,12.345,1e10].map(formatQuantity)).toEqual(['0','0.005','12.35','1.00e+10']);
});
