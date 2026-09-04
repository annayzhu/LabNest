-- Persist one operational timer per planned Experiment step so a running timer
-- survives navigation, refreshes, and device hand-off.
ALTER TABLE "ExperimentStep"
  ADD COLUMN IF NOT EXISTS "timerDurationSeconds" INTEGER,
  ADD COLUMN IF NOT EXISTS "timerRemainingSeconds" INTEGER,
  ADD COLUMN IF NOT EXISTS "timerStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "timerPausedAt" TIMESTAMP(3);
