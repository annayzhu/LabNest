import { describe, expect, it } from "vitest";
import {
  ExperimentStatus,
  ObjectStatus,
  ProjectStatus,
  ProtocolAvailability,
  ProtocolReviewStage,
  ProtocolScope,
  RecordLifecycleStatus,
  ReportStatus,
  ResearchPlanStatus,
  ResultQualityStatus,
  ResultValidationStatus,
} from "@/generated/prisma/enums";
import {
  experimentStatusOptions,
  objectStatusOptions,
  projectStatusOptions,
  protocolAvailabilityOptions,
  protocolReviewStageOptions,
  protocolScopeOptions,
  recordStatusOptions,
  reportStatusOptions,
  researchPlanStatusOptions,
  resultQualityStatusOptions,
  resultValidationStatusOptions,
  statusValues,
  type StatusOption,
} from "./status-options";

function expectOptionValuesToCoverEnum(options: readonly StatusOption[], enumObject: Record<string, string>) {
  expect([...statusValues(options)].sort()).toEqual(Object.values(enumObject).sort());
}

describe("status options", () => {
  it("cover the Prisma enum values used by forms and list filters", () => {
    expectOptionValuesToCoverEnum(projectStatusOptions, ProjectStatus);
    expectOptionValuesToCoverEnum(researchPlanStatusOptions, ResearchPlanStatus);
    expectOptionValuesToCoverEnum(experimentStatusOptions, ExperimentStatus);
    expectOptionValuesToCoverEnum(recordStatusOptions, RecordLifecycleStatus);
    expectOptionValuesToCoverEnum(resultQualityStatusOptions, ResultQualityStatus);
    expectOptionValuesToCoverEnum(resultValidationStatusOptions, ResultValidationStatus);
    expectOptionValuesToCoverEnum(reportStatusOptions, ReportStatus);
    expectOptionValuesToCoverEnum(protocolAvailabilityOptions, ProtocolAvailability);
    expectOptionValuesToCoverEnum(protocolReviewStageOptions, ProtocolReviewStage);
    expectOptionValuesToCoverEnum(protocolScopeOptions, ProtocolScope);
    expectOptionValuesToCoverEnum(objectStatusOptions, ObjectStatus);
  });
});
