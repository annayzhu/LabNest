ALTER TABLE "Entry" ADD COLUMN "experimentId" TEXT, ADD COLUMN "experimentStepId" TEXT;
CREATE INDEX "Entry_experimentId_idx" ON "Entry"("experimentId");
CREATE INDEX "Entry_experimentStepId_idx" ON "Entry"("experimentStepId");
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_experimentStepId_fkey" FOREIGN KEY ("experimentStepId") REFERENCES "ExperimentStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
