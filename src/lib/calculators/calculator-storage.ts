import type { CalculatorOutput } from "./calculator-engine";

export const calculatorStorageKey = "labnest.calculators.v1";
export const calculatorStateVersion = 1;
let calculatorStorageIssue = "";

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
};

export type CalculatorPreset = {
  id: string;
  calculatorId: string;
  name: string;
  createdAt: string;
  inputs: Record<string, unknown>;
};

export type CalculatorState = {
  version: typeof calculatorStateVersion;
  favorites: string[];
  presets: CalculatorPreset[];
  history: CalculatorHistoryEntry[];
};

export function createEmptyCalculatorState(): CalculatorState {
  return { version: calculatorStateVersion, favorites: [], presets: [], history: [] };
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
    favorites: hasFavorite
      ? state.favorites.filter((id) => id !== calculatorId)
      : [...state.favorites, calculatorId],
  };
}

export function addHistoryEntry(state: CalculatorState, entry: CalculatorHistoryEntry): CalculatorState {
  const safeEntry = { ...entry, inputs: sanitizePersistedInputs(entry.inputs) };
  return { ...state, history: [safeEntry, ...state.history.filter((item) => item.id !== entry.id)].slice(0, 50) };
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
    if (value.version !== calculatorStateVersion || !Array.isArray(value.favorites) || !Array.isArray(value.presets) || !Array.isArray(value.history)) {
      return createEmptyCalculatorState();
    }
    return {
      version: calculatorStateVersion,
      favorites: value.favorites.filter((item): item is string => typeof item === "string"),
      presets: value.presets.slice(0, 100) as CalculatorPreset[],
      history: value.history.slice(0, 50) as CalculatorHistoryEntry[],
    };
  } catch {
    return createEmptyCalculatorState();
  }
}

export function loadCalculatorState(): CalculatorState {
  if (typeof window === "undefined") return createEmptyCalculatorState();
  try {
    calculatorStorageIssue = "";
    return parseCalculatorState(window.localStorage.getItem(calculatorStorageKey));
  } catch {
    calculatorStorageIssue = "Browser storage is unavailable. Changes will remain only for this open page.";
    return createEmptyCalculatorState();
  }
}

export function saveCalculatorState(state: CalculatorState): boolean {
  if (typeof window === "undefined") return false;
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
