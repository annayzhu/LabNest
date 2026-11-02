-- The length the author gives an experiment's schedule (Q314); null follows its blocks.
ALTER TABLE "Experiment" ADD COLUMN "scheduleDays" INTEGER;
