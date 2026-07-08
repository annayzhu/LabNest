import type { InventoryItem, SampleLifecycleEvent, SampleProfile } from "./types";

export function getSampleAliquots<TInventoryItem extends Pick<InventoryItem, "entityId">>(
  sample: Pick<SampleProfile, "entityId">,
  inventoryItems: TInventoryItem[],
): TInventoryItem[] {
  return inventoryItems.filter((item) => item.entityId === sample.entityId);
}

export function calculateSampleQuantityFromAliquots(
  sample: Pick<SampleProfile, "entityId" | "unit">,
  inventoryItems: Pick<InventoryItem, "entityId" | "currentQuantity" | "unit">[],
): number {
  return getSampleAliquots(sample, inventoryItems).reduce((total, item) => {
    if (item.unit !== sample.unit) {
      throw new Error(`Sample aliquot unit mismatch: expected ${sample.unit}, received ${item.unit}.`);
    }

    return Number((total + item.currentQuantity).toFixed(6));
  }, 0);
}

export function sortSampleEventsByTime(events: SampleLifecycleEvent[]): SampleLifecycleEvent[] {
  return [...events].sort(
    (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  );
}

export function countActionableSampleWarnings(samples: Pick<SampleProfile, "warnings">[]): number {
  return samples.reduce(
    (count, sample) => count + sample.warnings.filter((warning) => warning.severity === "action").length,
    0,
  );
}
