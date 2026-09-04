ALTER TABLE "ExperimentStep"
ADD COLUMN "requiresConfirmation" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "allowsDeviation" BOOLEAN NOT NULL DEFAULT true;
