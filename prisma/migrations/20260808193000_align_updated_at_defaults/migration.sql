-- Prisma manages @updatedAt values in the client; keep the database schema
-- aligned with the declarative model without rewriting applied history.
ALTER TABLE "ResearchPlan" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "AISettings" ALTER COLUMN "updatedAt" DROP DEFAULT;
