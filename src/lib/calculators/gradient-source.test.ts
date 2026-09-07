import {it,expect} from 'vitest';
import {calculate} from './calculator-engine';
import {resultClipboard,resultCsv} from './result-presentation';
it.each(['linear','custom'])('%s parallel tubes all take original stock across output channels',gradientMode=>{
 const r=calculate({calculatorId:'serial-dilution',inputs:{gradientMode,sourceConcentration:100,startingConcentration:10,endingConcentration:20,levels:2,customTargets:'10\n20',totalVolumePerLevel:100}});
 expect(r.table?.map(row=>[row.source,row.takeUl,row.diluentUl])).toEqual([['母液 / Stock',10,90],['母液 / Stock',20,80]]);
 expect(r.operations?.filter(o=>o.role==='transfer').map(o=>[o.source,o.quantity.value])).toEqual([['母液 / Stock',10],['母液 / Stock',20]]);
 for(const text of [resultClipboard(r,false),resultCsv(r,false)]){expect(text).toContain('母液 / Stock');expect(text).not.toContain('tube:1');}
});
it('serial transfers retain their previous-tube source, including separately prepared first tube',()=>{
 const r=calculate({calculatorId:'serial-dilution',inputs:{startingConcentration:50,dilutionFactor:2,levels:3,totalVolumePerLevel:100,firstSource:'stock',sourceConcentration:100}});
 expect(r.operations?.filter(o=>o.role==='transfer').map(o=>o.source)).toEqual(['母液 / Stock','Tube 1','Tube 2']);
});
