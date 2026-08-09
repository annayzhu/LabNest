export const projectStatusOptions = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
] as const;

export const projectStatusValues = projectStatusOptions.map((option) => option.value);

export const researchPlanStatusOptions = [
  { value: "draft", label: "Draft" },
  ...projectStatusOptions,
] as const;

export const experimentStatusOptions = [
  { value: "planned", label: "Planned" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "archived", label: "Archived" },
] as const;

export const experimentStatusValues = experimentStatusOptions.map((option) => option.value);

export const recordStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "recorded", label: "Recorded" },
  { value: "submitted", label: "Submitted" },
  { value: "reviewed", label: "Reviewed" },
] as const;

export const recordStatusValues = recordStatusOptions.map((option) => option.value);

export const resultQualityStatusOptions = [
  { value: "not_assessed", label: "Not assessed" },
  { value: "pass", label: "Pass" },
  { value: "warning", label: "Warning" },
  { value: "fail", label: "Fail" },
] as const;

export const reportStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "ready_for_review", label: "Ready for review" },
  { value: "final", label: "Final" },
  { value: "archived", label: "Archived" },
] as const;

export const protocolAvailabilityOptions = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "retired", label: "Retired" },
  { value: "archived", label: "Archived" },
] as const;

export const protocolReviewStageOptions = [
  { value: "draft", label: "Draft" },
  { value: "ready_for_review", label: "Ready for review" },
  { value: "reviewed", label: "Reviewed" },
] as const;
