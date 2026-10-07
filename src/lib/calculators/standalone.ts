// One browser bundle exports the same calculation, quantity and presentation contracts.
export * from './calculator-engine';
export * from './plate-integration';
export * from './result-presentation';
export {compatibleUnits} from './quantities';
export {taskIconResource,taskPresentation} from './task-presentation';
export {parseAppearance,appearanceKey} from '../appearance';

export {copyCalculation} from './clipboard';

import lineIcons from './line-icon-svg.json';
export function taskLineSvg(id:string){const key=['fold-dilution','reagent-dosing'].includes(id)?'dilution':id;return lineIcons[key as keyof typeof lineIcons]??lineIcons.dilution;}

export {transfectionPlateValues} from './transfection';

import solidIcons from './solid-icon-svg.json';
import {calculatorToolIcons} from './solid-icon-map';
export function calculatorSolidSvg(name:string){return solidIcons[name as keyof typeof solidIcons]??solidIcons.calculator;}
export function taskSolidSvg(id:string){return calculatorSolidSvg(calculatorToolIcons[id as keyof typeof calculatorToolIcons]??'calculator');}
