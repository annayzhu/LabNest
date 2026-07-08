import { z } from "zod";
import type {
  ConsumptionRule,
  ExperimentStepRecord,
  ProtocolParameter,
  ProtocolStep,
  ProtocolVersionData,
  ProposedAction,
  RecordLifecycleStatus,
} from "./types";

export const protocolParameterValueSchema = z.union([z.string(), z.number(), z.boolean()]);
export type ProtocolParameterValues = Record<string, z.infer<typeof protocolParameterValueSchema>>;

export const recordLifecycleStatuses: RecordLifecycleStatus[] = [
  "draft",
  "recorded",
  "submitted",
  "reviewed",
];

export type ProtocolParameterChange = {
  name: string;
  updates: Partial<Omit<ProtocolParameter, "name">>;
};

export type CalculatedConsumption = {
  materialName: string;
  quantity: number;
  unit: string;
  formula: string;
  requiresInventorySelection: boolean;
};

export function getNextRecordStatus(status: RecordLifecycleStatus): RecordLifecycleStatus | undefined {
  const currentIndex = recordLifecycleStatuses.indexOf(status);
  return recordLifecycleStatuses[currentIndex + 1];
}

export function canTransitionRecordStatus(
  from: RecordLifecycleStatus,
  to: RecordLifecycleStatus,
): boolean {
  return getNextRecordStatus(from) === to;
}

function nextVersionTitle(title: string, nextVersionNumber: number): string {
  return /\bv\d+\b$/i.test(title)
    ? title.replace(/\bv\d+\b$/i, `v${nextVersionNumber}`)
    : `${title} v${nextVersionNumber}`;
}

export function createProtocolVersionFromParameterChange({
  previousVersion,
  parameterChanges,
  changeSummary,
  createdAt = new Date().toISOString(),
}: {
  previousVersion: ProtocolVersionData;
  parameterChanges: ProtocolParameterChange[];
  changeSummary: string;
  createdAt?: string;
}): ProtocolVersionData {
  if (parameterChanges.length === 0) {
    throw new Error("At least one protocol parameter change is required.");
  }

  const parameterNames = new Set(previousVersion.parameters.map((parameter) => parameter.name));
  const missingParameter = parameterChanges.find((change) => !parameterNames.has(change.name));

  if (missingParameter) {
    throw new Error(`Protocol parameter ${missingParameter.name} does not exist in this version.`);
  }

  const changeByName = new Map(parameterChanges.map((change) => [change.name, change.updates]));
  const nextVersionNumber = previousVersion.versionNumber + 1;

  return {
    ...previousVersion,
    id: `${previousVersion.protocolId}-v${nextVersionNumber}`,
    versionNumber: nextVersionNumber,
    recordStatus: "recorded",
    createdFromVersionId: previousVersion.id,
    changeSummary,
    title: nextVersionTitle(previousVersion.title, nextVersionNumber),
    parameters: previousVersion.parameters.map((parameter) => ({
      ...parameter,
      ...(changeByName.get(parameter.name) ?? {}),
    })),
    createdAt,
  };
}

type Token =
  | { type: "number"; value: number }
  | { type: "identifier"; value: string }
  | { type: "operator"; value: "+" | "-" | "*" | "/" }
  | { type: "leftParen" }
  | { type: "rightParen" };

const precedence: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

function tokenizeFormula(formula: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < formula.length) {
    const char = formula[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      let value = "";
      while (index < formula.length && /[0-9.]/.test(formula[index])) {
        value += formula[index];
        index += 1;
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid number in formula: ${value}`);
      }
      tokens.push({ type: "number", value: parsed });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let value = "";
      while (index < formula.length && /[A-Za-z0-9_]/.test(formula[index])) {
        value += formula[index];
        index += 1;
      }
      tokens.push({ type: "identifier", value });
      continue;
    }

    if (["+", "-", "*", "/"].includes(char)) {
      tokens.push({ type: "operator", value: char as "+" | "-" | "*" | "/" });
      index += 1;
      continue;
    }

    if (char === "(") {
      tokens.push({ type: "leftParen" });
      index += 1;
      continue;
    }

    if (char === ")") {
      tokens.push({ type: "rightParen" });
      index += 1;
      continue;
    }

    throw new Error(`Unsupported character in formula: ${char}`);
  }

  return tokens;
}

function toReversePolish(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const operators: Token[] = [];

  for (const token of tokens) {
    if (token.type === "number" || token.type === "identifier") {
      output.push(token);
      continue;
    }

    if (token.type === "operator") {
      while (operators.length > 0) {
        const top = operators[operators.length - 1];
        if (
          top.type !== "operator" ||
          precedence[top.value] < precedence[token.value]
        ) {
          break;
        }
        output.push(operators.pop() as Token);
      }
      operators.push(token);
      continue;
    }

    if (token.type === "leftParen") {
      operators.push(token);
      continue;
    }

    if (token.type === "rightParen") {
      while (operators.length > 0 && operators[operators.length - 1].type !== "leftParen") {
        output.push(operators.pop() as Token);
      }
      if (operators.length === 0) {
        throw new Error("Mismatched parentheses in formula.");
      }
      operators.pop();
    }
  }

  while (operators.length > 0) {
    const operator = operators.pop() as Token;
    if (operator.type === "leftParen" || operator.type === "rightParen") {
      throw new Error("Mismatched parentheses in formula.");
    }
    output.push(operator);
  }

  return output;
}

export function evaluateFormula(formula: string, values: ProtocolParameterValues): number {
  const stack: number[] = [];
  const tokens = toReversePolish(tokenizeFormula(formula));

  for (const token of tokens) {
    if (token.type === "number") {
      stack.push(token.value);
      continue;
    }

    if (token.type === "identifier") {
      const rawValue = values[token.value];
      if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
        throw new Error(`Formula parameter ${token.value} must be a finite number.`);
      }
      stack.push(rawValue);
      continue;
    }

    if (token.type === "operator") {
      const right = stack.pop();
      const left = stack.pop();
      if (left === undefined || right === undefined) {
        throw new Error("Invalid formula: missing operand.");
      }

      if (token.value === "+") stack.push(left + right);
      if (token.value === "-") stack.push(left - right);
      if (token.value === "*") stack.push(left * right);
      if (token.value === "/") {
        if (right === 0) throw new Error("Formula division by zero.");
        stack.push(left / right);
      }
    }
  }

  if (stack.length !== 1) {
    throw new Error("Invalid formula: unresolved operands.");
  }

  return stack[0];
}

export function calculateConsumption(
  rules: ConsumptionRule[],
  values: ProtocolParameterValues,
): CalculatedConsumption[] {
  return rules.map((rule) => ({
    materialName: rule.material_name,
    quantity: evaluateFormula(rule.formula, values),
    unit: rule.unit,
    formula: rule.formula,
    requiresInventorySelection: Boolean(rule.requires_inventory_selection),
  }));
}

export function renderProtocolTemplate(template: string, values: ProtocolParameterValues): string {
  return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = values[key];
    return value === undefined ? `{{${key}}}` : String(value);
  });
}

export function createExperimentSteps(
  steps: ProtocolStep[],
  values: ProtocolParameterValues,
): ExperimentStepRecord[] {
  return steps.map((step) => ({
    id: `step-${step.order}`,
    order: step.order,
    title: step.title,
    description: renderProtocolTemplate(step.description, values),
    completed: false,
  }));
}

export function createConsumptionProposedActions({
  protocolRunId,
  experimentId,
  consumption,
}: {
  protocolRunId: string;
  experimentId: string;
  consumption: CalculatedConsumption[];
}): ProposedAction[] {
  return consumption.map((item, index) => ({
    id: `pa-consume-${index + 1}`,
    sourceType: "protocol",
    sourceLabel: "Protocol calculation",
    actionType: "consume_inventory",
    status: "pending",
    confidence: 1,
    reason: `Calculated from ${item.formula}; review inventory source before execution.`,
    affectedItem: item.materialName,
    payload: {
      protocol_run_id: protocolRunId,
      experiment_id: experimentId,
      material_name: item.materialName,
      quantity_change: -item.quantity,
      unit: item.unit,
      requires_inventory_selection: item.requiresInventorySelection,
    },
    createdAt: new Date().toISOString(),
  }));
}

export function createProtocolRunPreview(
  protocolVersion: ProtocolVersionData,
  values: ProtocolParameterValues,
) {
  const consumption = calculateConsumption(protocolVersion.consumptionRules, values);
  const steps = createExperimentSteps(protocolVersion.steps, values);
  const protocolRunId = `preview-run-${protocolVersion.id}`;
  const experimentId = `preview-exp-${protocolVersion.id}`;

  return {
    protocolRunId,
    experimentId,
    consumption,
    steps,
    proposedActions: createConsumptionProposedActions({
      protocolRunId,
      experimentId,
      consumption,
    }),
    resultTemplates: protocolVersion.resultTemplates,
  };
}
