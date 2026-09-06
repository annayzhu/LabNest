import { legacyTaskMap } from "./task-definitions";
import type { CalculatorResult, CalculatorOutput } from "./calculator-engine";

export const calculatorStorageKey = "labnest.calculators.v1";
export const calculatorStateVersion = 2;
let calculatorStorageIssue = "";
let calculatorStorageWritable = true;

export type CalculatorHistoryEntry = {
  id: string;
  calculatorId: string;
  calculatorName: string;
  calculatorNameZh: string;
  createdAt: string;
  methodVersion: string;
  inputs: Record<string, unknown>;
  inputUnits?: Record<string, string>;
  outputs: CalculatorOutput[];
  warnings: string[];
  table?: CalculatorResult["table"];
  snapshot?: CalculatorResult;
  notes?: string[];
  sourceRecordId?: string;
  example?: boolean;
  context?: Record<string, unknown>;
};

export function restoreCalculatorResult(entry: CalculatorHistoryEntry): CalculatorResult {
  if(entry.snapshot)return structuredClone(entry.snapshot);
  return {
    calculatorId: entry.calculatorId, methodVersion: entry.methodVersion,
    outputs: entry.outputs, outputMap: Object.fromEntries(entry.outputs.map((output) => [output.key, output.value])),
    warnings: entry.warnings, table: entry.table,
    notes: entry.notes ?? ["Legacy history may omit detailed tables. Recalculate from the saved inputs to produce a new result."],
  };
}

export type CalculatorPreset = {
  methodVersion?: string;
  source?: string;
  id: string;
  calculatorId: string;
  name: string;
  createdAt: string;
  inputs: Record<string, unknown>;
};

export type CalculatorState = {
  version: typeof calculatorStateVersion;
  favorites: string[];
  favoritesConfigured?: boolean;
  presets: CalculatorPreset[];
  history: CalculatorHistoryEntry[];
  recent: Array<{ calculatorId: string; visitedAt: string; summary: string }>;
  drafts: Record<string, { inputs: Record<string, unknown>; updatedAt: string; example: boolean }>;
};

export function createEmptyCalculatorState(): CalculatorState {
  return { version: calculatorStateVersion, favorites: [], presets: [], history: [], recent: [], drafts: {} };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}

function isImageLikeKey(key: string) {
  return /(image|photo|preview|thumbnail|file|blob|bytes|pixels|canvas)/i.test(key);
}

function sanitizeValue(value: unknown, key = ""): unknown {
  if (isImageLikeKey(key)) return undefined;
  if (typeof Blob !== "undefined" && value instanceof Blob) return undefined;
  if (typeof ArrayBuffer !== "undefined" && (value instanceof ArrayBuffer || ArrayBuffer.isView(value))) return undefined;
  if (typeof value === "string" && /^(data:image\/|blob:)/i.test(value)) return undefined;
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item)).filter((item) => item !== undefined);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([childKey, childValue]) => [childKey, sanitizeValue(childValue, childKey)] as const)
        .filter(([, childValue]) => childValue !== undefined),
    );
  }
  return value;
}

export function sanitizePersistedInputs(inputs: Record<string, unknown>): Record<string, unknown> {
  return sanitizeValue(inputs) as Record<string, unknown>;
}

export function toggleFavorite(state: CalculatorState, calculatorId: string): CalculatorState {
  const hasFavorite = state.favorites.includes(calculatorId);
  return {
    ...state,
    favoritesConfigured: true,
    favorites: hasFavorite
      ? state.favorites.filter((id) => id !== calculatorId)
      : [...state.favorites, calculatorId],
  };
}

export function addHistoryEntry(state: CalculatorState, entry: CalculatorHistoryEntry): CalculatorState {
  const safeEntry = { ...entry, inputs: sanitizePersistedInputs(entry.inputs) };
  return { ...state, history: state.history.some(item => item.id === entry.id) ? state.history : [structuredClone(safeEntry), ...state.history] };
}

export function deleteHistoryEntry(state: CalculatorState, entryId: string): CalculatorState {
  return { ...state, history: state.history.filter((item) => item.id !== entryId) };
}

export function clearHistory(state: CalculatorState): CalculatorState {
  return { ...state, history: [] };
}

export function addPreset(state: CalculatorState, preset: CalculatorPreset): CalculatorState {
  const safePreset = { ...preset, inputs: sanitizePersistedInputs(preset.inputs) };
  return { ...state, presets: [safePreset, ...state.presets.filter((item) => item.id !== preset.id)] };
}

export function deletePreset(state: CalculatorState, presetId: string): CalculatorState {
  return { ...state, presets: state.presets.filter((item) => item.id !== presetId) };
}

export function parseCalculatorState(serialized: string | null): CalculatorState {
  if (!serialized) return createEmptyCalculatorState();
  try {
    const value = JSON.parse(serialized) as Partial<CalculatorState>;
    if ((value.version !== calculatorStateVersion && Number(value.version) !== 1) || !Array.isArray(value.favorites) || !Array.isArray(value.presets) || !Array.isArray(value.history)) {
      calculatorStorageWritable=false;calculatorStorageIssue="计算数据版本或结构无效；原始数据已保留 / Invalid stored data; original retained";return createEmptyCalculatorState();
    }
    return {
      version: calculatorStateVersion,
      favoritesConfigured: value.favoritesConfigured ?? value.favorites.length > 0,
      favorites: [...new Set(value.favorites.filter((item): item is string => typeof item === "string").map(id => legacyTaskMap[id]?.task ?? id))],
      presets: value.presets.filter(item => isPlainObject(item) && typeof item.id === "string" && typeof item.calculatorId === "string" && isPlainObject(item.inputs)) as CalculatorPreset[],
      history: value.history.filter(item => isPlainObject(item) && typeof item.id === "string" && Array.isArray(item.outputs) && Array.isArray(item.warnings) && isPlainObject(item.inputs)) as CalculatorHistoryEntry[],
      recent: Array.isArray(value.recent) ? value.recent.filter(item => isPlainObject(item) && typeof item.calculatorId === "string" && typeof item.summary === "string") : [],
      drafts: isPlainObject(value.drafts) ? Object.fromEntries(Object.entries(value.drafts).filter(([,draft]) => isPlainObject(draft) && isPlainObject(draft.inputs))) : {},
    };
  } catch {
    calculatorStorageWritable=false;calculatorStorageIssue="计算数据损坏；禁止覆盖，原始数据已保留 / Corrupt data; overwriting blocked";return createEmptyCalculatorState();
  }
}

export function loadCalculatorState(): CalculatorState {
  if (typeof window === "undefined") return createEmptyCalculatorState();
  try {
    calculatorStorageIssue = "";calculatorStorageWritable=true;
    const raw = window.localStorage.getItem(calculatorStorageKey);
    let needsBackup=false;try{needsBackup=Boolean(raw)&&JSON.parse(raw!).version!==calculatorStateVersion;}catch{needsBackup=true;}
    if (raw && needsBackup) {
      // Preserve exact bytes before any migration or edit; malformed data remains recoverable.
      const backupKey = `${calculatorStorageKey}.backup.${raw.length}.${hashText(raw)}`;
      if (!window.localStorage.getItem(backupKey)) window.localStorage.setItem(backupKey, raw);
    }
    return parseCalculatorState(raw);
  } catch {
    calculatorStorageIssue = "Browser storage is unavailable. Changes will remain only for this open page.";
    return createEmptyCalculatorState();
  }
}

export function saveCalculatorState(state: CalculatorState): boolean {
  if (typeof window === "undefined" || !calculatorStorageWritable) return false;
  try {
    window.localStorage.setItem(calculatorStorageKey, JSON.stringify(state));
    calculatorStorageIssue = "";
    return true;
  } catch {
    calculatorStorageIssue = "Browser storage is unavailable or full. Changes will remain only for this open page.";
    return false;
  }
}

export function getCalculatorStorageIssue() {
  return calculatorStorageIssue;
}

function hashText(text: string) { let hash=0;for(const char of text) hash=((hash<<5)-hash+char.charCodeAt(0))|0;return hash.toString(16); }
export function recordVisit(state: CalculatorState, calculatorId: string, summary: string): CalculatorState {
  return { ...state, recent: [{calculatorId,summary,visitedAt:new Date().toISOString()},...state.recent.filter(item=>item.calculatorId!==calculatorId)].slice(0,20) };
}
export function saveDraft(state: CalculatorState, calculatorId: string, inputs: Record<string, unknown>, example: boolean): CalculatorState {
  return { ...state, drafts: {...state.drafts,[calculatorId]:{inputs:sanitizePersistedInputs(inputs),example,updatedAt:new Date().toISOString()}} };
}
/** Returns only documented fixed-unit conversions; ambiguous legacy records stay unconfirmed. */
export function restoreLegacyInputs(id: string, inputs: Record<string,unknown>): {inputs: Record<string,unknown>; warning?: string} {
  if(id==='serial-dilution'&&!inputs.startingConcentrationUnit)return {inputs:{...inputs,startingConcentration:''},warning:'旧梯度浓度未注明单位，请确认后重新输入 / Legacy gradient concentration had no unit; confirm and re-enter'};
  if(['ic50-ec50','bradford-bca','elisa-4pl'].includes(id)&&!inputs.concentrationUnit)return {inputs:{...inputs,concentrationUnit:''},warning:'旧曲线浓度未注明单位，请确认 / Confirm concentration units for this legacy curve'};
  if (inputs.mode || !['dilution','reagent-dosing','fold-dilution'].includes(id)) return {inputs};
  if (id==='fold-dilution') return {inputs:{mode:'fold',stockFold:inputs.fold,targetFold:1,finalVolume:inputs.finalVolume,finalVolumeUnit:'mL'}};
  if (id==='reagent-dosing' && Number(inputs.stockToTargetFactor)===1000) return {inputs:{mode:'final',stockConcentration:inputs.stockConcentration,targetConcentration:inputs.targetConcentration,stockConcentrationUnit:'mM',targetConcentrationUnit:'µM',finalVolume:inputs.finalVolumeMl,finalVolumeUnit:'mL'}};
  return {inputs:{mode:'final',stockConcentration:'',targetConcentration:'',finalVolume:inputs.finalVolume??inputs.finalVolumeMl,finalVolumeUnit:inputs.volumeUnit??'mL'},warning:'旧浓度单位缺失或倍率冲突。原快照保留；请确认单位后重新输入浓度。 / Legacy units missing or conflicting. Original snapshot retained; confirm units and re-enter concentrations.'};
}
