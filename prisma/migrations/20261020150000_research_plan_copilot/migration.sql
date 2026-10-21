-- CreateTable
CREATE TABLE "ResearchPlanCopilotRun" (
    "id" TEXT NOT NULL,
    "researchPlanId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "inputsJson" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'ready',
    "stage" TEXT NOT NULL DEFAULT 'split',
    "autoContinue" BOOLEAN NOT NULL DEFAULT true,
    "budgetJson" JSONB NOT NULL DEFAULT '{}',
    "stateJson" JSONB NOT NULL DEFAULT '{"done":[]}',
    "logJson" JSONB NOT NULL DEFAULT '[]',
    "suggestionsJson" JSONB NOT NULL DEFAULT '[]',
    "provider" TEXT,
    "model" TEXT,
    "modelCalls" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchPlanCopilotRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchPlanCopilotRun_researchPlanId_createdAt_idx" ON "ResearchPlanCopilotRun"("researchPlanId", "createdAt");

-- AddForeignKey
ALTER TABLE "ResearchPlanCopilotRun" ADD CONSTRAINT "ResearchPlanCopilotRun_researchPlanId_fkey" FOREIGN KEY ("researchPlanId") REFERENCES "ResearchPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
