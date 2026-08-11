"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { formActionErrorMessage } from "@/lib/form-actions";
import { inventoryLocationDeleteBlockers, inventoryLocationTypes } from "@/lib/inventory-location-lifecycle";

export type InventoryLocationActionState = { error?: string; success?: string };

const optionalText = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text || undefined;
};

const locationSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, "Location name is required.").max(120),
  type: z.enum(inventoryLocationTypes),
  parentLocationId: z.string().trim().optional(),
  temperature: z.string().trim().max(60).optional(),
  description: z.string().trim().max(1000).optional(),
});

const idSchema = z.object({ id: z.string().trim().min(1, "Location ID is required.") });
const deleteSchema = idSchema.extend({ confirmation: z.string().trim().min(1, "Enter the location name to confirm deletion.") });

function parseLocation(formData: FormData) {
  return locationSchema.parse({
    id: optionalText(formData.get("id")),
    name: formData.get("name"),
    type: formData.get("type"),
    parentLocationId: optionalText(formData.get("parentLocationId")),
    temperature: optionalText(formData.get("temperature")),
    description: optionalText(formData.get("description")),
  });
}

function revalidateInventoryLocations() {
  revalidatePath("/inventory");
  revalidatePath("/inventory/new");
  revalidatePath("/inventory/locations");
}

async function assertNameAvailable(tx: Prisma.TransactionClient, name: string, excludedId?: string) {
  const duplicate = await tx.inventoryLocation.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludedId ? { id: { not: excludedId } } : {}),
    },
    select: { name: true },
  });
  if (duplicate) throw new Error(`A location named “${duplicate.name}” already exists.`);
}

async function assertValidParent(tx: Prisma.TransactionClient, locationId: string | undefined, parentLocationId: string | undefined) {
  if (!parentLocationId) return;
  if (locationId === parentLocationId) throw new Error("A location cannot be its own parent.");

  let candidateId: string | null = parentLocationId;
  const visited = new Set<string>();
  while (candidateId) {
    if (visited.has(candidateId)) throw new Error("The location hierarchy already contains a cycle.");
    visited.add(candidateId);
    if (candidateId === locationId) throw new Error("This parent would create a circular location hierarchy.");
    const candidate: { parentLocationId: string | null; status: "active" | "inactive" | "archived" } | null = await tx.inventoryLocation.findUnique({
      where: { id: candidateId },
      select: { parentLocationId: true, status: true },
    });
    if (!candidate) throw new Error("The selected parent location no longer exists.");
    if (candidate.status !== "active") throw new Error("Choose an active parent location.");
    candidateId = candidate.parentLocationId;
  }
}

export async function createInventoryLocation(
  _previousState: InventoryLocationActionState,
  formData: FormData,
): Promise<InventoryLocationActionState> {
  try {
    const parsed = parseLocation(formData);
    await prisma.$transaction(async (tx) => {
      await assertNameAvailable(tx, parsed.name);
      await assertValidParent(tx, undefined, parsed.parentLocationId);
      const location = await tx.inventoryLocation.create({
        data: {
          name: parsed.name,
          type: parsed.type,
          parentLocationId: parsed.parentLocationId,
          temperature: parsed.temperature,
          description: parsed.description,
        },
      });
      await tx.activityLog.create({
        data: {
          action: "create",
          targetType: "inventory_location",
          targetId: location.id,
          metadataJson: { name: location.name, type: location.type, parentLocationId: location.parentLocationId },
        },
      });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The inventory location could not be created.") };
  }
  revalidateInventoryLocations();
  return { success: "Location created." };
}

export async function updateInventoryLocation(
  _previousState: InventoryLocationActionState,
  formData: FormData,
): Promise<InventoryLocationActionState> {
  try {
    const parsed = parseLocation(formData);
    if (!parsed.id) throw new Error("Location ID is required.");
    await prisma.$transaction(async (tx) => {
      const current = await tx.inventoryLocation.findUnique({ where: { id: parsed.id } });
      if (!current) throw new Error("This inventory location no longer exists.");
      await assertNameAvailable(tx, parsed.name, parsed.id);
      await assertValidParent(tx, parsed.id, parsed.parentLocationId);
      const updated = await tx.inventoryLocation.update({
        where: { id: parsed.id },
        data: {
          name: parsed.name,
          type: parsed.type,
          parentLocationId: parsed.parentLocationId ?? null,
          temperature: parsed.temperature ?? null,
          description: parsed.description ?? null,
        },
      });
      await tx.activityLog.create({
        data: {
          action: "update",
          targetType: "inventory_location",
          targetId: updated.id,
          metadataJson: {
            previous: { name: current.name, type: current.type, parentLocationId: current.parentLocationId, temperature: current.temperature },
            next: { name: updated.name, type: updated.type, parentLocationId: updated.parentLocationId, temperature: updated.temperature },
          },
        },
      });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The inventory location could not be saved.") };
  }
  revalidateInventoryLocations();
  return { success: "Location saved." };
}

export async function archiveInventoryLocation(
  _previousState: InventoryLocationActionState,
  formData: FormData,
): Promise<InventoryLocationActionState> {
  try {
    const { id } = idSchema.parse({ id: formData.get("id") });
    await prisma.$transaction(async (tx) => {
      const location = await tx.inventoryLocation.findUnique({ where: { id } });
      if (!location) throw new Error("This inventory location no longer exists.");
      const activeChildren = await tx.inventoryLocation.count({ where: { parentLocationId: id, status: "active" } });
      if (activeChildren) throw new Error(`Archive the ${activeChildren} active child location${activeChildren === 1 ? "" : "s"} first.`);
      if (location.status === "archived") return;
      await tx.inventoryLocation.update({ where: { id }, data: { status: "archived" } });
      await tx.activityLog.create({ data: { action: "archive", targetType: "inventory_location", targetId: id, metadataJson: { name: location.name } } });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The inventory location could not be archived.") };
  }
  revalidateInventoryLocations();
  return { success: "Location archived. Existing records still retain it." };
}

export async function restoreInventoryLocation(
  _previousState: InventoryLocationActionState,
  formData: FormData,
): Promise<InventoryLocationActionState> {
  try {
    const { id } = idSchema.parse({ id: formData.get("id") });
    await prisma.$transaction(async (tx) => {
      const location = await tx.inventoryLocation.findUnique({ where: { id }, include: { parentLocation: { select: { name: true, status: true } } } });
      if (!location) throw new Error("This inventory location no longer exists.");
      if (location.parentLocation && location.parentLocation.status !== "active") {
        throw new Error(`Restore parent location “${location.parentLocation.name}” first.`);
      }
      if (location.status === "active") return;
      await tx.inventoryLocation.update({ where: { id }, data: { status: "active" } });
      await tx.activityLog.create({ data: { action: "restore", targetType: "inventory_location", targetId: id, metadataJson: { name: location.name } } });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The inventory location could not be restored.") };
  }
  revalidateInventoryLocations();
  return { success: "Location restored." };
}

export async function deleteInventoryLocation(
  _previousState: InventoryLocationActionState,
  formData: FormData,
): Promise<InventoryLocationActionState> {
  try {
    const parsed = deleteSchema.parse({ id: formData.get("id"), confirmation: formData.get("confirmation") });
    await prisma.$transaction(async (tx) => {
      const location = await tx.inventoryLocation.findUnique({
        where: { id: parsed.id },
        include: { _count: { select: { items: true, itemsFrom: true, itemsTo: true, sampleEventsFrom: true, sampleEventsTo: true, childLocations: true } } },
      });
      if (!location) throw new Error("This inventory location no longer exists.");
      if (parsed.confirmation !== location.name) throw new Error(`Enter ${location.name} exactly to confirm permanent deletion.`);
      const blockers = inventoryLocationDeleteBlockers(location._count);
      if (blockers.length) throw new Error(`This location cannot be permanently deleted because it has ${blockers.join(", ")}. Archive it instead.`);
      await tx.inventoryLocation.delete({ where: { id: location.id } });
      await tx.activityLog.create({
        data: {
          action: "delete",
          targetType: "inventory_location",
          targetId: location.id,
          metadataJson: { name: location.name, type: location.type, temperature: location.temperature, description: location.description },
        },
      });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The inventory location could not be deleted.") };
  }
  revalidateInventoryLocations();
  return { success: "Unused location permanently deleted." };
}
