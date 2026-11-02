-- Copilot suggestions and what the author did with them (Q334, Q336): one new table, nothing else changes.
CREATE TABLE "CopilotSuggestion" (
    "id" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "specVersion" INTEGER NOT NULL,
    "providerId" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "beforeJson" JSONB,
    "proposedJson" JSONB NOT NULL,
    "checksJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "editedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ignoreReason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "CopilotSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CopilotSuggestion_requestKey_key" ON "CopilotSuggestion"("requestKey");

CREATE INDEX "CopilotSuggestion_targetType_targetId_idx" ON "CopilotSuggestion"("targetType", "targetId");

CREATE INDEX "CopilotSuggestion_providerId_createdAt_idx" ON "CopilotSuggestion"("providerId", "createdAt");

CREATE INDEX "CopilotSuggestion_module_specId_specVersion_idx" ON "CopilotSuggestion"("module", "specId", "specVersion");
