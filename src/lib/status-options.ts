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

export type StatusOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
};

export function statusValues<const T extends string>(options: readonly StatusOption<T>[]) {
  return options.map((option) => option.value);
}

export function isStatusValue<const T extends string>(
  value: string | undefined,
  options: readonly StatusOption<T>[],
): value is T {
  return value !== undefined && options.some((option) => option.value === value);
}

export const projectStatusOptions = [
  { value: ProjectStatus.active, label: "Active" },
  { value: ProjectStatus.paused, label: "Paused" },
  { value: ProjectStatus.completed, label: "Completed" },
  { value: ProjectStatus.archived, label: "Archived" },
] as const satisfies readonly StatusOption<ProjectStatus>[];

export const projectStatusValues = statusValues(projectStatusOptions);

export const researchPlanStatusOptions = [
  { value: ResearchPlanStatus.draft, label: "Draft" },
  ...projectStatusOptions,
] as const satisfies readonly StatusOption<ResearchPlanStatus>[];

export const experimentStatusOptions = [
  { value: ExperimentStatus.planned, label: "Planned" },
  { value: ExperimentStatus.running, label: "Running" },
  { value: ExperimentStatus.completed, label: "Completed" },
  { value: ExperimentStatus.failed, label: "Failed" },
  { value: ExperimentStatus.archived, label: "Archived" },
] as const satisfies readonly StatusOption<ExperimentStatus>[];

export const experimentStatusValues = experimentStatusOptions.map((option) => option.value);

export const recordStatusOptions = [
  { value: RecordLifecycleStatus.draft, label: "Draft" },
  { value: RecordLifecycleStatus.recorded, label: "Recorded" },
  { value: RecordLifecycleStatus.submitted, label: "Submitted" },
  { value: RecordLifecycleStatus.reviewed, label: "Reviewed" },
] as const satisfies readonly StatusOption<RecordLifecycleStatus>[];

export const recordStatusValues = recordStatusOptions.map((option) => option.value);

export const resultQualityStatusOptions = [
  { value: ResultQualityStatus.not_assessed, label: "Not assessed" },
  { value: ResultQualityStatus.pass, label: "Pass" },
  { value: ResultQualityStatus.warning, label: "Warning" },
  { value: ResultQualityStatus.fail, label: "Fail" },
] as const satisfies readonly StatusOption<ResultQualityStatus>[];

export const resultValidationStatusOptions = [
  { value: ResultValidationStatus.not_applicable, label: "Not applicable" },
  { value: ResultValidationStatus.incomplete, label: "Incomplete" },
  { value: ResultValidationStatus.valid, label: "Valid" },
  { value: ResultValidationStatus.warning, label: "Warning" },
  { value: ResultValidationStatus.invalid, label: "Invalid" },
] as const satisfies readonly StatusOption<ResultValidationStatus>[];

export const reportStatusOptions = [
  { value: ReportStatus.draft, label: "Draft" },
  { value: ReportStatus.ready_for_review, label: "Ready for review" },
  { value: ReportStatus.final, label: "Final" },
  { value: ReportStatus.archived, label: "Archived" },
] as const satisfies readonly StatusOption<ReportStatus>[];

export const protocolAvailabilityOptions = [
  { value: ProtocolAvailability.draft, label: "Draft" },
  { value: ProtocolAvailability.active, label: "Active" },
  { value: ProtocolAvailability.retired, label: "Retired" },
  { value: ProtocolAvailability.archived, label: "Archived" },
] as const satisfies readonly StatusOption<ProtocolAvailability>[];

export const protocolReviewStageOptions = [
  { value: ProtocolReviewStage.draft, label: "Draft" },
  { value: ProtocolReviewStage.ready_for_review, label: "Ready for review" },
  { value: ProtocolReviewStage.reviewed, label: "Reviewed" },
] as const satisfies readonly StatusOption<ProtocolReviewStage>[];

export const protocolScopeOptions = [
  { value: ProtocolScope.general, label: "General" },
  { value: ProtocolScope.project, label: "Project" },
] as const satisfies readonly StatusOption<ProtocolScope>[];

export const objectStatusOptions = [
  { value: ObjectStatus.active, label: "Active" },
  { value: ObjectStatus.inactive, label: "Inactive" },
  { value: ObjectStatus.archived, label: "Archived" },
] as const satisfies readonly StatusOption<ObjectStatus>[];
