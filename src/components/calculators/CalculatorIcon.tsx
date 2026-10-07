import {solidIconShapes} from './solid-icon-shapes';

export type CalculatorIconName=keyof typeof solidIconShapes;
export {calculatorToolIcons} from '@/lib/calculators/solid-icon-map';

export function CalculatorIcon({name,size=20,className=''}:{name:CalculatorIconName;size?:number;className?:string}){
 return <svg data-calculator-icon={name} aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={`calculator-icon ${className}`}>{solidIconShapes[name]}</svg>;
}
