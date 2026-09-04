ALTER TABLE "Attachment"
ADD COLUMN "clientMutationId" TEXT,
ADD COLUMN "deviceCreatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Attachment_clientMutationId_key" ON "Attachment"("clientMutationId");
