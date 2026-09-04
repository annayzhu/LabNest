ALTER TABLE "ExperimentStep"
ADD COLUMN "deviationType" TEXT,
ADD COLUMN "deviationImpact" TEXT,
ADD COLUMN "deviationAuthor" TEXT,
ADD COLUMN "deviationAt" TIMESTAMP(3);

ALTER TABLE "Result"
ADD COLUMN "experimentStepId" TEXT,
ADD COLUMN "observedAt" TIMESTAMP(3),
ADD COLUMN "sampleLabel" TEXT,
ADD COLUMN "expectedMin" DOUBLE PRECISION,
ADD COLUMN "expectedMax" DOUBLE PRECISION,
ADD COLUMN "clientMutationId" TEXT,
ADD COLUMN "deviceCreatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Result_clientMutationId_key" ON "Result"("clientMutationId");
CREATE INDEX "Result_experimentStepId_idx" ON "Result"("experimentStepId");
ALTER TABLE "Result" ADD CONSTRAINT "Result_experimentStepId_fkey" FOREIGN KEY ("experimentStepId") REFERENCES "ExperimentStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
