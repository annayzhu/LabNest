'use client';
import { createContext, useContext } from 'react';
import type { ProtocolSystems } from '@/lib/protocol-systems-schema';
import type { ProtocolSelection } from '@/lib/structured-protocol';

/** `focus: 'value'`: the chip was just inserted, so its first value field takes the caret. */
export type ChipTarget = { pos: number; id: string; anchor: HTMLElement; focus?: 'value' };
/** `column`: a recipe table header cell; `id` is its current "dimensionId:optionId" or empty. */
export type ConditionTarget = { kind: 'step' | 'block' | 'column'; id: string; anchor: HTMLElement; pos: number };
export type ProtocolMaterial = { name: string; rowId?: string };

/** Live authoring state shared by chips, steps and menus without remounting the editor. */
export type ProtocolEditorApi = {
  systems: ProtocolSystems | undefined;
  updateSystems: (update: (current: ProtocolSystems) => ProtocolSystems) => void;
  lens: ProtocolSelection;
  setLens: (lens: ProtocolSelection) => void;
  materials: ProtocolMaterial[];
  openChip: (target: ChipTarget) => void;
  /** Put another chip right after the chip at `pos`, e.g. a calculation's second result; returns where the new chip is. */
  insertChipAfter: (pos: number, parameterId: string) => number | null;
  openConditions: (target: ConditionTarget) => void;
  /** Step blocks may be added: the Steps section has no unconverted legacy content. */
  stepsAllowed: boolean;
};

export const ProtocolEditorContext = createContext<ProtocolEditorApi | null>(null);
export function useProtocolEditor() {
  const api = useContext(ProtocolEditorContext);
  if (!api) throw new Error('Protocol editor context is missing');
  return api;
}

