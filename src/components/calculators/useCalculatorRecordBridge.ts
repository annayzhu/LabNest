"use client";
import { useEffect, useRef } from "react";
import { calculate, getCalculatorDefinition } from "@/lib/calculators/calculator-engine";
import { tableColumnLabel } from "@/lib/calculators/presentation";

const protocol = "labnest-tool-v1";
type SavedCalculation = { calculatorId: string; inputs: Record<string, unknown> };

function calculatorOutput({ calculatorId, inputs }: SavedCalculation, zh: boolean) {
  const result = calculate({ calculatorId, inputs });
  const definition = getCalculatorDefinition(calculatorId);
  // Saved values read as a lab would write them (Q400); the full numbers stay in the saved calculation.
  const cell = (value: unknown) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return String(Number(value.toPrecision(4)));
    const [zhText, enText] = String(value).split(" / ");
    return enText ? (zh ? zhText : enText) : String(value);
  };
  const headers = zh ? ["项目", "结果", "单位"] : ["Item", "Result", "Unit"];
  const rows = result.outputs.map((output) => [zh ? output.labelZh : output.label, cell(output.value), output.unit ?? ""]);
  // A single mix has no group worth a column.
  const columns = [...new Set((result.table ?? []).flatMap((row) => Object.keys(row)))].filter((column) => column !== "group" || new Set((result.table ?? []).map((row) => row.group)).size > 1);
  const tableRows = (result.table ?? []).map((row) => columns.map((column) => cell(row[column])));
  const tables = tableRows.length ? [{ title: zh ? "明细" : "Details", headers: columns.map((column) => tableColumnLabel(column, zh)), rows: tableRows }] : [];
  const notes = [...result.warnings, ...result.notes];
  return {
    snapshot: JSON.parse(JSON.stringify(result)),
    output: {
      label: zh ? definition.nameZh : definition.name, images: [], table: { headers, rows }, tables,
      fullTable: { headers, rows: [...rows, ...tableRows.flatMap((row) => [columns.map((column, index) => `${tableColumnLabel(column, zh)}: ${row[index]}`)])].map((row) => [row[0] ?? "", row[1] ?? "", row[2] ?? ""]) },
      method: `${zh ? "方法版本" : "Method"} ${result.methodVersion}${notes.length ? ` · ${notes.join(" · ")}` : ""}`,
    },
  };
}

/**
 * Connects a calculator opened from a record ("/" → Calculator). `calculatorId` is absent on the catalog, which only
 * follows a saved calculation to its page and refuses to save before one is chosen.
 */
export function useCalculatorRecordBridge({ active, calculatorId, inputs, onRestore, zh }: { active: boolean; calculatorId?: string; inputs?: Record<string, unknown>; onRestore?: (inputs: Record<string, unknown>) => void; zh: boolean }) {
  const latest = useRef({ calculatorId, inputs, onRestore, zh });
  latest.current = { calculatorId, inputs, onRestore, zh };
  const session = useRef("");
  useEffect(() => {
    if (!active || window.parent === window) return;
    const send = (message: object) => window.parent.postMessage({ protocol, sessionId: session.current, ...message }, window.location.origin);
    const state = (): SavedCalculation | null => latest.current.calculatorId ? { calculatorId: latest.current.calculatorId, inputs: latest.current.inputs ?? {} } : null;
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.protocol !== protocol) return;
      const message = event.data;
      if (message.type === "CONTEXT_INIT") {
        session.current = message.sessionId;
        document.documentElement.dataset.labnestEmbedded = "true";
        const saved = message.state as SavedCalculation | null | undefined;
        if (saved?.calculatorId && saved.calculatorId !== latest.current.calculatorId) {
          window.location.replace(`/tools/calculator/${encodeURIComponent(saved.calculatorId)}?embed=record&locale=${latest.current.zh ? "zh" : "en"}`);
          return;
        }
        if (saved?.inputs) latest.current.onRestore?.(saved.inputs);
        send({ type: "CONTEXT_READY" });
      } else if (message.sessionId !== session.current) return;
      else if (message.type === "REQUEST_DRAFT") send({ type: "DRAFT_FLUSH", state: state() });
      else if (message.type === "REQUEST_OUTPUT") {
        const current = state();
        if (!current) { send({ type: "SAVE_ERROR", error: latest.current.zh ? "请先选择一个计算" : "Choose a calculation first" }); return; }
        try {
          const { snapshot, output } = calculatorOutput(current, latest.current.zh);
          send({ type: "OUTPUT_SUBMIT", state: { ...current, snapshot }, output });
        } catch (error) {
          // Engine messages carry both languages as "中文 / English".
          const [zhText, enText] = error instanceof Error ? error.message.split(" / ") : [];
          send({ type: "SAVE_ERROR", error: (latest.current.zh ? zhText : enText || zhText) || (latest.current.zh ? "请检查当前输入" : "Check the inputs") });
        }
      }
    };
    window.addEventListener("message", receive);
    send({ type: "TOOL_READY" });
    return () => window.removeEventListener("message", receive);
  }, [active]);
  useEffect(() => {
    if (!active || !session.current || !calculatorId) return;
    const timer = setTimeout(() => window.parent.postMessage({ protocol, type: "DRAFT_CHANGED", sessionId: session.current, state: { calculatorId, inputs } }, window.location.origin), 250);
    return () => clearTimeout(timer);
  }, [active, calculatorId, inputs]);
}
