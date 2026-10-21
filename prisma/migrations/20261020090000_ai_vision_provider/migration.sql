-- AlterTable
ALTER TABLE "AISettings" ADD COLUMN "visionProviderId" TEXT;

-- CreateIndex
CREATE INDEX "AISettings_visionProviderId_idx" ON "AISettings"("visionProviderId");

-- AddForeignKey
ALTER TABLE "AISettings" ADD CONSTRAINT "AISettings_visionProviderId_fkey" FOREIGN KEY ("visionProviderId") REFERENCES "AIProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
