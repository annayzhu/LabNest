import { legacyTaskMap } from "./task-definitions";
import type { CalculatorResult, CalculatorOutput } from "./calculator-engine";

export const calculatorStorageKey = "labnest.calculators.v1";
export const calculatorStateVersion = 2;
let calculatorStorageIssue = "";
type ReadSession = { status: 'ready' | 'protected'; raw: string | null; value: CalculatorState | null; reason: string };
const sessions = new WeakMap<Storage, ReadSession>();
const sourceBytes = Symbol('calculator-source-bytes');
type TrackedState = CalculatorState & { [sourceBytes]?: string | null };
let activeSession: ReadSession | undefined;

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
  if(entry.snapshot){const snapshot=structuredClone(entry.snapshot);if(entry.calculatorId==='wb-loading'&&snapshot.table?.some(row=>!('reducingAgentUl' in row)))snapshot.notes=[...snapshot.notes,'不完整旧快照：未记录独立还原剂列；重算将产生新记录 / Incomplete legacy snapshot: separate reducing agent not recorded.'];return snapshot;}
  return {
    calculatorId: entry.calculatorId, methodVersion: entry.methodVersion,
    outputs: entry.outputs, outputMap: Object.fromEntries(entry.outputs.map((output) => [output.key, output.value])),
    warnings: entry.warnings, table: entry.table,
    notes: entry.calculatorId==='wb-loading'?[...(entry.notes??[]),"不完整旧快照：未记录独立还原剂列 / Incomplete legacy WB snapshot; separate reducing agent not recorded"]:entry.notes ?? ["Legacy history may omit detailed tables. Recalculate from the saved inputs to produce a new result."],
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

function parseStateStrict(serialized: string | null): CalculatorState {
  if (serialized === null) return createEmptyCalculatorState();
  try {
    const value = JSON.parse(serialized) as Partial<CalculatorState>;
    if ((value.version !== calculatorStateVersion && Number(value.version) !== 1) || !Array.isArray(value.favorites) || !Array.isArray(value.presets) || !Array.isArray(value.history)) {
      throw new Error("unsupported-version");
    }
    // Refuse partial parsing: silently dropping one malformed record would permit data loss on the next save.
    if(value.favorites.some(item=>typeof item!=="string") || value.presets.some(item=>!isPlainObject(item)||typeof item.id!=="string"||typeof item.calculatorId!=="string"||!isPlainObject(item.inputs)) || value.history.some(item=>!isPlainObject(item)||typeof item.id!=="string"||!Array.isArray(item.outputs)||!Array.isArray(item.warnings)||!isPlainObject(item.inputs)) || (value.recent!==undefined&&(!Array.isArray(value.recent)||value.recent.some(item=>!isPlainObject(item)||typeof item.calculatorId!=="string"||typeof item.summary!=="string"))) || (value.drafts!==undefined&&(!isPlainObject(value.drafts)||Object.values(value.drafts).some(draft=>!isPlainObject(draft)||!isPlainObject(draft.inputs)))))throw new Error("invalid-record");
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
    throw new Error("parse-failed");
  }
}

export function parseCalculatorState(serialized: string | null): CalculatorState {
  try { return parseStateStrict(serialized); } catch { return createEmptyCalculatorState(); }
}
function protect(session: ReadSession, reason: string) {
  session.status = 'protected'; session.reason = reason;
  calculatorStorageIssue = '已有计算数据暂时无法安全保存，原数据已保留；可临时计算，请重试读取与恢复。 / Existing calculation data cannot be saved safely; original retained. Retry recovery. (' + reason + ')';
}
/** Protection is sticky for this Storage instance; only explicit recovery may unlock it. */
export function loadCalculatorState(retry = false): CalculatorState {
  if (typeof window === 'undefined') return createEmptyCalculatorState();
  let storage: Storage;
  try { storage = window.localStorage; } catch { calculatorStorageIssue='Storage unavailable; temporary calculation only'; return createEmptyCalculatorState(); }
  const session = sessions.get(storage) ?? {status:'protected',raw:null,value:null,reason:'unread'} as ReadSession;
  sessions.set(storage,session); activeSession=session;
  if(session.reason!=='unread' && session.status==='protected' && !retry) return session.value ?? createEmptyCalculatorState();
  let phase='read-failed';
  try {
    const raw=storage.getItem(calculatorStorageKey);session.raw=raw;
    phase='parse-failed';
    if(raw!==null) {
      const parsed=JSON.parse(raw);
      if(![1,2].includes(parsed?.version))throw new Error('unsupported-version');
      if(parsed.version!==calculatorStateVersion){
        phase='backup-failed';
        const key=`${calculatorStorageKey}.backup.${raw.length}.${hashText(raw)}`;
        const backup=storage.getItem(key);
        if(backup!==null && backup!==raw)throw new Error('backup-conflict');
        if(backup===null)storage.setItem(key,raw);
        if(storage.getItem(key)!==raw)throw new Error('backup-verification-failed');
      }
    }
    phase='migration-failed';
    const value=parseStateStrict(raw) as TrackedState;
    // Symbols survive immutable object spreads but are never serialized as history data.
    value[sourceBytes]=raw;session.value=value;session.status='ready';session.reason='';calculatorStorageIssue='';
    return value;
  } catch(error) { protect(session, error instanceof Error && error.message==='unsupported-version'?'unsupported-version':phase);return session.value ?? createEmptyCalculatorState(); }
}
export function saveCalculatorState(state: CalculatorState): boolean {
  if(typeof window==='undefined')return false;
  try {
    const storage=window.localStorage,session=sessions.get(storage);
    if(!session || session.status!=='ready')return false;
    activeSession=session;
    const raw=storage.getItem(calculatorStorageKey);
    if(!(sourceBytes in state) || (state as TrackedState)[sourceBytes]!==raw){protect(session,'concurrent-change');return false;}
    const serialized=JSON.stringify(state);
    parseStateStrict(serialized);
    storage.setItem(calculatorStorageKey,serialized);
    if(storage.getItem(calculatorStorageKey)!==serialized){protect(session,'write-verification-failed');return false;}
    (state as TrackedState)[sourceBytes]=serialized;session.raw=serialized;session.value=state;calculatorStorageIssue='';return true;
  } catch { if(activeSession)protect(activeSession,'write-failed');return false; }
}
export function getCalculatorStorageIssue() { return calculatorStorageIssue; }
export function getCalculatorRawBackup(): string | null { return activeSession?.raw ?? null; }
export function retryCalculatorStorage(): CalculatorState { return loadCalculatorState(true); }

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

/** Normalize legacy aliases before sorting/deduplication, including imported history. */
export function recentCalculators(recent:CalculatorState['recent']){
 const seen=new Set<string>();
 return [...recent].sort((a,b)=>(Date.parse(b.visitedAt)||0)-(Date.parse(a.visitedAt)||0)).map(item=>({...item,calculatorId:legacyTaskMap[item.calculatorId]?.task??item.calculatorId})).filter(item=>{if(seen.has(item.calculatorId))return false;seen.add(item.calculatorId);return true;});
}
