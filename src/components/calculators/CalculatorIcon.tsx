import {solidIconShapes} from './solid-icon-shapes';

export type CalculatorIconName=keyof typeof solidIconShapes;
/** The Calculator tool's own icon wherever the tool is offered: a lab pipette, not a pocket calculator. */
export const calculatorToolIcon:CalculatorIconName='pipette';
export {calculatorToolIcons} from '@/lib/calculators/solid-icon-map';

export function CalculatorIcon({name,size=20,className=''}:{name:CalculatorIconName;size?:number;className?:string}){
 return <svg data-calculator-icon={name} aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={`calculator-icon ${className}`}>{solidIconShapes[name]}</svg>;
}
