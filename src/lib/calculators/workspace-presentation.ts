import { operationCoverage } from './operations';
import type { CalculatorDefinition } from './catalog';

export type WorkspaceLayout = 'simple' | 'recipe' | 'batch' | 'curve' | 'transfection' | 'image';
const layouts: Record<string, WorkspaceLayout> = {
  'master-mix': 'recipe', 'media-recipe': 'recipe', 'buffer-recipe': 'recipe',
  'serial-dilution': 'batch', normalization: 'batch', 'wb-loading': 'batch', 'kill-curve': 'batch',
  'bradford-bca': 'curve', 'elisa-4pl': 'curve', 'ic50-ec50': 'curve',
  transfection: 'transfection', 'colony-counter': 'image',
};
export function workspaceLayout(id: string): WorkspaceLayout { return layouts[id] ?? 'simple'; }
export function hasPipettingSettings(id: string) { return !operationCoverage[id]?.startsWith('not-applicable'); }
export function fieldWidth(field: CalculatorDefinition['fields'][number]) {
  if (field.type === 'textarea') return 'wide';
  if (field.type === 'select' || field.type === 'text') return 'flexible';
  return field.unit === 'integer' || ['%', '×'].includes(field.unit ?? '') ? 'short' : 'quantity';
}
/** Compact layouts change presentation only; conditions remain in isFieldVisible. */
export function orderedFields(fields: CalculatorDefinition['fields'], layout: WorkspaceLayout) {
  return [...fields].sort((a, b) => {
    const priority = (field: typeof a) => field.type === 'select' ? 0 : field.type === 'textarea' && layout !== 'curve' ? 2 : 1;
    return priority(a) - priority(b);
  });
}
export const primaryOutputKeys:Record<string,string[]>={
 hemocytometer:['viableCellsPerMl','concentrationCellsPerMl'],seeding:['stockVolumeMl','mediumVolumeMl'],hydrogel:['hydrogelUl','cellStockUl','mediumUl'],
 viability:['liveCells','resuspensionVolumeMl'],od600:['estimatedCellsPerMl','estimatedTotalCells'],tm:['tmC'],
 'dna-rna-conversion':['concentrationNm','moles'],'bradford-bca':['sampleConcentration'],
 'master-mix':['dispenseUl','totalMasterMixUl','actualReactions'],
};
