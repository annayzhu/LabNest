-- 质粒工作台 B 批 (PLAN §10.3): a plasmid product's expected structure (Q360) and the lab's own feature-library
-- entries (Q362). Additive only: two new tables.

-- CreateTable
CREATE TABLE "PlasmidExpectedStructure" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "elementsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlasmidExpectedStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlasmidLibraryEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'misc_feature',
    "kind" TEXT NOT NULL,
    "sequence" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlasmidLibraryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlasmidExpectedStructure_productId_key" ON "PlasmidExpectedStructure"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PlasmidLibraryEntry_kind_sequence_key" ON "PlasmidLibraryEntry"("kind", "sequence");

-- AddForeignKey
ALTER TABLE "PlasmidExpectedStructure" ADD CONSTRAINT "PlasmidExpectedStructure_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
