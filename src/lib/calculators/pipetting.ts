import type {CalculatorResult} from './calculator-engine';
import {formatQuantity} from './result-presentation';
import {parseScalar,convert} from './quantities';
import {withLiquidOperations,type LiquidOperation} from './operations';
export type PipettingWarning={code:'below-minimum';operationId:string;component:string;sample?:string;basis:string;volumeUl:number;minimumUl:number;message:string};
/** Check semantic operations in canonical volumes; never infer a transfer from a display string. */
export function applyPipettingOptions(source:CalculatorResult, inputs:Record<string,unknown>):CalculatorResult {
 let result=withLiquidOperations(source,inputs);
 const operations=[...(result.operations??[])], warnings=[...result.warnings];
 if(inputs.pipetteStepUl!==undefined&&inputs.pipetteStepUl!==null&&inputs.pipetteStepUl!==''){
  const step=parseScalar(inputs.pipetteStepUl);if(step<=0)throw new Error('移液步进必须大于0 / Pipetting increment must be positive');
  if(!['dilution','reagent-dosing','fold-dilution'].includes(result.calculatorId)||inputs.mode==='add')warnings.push('此模式保留理论量；未应用步进舍入 / This mode retains theoretical values; rounding not applied.');
  else {
   const stock=Number(result.outputMap.stockVolumeUl),finalOutput=result.outputs.find(o=>o.key==='finalVolume');
   if(!finalOutput||typeof finalOutput.value!=='number'||!finalOutput.unit)throw new Error('Missing final volume');
   const final=convert(finalOutput.value,finalOutput.unit,'µL'),actual=Math.round(stock/step)*step;
   if(actual>final||(stock>0&&actual===0)||(final-stock>0&&final-actual===0))throw new Error('步进舍入使非零组分为0或超过总量；此方案不可执行 / Rounding removes a nonzero component or exceeds final volume');
   const deviation=stock===0?0:(actual/stock-1)*100;
   result={...result,table:[{component:'母液 / Stock',theoreticalUl:stock,actualUl:actual},{component:'稀释液 / Diluent',theoreticalUl:final-stock,actualUl:final-actual}],notes:[...result.notes,`移液步进 ${step} µL；实际浓度偏差 ${deviation.toPrecision(6)}% / Actual concentration deviation; outputs retain theory.`]};
   for(const [index,value] of [actual,final-actual].entries())operations.push({id:`actual:${index}`,component:index?'稀释液 / Diluent':'母液 / Stock',role:'add',basis:'actual',quantity:{value,unit:'µL',dimension:'volume'}});
  }
 }
 const structuredWarnings:PipettingWarning[]=[];
 if(inputs.pipetteMinimumUl!==undefined&&inputs.pipetteMinimumUl!==null&&inputs.pipetteMinimumUl!==''){
  const minimum=parseScalar(inputs.pipetteMinimumUl);if(minimum<=0)throw new Error('设备下限必须大于0 / Equipment minimum must be positive');
  for(const operation of operations){const volume=convert(operation.quantity.value,operation.quantity.unit,'µL');if(!Number.isFinite(volume)||volume<0)throw new Error('Invalid liquid operation');if(volume>0&&volume<minimum){const message=`${operation.sample?operation.sample+' · ':''}${operation.component} (${operation.basis}): ${formatQuantity(volume)} µL，低于所设 ${formatQuantity(minimum)} µL 下限 / below configured minimum. 调整制备规模，或评估中间液方案 / Adjust preparation scale or assess an intermediate dilution.`;structuredWarnings.push({code:'below-minimum',operationId:operation.id,component:operation.component,sample:operation.sample,basis:operation.basis,volumeUl:volume,minimumUl:minimum,message});warnings.push(message);}}
 }
 return {...result,operations,warnings:[...new Set(warnings)],structuredWarnings};
}
export type {LiquidOperation};
