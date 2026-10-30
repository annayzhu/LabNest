import { prisma } from './db';

/** Stock offered when a Protocol links a material to inventory ("/库存物料"); archived items are not offered. */
export function protocolInventoryChoices() {
  return prisma.inventoryItem.findMany({ where: { status: 'active' }, select: { id: true, name: true, unit: true, lotNumber: true }, orderBy: { name: 'asc' }, take: 500 });
}
