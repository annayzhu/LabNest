import type {CalculatorResult} from './calculator-engine';
import {parseScalar,convert} from './quantities';
/** Rounding is an explicit, separately reported preparation, never an in-place mutation of theory. */
export function applyPipettingOptions(result:CalculatorResult, inputs:Record<string,unknown>):CalculatorResult {
 const warnings=[...result.warnings];
 const limit=inputs.pipetteMinimumUl?parseScalar(inputs.pipetteMinimumUl):undefined;
 if(limit!==undefined){if(limit<=0)throw new Error('设备下限必须大于0 / Equipment minimum must be positive');const volumes=[...result.outputs.filter(output=>output.unit==='µL'&&typeof output.value==='number').map(output=>Number(output.value)),...(result.table??[]).flatMap(row=>Object.entries(row).filter(([key,value])=>/Ul$/.test(key)&&typeof value==='number').map(([,value])=>Number(value)))];if(volumes.some(value=>value>0&&value<limit))warnings.push(`部分移液量低于所设设备下限 ${limit} µL / Some transfers are below the configured equipment minimum.`);}
 if(!inputs.pipetteStepUl)return {...result,warnings};
 const step=parseScalar(inputs.pipetteStepUl);if(step<=0)throw new Error('移液步进必须大于0 / Pipetting increment must be positive');
 if(!['dilution','reagent-dosing','fold-dilution'].includes(result.calculatorId)||inputs.mode==='add')return {...result,warnings:[...warnings,'此模式保留理论量；未应用步进舍入 / This mode retains theoretical values; rounding not applied.']};
 const stock=Number(result.outputMap.stockVolumeUl), finalOutput=result.outputs.find(output=>output.key==='finalVolume');
 if(!finalOutput||typeof finalOutput.value!=='number'||!finalOutput.unit)return {...result,warnings};
 const final=convert(finalOutput.value,finalOutput.unit,'µL'),actual=Math.round(stock/step)*step;
 if(actual>final)throw new Error('舍入后的母液量超过总体积 / Rounded stock exceeds final volume');
 const deviation=stock===0?0:(actual/stock-1)*100;
 return {...result,warnings,table:[{component:'母液 / Stock',theoreticalUl:stock,actualUl:actual},{component:'稀释液 / Diluent',theoreticalUl:final-stock,actualUl:final-actual}],notes:[...result.notes,`移液步进 ${step} µL；实际浓度相对理论值偏差 ${deviation.toPrecision(6)}% / Actual concentration deviation after explicit rounding. 原始输出保留理论值 / Outputs retain theory.`]};
}
