ALTER TABLE "Entry"
ADD COLUMN "clientMutationId" TEXT,
ADD COLUMN "deviceCreatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Entry_clientMutationId_key" ON "Entry"("clientMutationId");
