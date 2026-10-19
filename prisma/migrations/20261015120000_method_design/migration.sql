-- AlterEnum
ALTER TYPE "ProtocolVersionSourceType" ADD VALUE 'ai_design';

-- CreateTable
CREATE TABLE "MethodDesignSession" (
    "id" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "sampleType" TEXT,
    "conditions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'searching',
    "inputsJson" JSONB NOT NULL DEFAULT '{}',
    "hitsJson" JSONB NOT NULL DEFAULT '[]',
    "cardsJson" JSONB NOT NULL DEFAULT '[]',
    "chosenJson" JSONB NOT NULL DEFAULT '[]',
    "draftVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MethodDesignSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MethodSearchSettings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sourcesJson" JSONB NOT NULL DEFAULT '["local"]',
    "protocolsIoTokenEncrypted" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MethodSearchSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MethodDesignSession_status_idx" ON "MethodDesignSession"("status");

-- CreateIndex
CREATE INDEX "MethodDesignSession_createdAt_idx" ON "MethodDesignSession"("createdAt");
