CREATE TABLE "ExperimentStepEvent" (
  "id" TEXT NOT NULL,
  "experimentStepId" TEXT NOT NULL,
  "experimentId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "clientMutationId" TEXT,
  "deviceCreatedAt" TIMESTAMP(3),
  "payloadJson" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExperimentStepEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExperimentStepEvent_clientMutationId_key" ON "ExperimentStepEvent"("clientMutationId");
CREATE INDEX "ExperimentStepEvent_experimentStepId_createdAt_idx" ON "ExperimentStepEvent"("experimentStepId", "createdAt");
CREATE INDEX "ExperimentStepEvent_experimentId_createdAt_idx" ON "ExperimentStepEvent"("experimentId", "createdAt");
ALTER TABLE "ExperimentStepEvent" ADD CONSTRAINT "ExperimentStepEvent_experimentStepId_fkey" FOREIGN KEY ("experimentStepId") REFERENCES "ExperimentStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
