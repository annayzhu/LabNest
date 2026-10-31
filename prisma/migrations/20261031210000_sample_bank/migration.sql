-- CreateEnum
CREATE TYPE "SampleBankSearchStatus" AS ENUM ('sent', 'accepted', 'rejected', 'receiving', 'complete', 'failed');

-- CreateTable
CREATE TABLE "SampleBankConnection" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "callbackUrl" TEXT NOT NULL,
    "outboundTokenEncrypted" TEXT,
    "outboundTokenHint" TEXT,
    "inboundTokenEncrypted" TEXT,
    "inboundTokenCreatedAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SampleBankConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleBankSearch" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "bankRequestId" TEXT,
    "query" JSONB NOT NULL,
    "limit" INTEGER NOT NULL,
    "test" BOOLEAN NOT NULL DEFAULT false,
    "requestedBy" TEXT,
    "status" "SampleBankSearchStatus" NOT NULL DEFAULT 'sent',
    "pageCount" INTEGER,
    "pagesReceived" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "total" INTEGER,
    "error" JSONB,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SampleBankSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleBankRecord" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "record" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SampleBankRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleBankTypeMap" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "bankType" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SampleBankTypeMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleBankImport" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "created" INTEGER NOT NULL,
    "updated" JSONB NOT NULL DEFAULT '[]',
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "SampleBankImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SampleBankConnection_source_key" ON "SampleBankConnection"("source");

-- CreateIndex
CREATE UNIQUE INDEX "SampleBankSearch_requestId_key" ON "SampleBankSearch"("requestId");

-- CreateIndex
CREATE INDEX "SampleBankSearch_connectionId_requestedAt_idx" ON "SampleBankSearch"("connectionId", "requestedAt");

-- CreateIndex
CREATE INDEX "SampleBankRecord_source_externalId_idx" ON "SampleBankRecord"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SampleBankRecord_searchId_source_externalId_key" ON "SampleBankRecord"("searchId", "source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SampleBankTypeMap_connectionId_bankType_key" ON "SampleBankTypeMap"("connectionId", "bankType");

-- AddForeignKey
ALTER TABLE "SampleBankSearch" ADD CONSTRAINT "SampleBankSearch_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SampleBankConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleBankRecord" ADD CONSTRAINT "SampleBankRecord_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "SampleBankSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleBankTypeMap" ADD CONSTRAINT "SampleBankTypeMap_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SampleBankConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleBankTypeMap" ADD CONSTRAINT "SampleBankTypeMap_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ScientificSchemaDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleBankImport" ADD CONSTRAINT "SampleBankImport_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "SampleBankSearch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
