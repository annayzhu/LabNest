'use client';
import { createContext, useContext } from 'react';
import type { ProtocolSystems } from '@/lib/protocol-systems-schema';
import type { ProtocolSelection } from '@/lib/structured-protocol';
import type { PopoverAnchor } from './popover';

/** `focus: 'value'`: the chip was just inserted, so its first value field takes the caret; `'stock'`: its name field searches stock. */
export type ChipTarget = { pos: number; id: string; anchor: HTMLElement; focus?: 'value' | 'stock' };
/** `column`: a recipe table header cell; `id` is its current "dimensionId:optionId" or empty. */
export type ConditionTarget = { kind: 'step' | 'block' | 'column'; id: string; anchor: PopoverAnchor; pos: number };
export type ProtocolMaterial = { name: string; rowId?: string };
/** An active stock item a material can be linked to. */
export type ProtocolStockItem = { id: string; name: string; unit: string; lotNumber: string | null };

/** Live authoring state shared by chips, steps and menus without remounting the editor. */
export type ProtocolEditorApi = {
  systems: ProtocolSystems | undefined;
  updateSystems: (update: (current: ProtocolSystems) => ProtocolSystems) => void;
  lens: ProtocolSelection;
  setLens: (lens: ProtocolSelection) => void;
  materials: ProtocolMaterial[];
  inventory: ProtocolStockItem[];
  /** Add a row to the materials table for a linked stock item; returns its row identity, or nothing without a table. */
  addMaterial: (name: string) => string | undefined;
  openChip: (target: ChipTarget) => void;
  /** Scroll to the first chip, in reading order, of any of these parameters and open its editor. */
  revealParameter: (parameterIds: string[]) => void;
  /** Put another chip right after the chip at `pos`, e.g. a calculation's second result; returns where the new chip is. */
  insertChipAfter: (pos: number, parameterId: string) => number | null;
  /** Step blocks may be added: the Steps section has no unconverted legacy content. */
  stepsAllowed: boolean;
};

export const ProtocolEditorContext = createContext<ProtocolEditorApi | null>(null);
export function useProtocolEditor() {
  const api = useContext(ProtocolEditorContext);
  if (!api) throw new Error('Protocol editor context is missing');
  return api;
}

