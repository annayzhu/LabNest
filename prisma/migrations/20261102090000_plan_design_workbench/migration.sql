-- Research-plan design workbench (Q300–Q312): one new table and the review service setting.
CREATE TABLE "ResearchPlanDesignRun" (
    "id" TEXT NOT NULL,
    "researchPlanId" TEXT NOT NULL,
    "spec" TEXT NOT NULL DEFAULT 'plan-design-v1',
    "purpose" TEXT NOT NULL,
    "step" TEXT NOT NULL DEFAULT 'context',
    "status" TEXT NOT NULL DEFAULT 'idle',
    "stateJson" JSONB NOT NULL DEFAULT '{}',
    "logJson" JSONB NOT NULL DEFAULT '[]',
    "provider" TEXT,
    "model" TEXT,
    "modelCalls" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchPlanDesignRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResearchPlanDesignRun_researchPlanId_createdAt_idx" ON "ResearchPlanDesignRun"("researchPlanId", "createdAt");

ALTER TABLE "ResearchPlanDesignRun" ADD CONSTRAINT "ResearchPlanDesignRun_researchPlanId_fkey" FOREIGN KEY ("researchPlanId") REFERENCES "ResearchPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AISettings" ADD COLUMN "reviewProviderId" TEXT;

CREATE INDEX "AISettings_reviewProviderId_idx" ON "AISettings"("reviewProviderId");

ALTER TABLE "AISettings" ADD CONSTRAINT "AISettings_reviewProviderId_fkey" FOREIGN KEY ("reviewProviderId") REFERENCES "AIProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
