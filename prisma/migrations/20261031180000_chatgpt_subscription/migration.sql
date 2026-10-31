-- AlterEnum
ALTER TYPE "AIProviderType" ADD VALUE 'chatgpt_subscription';

-- AlterTable
ALTER TABLE "AIProvider" ADD COLUMN     "reasoningEffort" TEXT;

-- CreateTable
CREATE TABLE "AIProviderSession" (
    "providerId" TEXT NOT NULL,
    "tokensEncrypted" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "modelsJson" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIProviderSession_pkey" PRIMARY KEY ("providerId")
);

-- AddForeignKey
ALTER TABLE "AIProviderSession" ADD CONSTRAINT "AIProviderSession_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AIProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

