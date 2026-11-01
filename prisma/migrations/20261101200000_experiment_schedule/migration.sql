-- 日程段 (Q259–Q270): an experiment's steps placed on days, plus items that are not in a Protocol. Add-only.

-- CreateTable
CREATE TABLE "ExperimentScheduleBlock" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'steps',
    "title" TEXT,
    "stepRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "estimatedMinutes" INTEGER,
    "afterBlockId" TEXT,
    "minGapMinutes" INTEGER,
    "maxGapMinutes" INTEGER,
    "gapSource" TEXT,
    "note" TEXT,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperimentScheduleBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExperimentScheduleBlock_experimentId_startAt_idx" ON "ExperimentScheduleBlock"("experimentId", "startAt");

-- CreateIndex
CREATE INDEX "ExperimentScheduleBlock_startAt_idx" ON "ExperimentScheduleBlock"("startAt");

-- AddForeignKey
ALTER TABLE "ExperimentScheduleBlock" ADD CONSTRAINT "ExperimentScheduleBlock_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
