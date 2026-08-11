-- Key information is a concise, durable control-panel note. Keeping it on the
-- parent record ensures that edits, recycle-bin snapshots, and restores retain it.
ALTER TABLE "Project" ADD COLUMN "keyInformation" TEXT;
ALTER TABLE "ResearchPlan" ADD COLUMN "keyInformation" TEXT;
