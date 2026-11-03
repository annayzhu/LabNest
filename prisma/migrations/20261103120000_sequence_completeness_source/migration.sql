-- CreateEnum
CREATE TYPE "SequenceCompletenessSource" AS ENUM ('file', 'user');

-- AlterTable
ALTER TABLE "SequenceVersion" ADD COLUMN     "completenessSource" "SequenceCompletenessSource";
