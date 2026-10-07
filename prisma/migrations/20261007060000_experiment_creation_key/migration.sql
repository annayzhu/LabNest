ALTER TABLE "Experiment" ADD COLUMN "creationKey" TEXT;
CREATE UNIQUE INDEX "Experiment_creationKey_key" ON "Experiment"("creationKey");
