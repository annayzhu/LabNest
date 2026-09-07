import {it,expect} from 'vitest';
import {calculate} from './calculator-engine';
import {resultClipboard,resultCsv} from './result-presentation';
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
