"use strict";
var LabNestCalculations = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/lib/calculators/standalone.ts
  var standalone_exports = {};
  __export(standalone_exports, {
    appearanceKey: () => appearanceKey,
    calculate: () => calculate,
    compatibleUnits: () => compatibleUnits,
    displayQuantity: () => displayQuantity,
    formatQuantity: () => formatQuantity,
    getCalculatorCatalog: () => getCalculatorCatalog,
    getCalculatorDefinition: () => getCalculatorDefinition,
    parseAppearance: () => parseAppearance,
    presentedOutputs: () => presentedOutputs,
    presentedTable: () => presentedTable,
    resultClipboard: () => resultClipboard,
    resultCsv: () => resultCsv,
    resultExportRows: () => resultExportRows,
    tableQuantityUnits: () => tableQuantityUnits,
    tableUnitsFor: () => tableUnitsFor,
    taskIconResource: () => taskIconResource,
    taskPresentation: () => taskPresentation,
    validateDisplayUnits: () => validateDisplayUnits
  });

  // src/lib/calculators/quantities.ts
  var units = {};
  function register(dimension, factors) {
    for (const [unit, factor] of Object.entries(factors)) units[unit] = { dimension, factor };
  }
  register("mass", { kg: 1e3, g: 1, mg: 1e-3, "\xB5g": 1e-6, ng: 1e-9, pg: 1e-12 });
  register("volume", { L: 1, mL: 1e-3, "\xB5L": 1e-6, nL: 1e-9 });
  register("amount", { mol: 1, mmol: 1e-3, "\xB5mol": 1e-6, nmol: 1e-9, pmol: 1e-12, fmol: 1e-15 });
  register("molar-concentration", { M: 1, "mol/L": 1, mM: 1e-3, "\xB5M": 1e-6, nM: 1e-9, pM: 1e-12 });
  register("mass-concentration", { "g/L": 1, "mg/mL": 1, "\xB5g/mL": 1e-3, "ng/mL": 1e-6, "pg/mL": 1e-9, "\xB5g/\xB5L": 1, "ng/\xB5L": 1e-3 });
  register("cell-concentration", { "cells/mL": 1, "cells/\xB5L": 1e3 });
  register("length", { cm: 1, mm: 0.1, m: 100 });
  register("area", { "cm\xB2": 1, "mm\xB2": 0.01, "m\xB2": 1e4 });
  register("time", { s: 1, min: 60, h: 3600, day: 86400 });
  for (const unit of ["U/mL", "IU/mL", "TU/mL", "PFU/mL", "TCID50/mL", "VG/mL", "% w/v", "% v/v", "% w/w", "rpm", "\xD7g", "g/mol", "cells", "nt", "bp", "%", "\xB5L/\xB5g"]) register(unit, { [unit]: 1 });
  units.K = { dimension: "temperature", factor: 1 };
  units["\xB0C"] = { dimension: "temperature", factor: 1, offset: 273.15 };
  units["\xB0F"] = { dimension: "temperature", factor: 5 / 9, offset: 273.15 - 32 * 5 / 9 };
  function normalizeUnit(unit) {
    return unit.replace(/μ/g, "\xB5").replace(/^u(?=[LMg])/, "\xB5").replace(/\/uL$/, "/\xB5L");
  }
  function parseScalar(value, locale = "en") {
    if (typeof value !== "number" && typeof value !== "string") throw new Error("\u8BF7\u586B\u5199\u6570\u503C / Enter a number");
    let text = String(value).trim();
    if (/^(de|fr|es|it)(-|$)/.test(locale)) {
      if (text.includes(".") && text.includes(",")) throw new Error("\u5C0F\u6570\u5206\u9694\u7B26\u6709\u6B67\u4E49 / Ambiguous separators");
      text = text.replace(",", ".");
    }
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) || !Number.isFinite(Number(text))) throw new Error("\u8BF7\u586B\u5199\u5B8C\u6574\u6709\u9650\u6570\u503C / Enter a complete finite number");
    return Number(text);
  }
  function convert(value, from, to) {
    const a = units[normalizeUnit(from)], b = units[normalizeUnit(to)];
    if (!a || !b || a.dimension !== b.dimension || !Number.isFinite(value)) throw new Error("\u5355\u4F4D\u4E0D\u517C\u5BB9 / Incompatible units");
    const canonical = value * a.factor + (a.offset ?? 0);
    if (a.dimension === "temperature" && canonical < 0) throw new Error("\u4F4E\u4E8E\u7EDD\u5BF9\u96F6\u5EA6 / Below absolute zero");
    return (canonical - (b.offset ?? 0)) / b.factor;
  }
  function compatibleUnits(unit) {
    const definition = units[normalizeUnit(unit)];
    return definition ? Object.keys(units).filter((key) => units[key].dimension === definition.dimension) : [];
  }
  var canonicalUnits = { mass: "g", volume: "L", amount: "mol", "molar-concentration": "mol/L", "mass-concentration": "g/L", "cell-concentration": "cells/mL", length: "cm", area: "cm\xB2", time: "s", temperature: "K" };

  // src/lib/calculators/presentation.ts
  var columns = {
    reducingAgent: ["Reducing-agent stock", "\u8FD8\u539F\u5242\u539F\u6DB2"],
    reducingMode: ["Adding definition", "\u6DFB\u52A0\u65B9\u5F0F"],
    reducingDefinition: ["Stock / target definition", "\u539F\u6DB2\u4E0E\u76EE\u6807\u5B9A\u4E49"],
    reducingAgentUl: ["Reducing agent (\xB5L)", "\u8FD8\u539F\u5242 (\xB5L)"],
    totalUl: ["Total (\xB5L)", "\u603B\u91CF (\xB5L)"],
    targetProteinUg: ["Target protein (\xB5g)", "\u76EE\u6807\u86CB\u767D\u91CF (\xB5g)"],
    concentrationUnit: ["Input concentration unit", "\u8F93\u5165\u6D53\u5EA6\u5355\u4F4D"],
    volumeUnit: ["Canonical volume unit", "\u539F\u59CB\u4F53\u79EF\u5355\u4F4D"],
    tube: ["Tube", "\u7BA1\u53F7"],
    concentration: ["Concentration", "\u6D53\u5EA6"],
    source: ["Source", "\u6765\u6E90"],
    takeUl: ["Take (\xB5L)", "\u53D6\u6DB2\u91CF (\xB5L)"],
    diluentUl: ["Diluent (\xB5L)", "\u7A00\u91CA\u6DB2 (\xB5L)"],
    mixedUl: ["Mixed volume (\xB5L)", "\u6DF7\u5300\u4F53\u79EF (\xB5L)"],
    transferUl: ["Transfer out (\xB5L)", "\u5411\u540E\u8F6C\u79FB (\xB5L)"],
    remainingUl: ["Remaining (\xB5L)", "\u5269\u4F59\u4F53\u79EF (\xB5L)"],
    requiredUl: ["Required (\xB5L)", "\u6240\u9700\u4F53\u79EF (\xB5L)"],
    sufficient: ["Sufficient?", "\u662F\u5426\u8DB3\u591F"],
    component: ["Component", "\u7EC4\u5206"],
    amount: ["Amount", "\u7528\u91CF"],
    unit: ["Unit", "\u5355\u4F4D"],
    perReactionUl: ["Per reaction (\xB5L)", "\u6BCF\u53CD\u5E94 (\xB5L)"],
    premix: ["Premix?", "\u662F\u5426\u9884\u6DF7"],
    batchUl: ["Prepare batch (\xB5L)", "\u6574\u6279\u914D\u5236 (\xB5L)"],
    group: ["Mix group", "\u914D\u6DB2\u7EC4"],
    id: ["Sample ID", "\u6837\u672CID"],
    originalConcentration: ["Original concentration", "\u539F\u6D53\u5EA6"],
    availableUl: ["Available (\xB5L)", "\u53EF\u7528\u4F53\u79EF (\xB5L)"],
    status: ["Status", "\u72B6\u6001"],
    sampleUl: ["Sample (\xB5L)", "\u6837\u54C1\u91CF (\xB5L)"],
    bufferUl: ["Buffer (\xB5L)", "\u7F13\u51B2\u6DB2 (\xB5L)"],
    theoreticalUl: ["Theoretical (\xB5L)", "\u7406\u8BBA\u91CF (\xB5L)"],
    actualUl: ["Actual (\xB5L)", "\u5B9E\u9645\u91CF (\xB5L)"],
    volumeUl: ["Volume (\xB5L)", "\u4F53\u79EF (\xB5L)"],
    level: ["Level", "\u7EA7\u522B"],
    doseUgMl: ["Target (\xB5g/mL)", "\u76EE\u6807\u6D53\u5EA6 (\xB5g/mL)"],
    stockToAddUl: ["Stock (\xB5L)", "\u6BCD\u6DB2\u91CF (\xB5L)"],
    observed: ["Observed response", "\u5B9E\u6D4B\u53CD\u5E94\u503C"],
    fitted: ["Fitted response", "\u62DF\u5408\u53CD\u5E94\u503C"]
  };
  function tableColumnLabel(key, zh) {
    return columns[key]?.[zh ? 1 : 0] ?? key;
  }

  // src/lib/calculators/result-presentation.ts
  var tableQuantityUnits = { takeUl: "\xB5L", diluentUl: "\xB5L", mixedUl: "\xB5L", transferUl: "\xB5L", remainingUl: "\xB5L", requiredUl: "\xB5L", perReactionUl: "\xB5L", batchUl: "\xB5L", availableUl: "\xB5L", sampleUl: "\xB5L", bufferUl: "\xB5L", reducingAgentUl: "\xB5L", totalUl: "\xB5L", theoreticalUl: "\xB5L", actualUl: "\xB5L", volumeUl: "\xB5L", stockToAddUl: "\xB5L", targetProteinUg: "\xB5g" };
  function tableUnitsFor(result) {
    return { ...tableQuantityUnits, ...result.calculatorId === "wb-loading" ? { originalConcentration: "\xB5g/\xB5L" } : result.calculatorId === "normalization" ? { originalConcentration: "ng/\xB5L" } : result.calculatorId === "serial-dilution" ? { concentration: "\xB5M" } : {}, doseUgMl: "\xB5g/mL" };
  }
  function displayQuantity(value, unit, target) {
    return { value: target ? convert(value, unit, target) : value, unit: target ?? unit };
  }
  function formatQuantity(value) {
    return value !== 0 && (Math.abs(value) < 1e-3 || Math.abs(value) >= 1e7) ? value.toExponential(5) : value.toLocaleString("en", { maximumSignificantDigits: 9, useGrouping: false });
  }
  function validateDisplayUnits(result, candidate) {
    if (!candidate || typeof candidate !== "object") return {};
    const valid = {};
    for (const [key, value] of Object.entries(candidate)) {
      const unit = key.startsWith("table:") ? tableUnitsFor(result)[key.slice(6)] : result.outputs.find((o) => o.key === key)?.unit;
      if (unit && typeof value === "string" && compatibleUnits(unit).includes(value)) valid[key] = value;
      else throw new Error("Invalid display unit");
    }
    return valid;
  }
  function presentedOutputs(result) {
    return result.outputs.map((o) => typeof o.value === "number" && o.unit ? { ...o, ...displayQuantity(o.value, o.unit, result.displayUnits?.[o.key]) } : o);
  }
  function presentedTable(result, zh) {
    const rows = result.table ?? [];
    return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => {
      const unit = tableUnitsFor(result)[key], target = result.displayUnits?.["table:" + key] ?? unit;
      const label = tableColumnLabel(key, zh);
      return [unit ? label.includes("(") ? label.replace(/\([^)]*\)/, `(${target})`) : `${label} (${target})` : label, unit && value !== "" && (typeof value === "number" || typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) ? convert(parseScalar(value), unit, target) : value];
    })));
  }
  function resultExportRows(result, zh) {
    const data = result.table?.length ? presentedTable(result, zh) : presentedOutputs(result).map((o) => ({ name: zh ? o.labelZh : o.label, value: o.value, unit: o.unit ?? "" }));
    const metadata = { operations: JSON.stringify(result.operations ?? []), operationVersion: result.operationVersion ?? "legacy-unrecorded", pipettingCheck: JSON.stringify(result.pipettingCheck ?? {}), context: JSON.stringify(result.rawInputs?.__context ?? {}), task: result.calculatorId, mode: result.mode ?? "", method: result.methodVersion, resultStatus: result.status ?? "legacy", warnings: result.warnings.join("\n"), assumptions: result.notes.join("\n"), inputs: JSON.stringify(result.rawInputs ?? {}), outputs: JSON.stringify(presentedOutputs(result)), displayUnits: JSON.stringify(result.displayUnits ?? {}), structuredWarnings: JSON.stringify(result.structuredWarnings ?? []) };
    return data.map((row) => ({ ...row, ...metadata }));
  }
  function resultClipboard(result, zh) {
    const table = presentedTable(result, zh);
    return [result.calculatorId + " \xB7 " + (result.mode ?? ""), ...presentedOutputs(result).map((o) => `${zh ? o.labelZh : o.label}: ${typeof o.value === "number" ? formatQuantity(o.value) : o.value} ${o.unit ?? ""}`), ...table.length ? [Object.keys(table[0]).join("	"), ...table.map((row) => Object.values(row).map((value) => typeof value === "number" ? formatQuantity(value) : value).join("	"))] : [], `Operations (${result.operationVersion ?? "legacy-unrecorded"}): ${JSON.stringify(result.operations ?? [])}`, `Pipetting check: ${JSON.stringify(result.pipettingCheck ?? {})}`, zh ? "\u8B66\u544A" : "Warnings", ...result.warnings, zh ? "\u5173\u952E\u5047\u8BBE" : "Assumptions", ...result.notes, `Status: ${result.status ?? "legacy"}; Method: ${result.methodVersion}`, `Inputs: ${JSON.stringify(result.rawInputs ?? {})}`, `Context: ${JSON.stringify(result.rawInputs?.__context ?? {})}`].join("\n");
  }
  function resultCsv(result, zh) {
    const rows = resultExportRows(result, zh);
    const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const cell = (v) => '"' + (typeof v === "number" ? String(v) : String(v ?? "").replace(/^[=+@\-]/, "'$&")).replaceAll('"', '""') + '"';
    return "\uFEFF" + [keys.map(cell).join(","), ...rows.map((row) => keys.map((key) => cell(row[key])).join(","))].join("\r\n");
  }

  // src/lib/calculators/operations.ts
  var operationVersion = "liquid-operations-v2";
  function operation(id, component, value, unit, role = "add", details = {}) {
    const quantity = { value: convert(value, unit, "\xB5L"), unit: "\xB5L", dimension: "volume" };
    const repetitions = details.repetitions ?? 1;
    if (!Number.isFinite(quantity.value) || quantity.value < 0 || !Number.isInteger(repetitions) || repetitions < 0) throw new Error("\u65E0\u6548\u6DB2\u4F53\u64CD\u4F5C / Invalid liquid operation");
    return { id, component, source: "specified-stock", destination: "preparation", repetitions, planVersion: operationVersion, basis: "theoretical", ...details, role, quantity };
  }
  var operationCoverage = {
    "hemocytometer": "not-applicable: counting only",
    seeding: "adapter: batch and per-well",
    hydrogel: "adapter: batch and per-well",
    split: "not-applicable: confluency estimate",
    freezing: "adapter: batch and per-vial",
    transfection: "adapter: one/two-tube batch and dispensing",
    "kill-curve": "adapter: parallel additions and diluent",
    viability: "adapter: final resuspension target",
    od600: "not-applicable: density estimate",
    cfu: "not-applicable: colony count reference",
    "colony-counter": "not-applicable: image count",
    dilution: "adapter: final/add/fold/ratio",
    "reagent-dosing": "adapter: dilution",
    "fold-dilution": "adapter: dilution",
    "serial-dilution": "adapter: transfers and diluent",
    molarity: "adapter: final-volume target only",
    "percent-solution": "adapter: v/v liquid and make-up; w/v make-up; w/w masses",
    "media-recipe": "adapter: typed liquid rows and make-up",
    "buffer-recipe": "adapter: typed liquid rows and make-up",
    "ic50-ec50": "not-applicable: analysis",
    "master-mix": "planner: per-group bulk, separate samples, dispensing",
    ligation: "not-applicable: DNA mass only",
    tm: "not-applicable: temperature estimate",
    "dna-rna-conversion": "not-applicable: quantity conversion",
    "bradford-bca": "not-applicable: analysis",
    "elisa-4pl": "not-applicable: analysis",
    "wb-loading": "adapter: each valid sample all components",
    moi: "adapter: virus stock",
    "virus-titer": "not-applicable: titer estimate",
    "unit-converter": "not-applicable: pure conversion",
    centrifuge: "not-applicable: speed conversion",
    resuspension: "adapter: make-up target",
    normalization: "adapter: sample and diluent"
  };
  function withLiquidOperations(result, inputs) {
    if (result.operations) return { ...result, operationVersion };
    const operations = [];
    function add(id, component, value, unit, role = "add", details = {}) {
      if (value === "") return;
      if (typeof value !== "number") throw new Error("Invalid liquid operation: " + component);
      operations.push(operation(`${result.calculatorId}:${id}`, component, value, unit, role, details));
    }
    function output(key, role = "add") {
      const o = result.outputs.find((o2) => o2.key === key);
      if (o?.unit) add(key, o.labelZh + " / " + o.label, o.value, o.unit, role, { componentId: key });
    }
    const outputKeys = { seeding: ["stockVolumeMl", "mediumVolumeMl"], hydrogel: ["hydrogelUl", "cellStockUl", "mediumUl"], freezing: ["dmsoMl", "serumMl", "baseMediumMl"], transfection: ["reagentUl", "dnaVolumeUl", "diluentUl"], dilution: ["stockVolume", "diluentVolume"], "reagent-dosing": ["stockVolume", "diluentVolume"], "fold-dilution": ["stockVolume", "diluentVolume"], moi: ["virusVolumeUl"] };
    if (!(result.calculatorId === "transfection" && result.table)) for (const key of outputKeys[result.calculatorId] ?? []) output(key);
    const schemas = { "serial-dilution": ["takeUl", "diluentUl"], normalization: ["sampleUl", "diluentUl"], "wb-loading": ["sampleUl", "bufferUl", "reducingAgentUl", "diluentUl"], "kill-curve": ["stockToAddUl"], transfection: ["volumeUl"] };
    for (const [index, row] of (result.table ?? []).entries()) {
      for (const key of schemas[result.calculatorId] ?? []) if (key in row) {
        if (result.calculatorId === "serial-dilution" && index === 0 && key === "takeUl" && inputs.firstSource !== "stock" && !["linear", "custom"].includes(String(inputs.gradientMode))) continue;
        const label = key === "reducingAgentUl" ? String(row.reducingAgent) : tableColumnLabel(key, true) + " / " + tableColumnLabel(key, false);
        add(`row:${index}:${key}`, String(row.component ?? label), row[key], "\xB5L", key === "takeUl" ? "transfer" : "add", { componentId: key, inputRow: String(index), sample: String(row.id ?? row.tube ?? row.level ?? index + 1), source: key === "takeUl" ? `tube:${index || "starting-stock"}` : `stock:${key}`, destination: `${result.calculatorId}:${row.tube ?? row.id ?? index + 1}` });
      }
      if (["media-recipe", "buffer-recipe"].includes(result.calculatorId) && units[normalizeUnit(String(row.unit))]?.dimension === "volume") add(`recipe:${row.componentId}`, String(row.component), row.amount, String(row.unit), row.action === "make-up-to" ? "make-up-to" : "add", { componentId: String(row.componentId), inputRow: String(index) });
      if (result.calculatorId === "kill-curve") add(`diluent:${index}`, "\u7A00\u91CA\u6DB2 / Diluent", convert(parseScalar(inputs.volumePerWellMl), String(inputs.volumePerWellMlUnit ?? "mL"), "\xB5L") - Number(row.stockToAddUl), "\xB5L", "add", { sample: String(row.level), destination: `well:${row.level}` });
    }
    const quantityInput = (key, unit) => convert(parseScalar(inputs[key]), String(inputs[key + "Unit"] ?? unit), "\xB5L");
    if (["seeding", "hydrogel"].includes(result.calculatorId)) add("per-well", "\u6BCF\u5B54\u5206\u88C5 / Per well", quantityInput("volumePerWellUl", "\xB5L"), "\xB5L", "dispense", { source: "prepared-batch", destination: "wells", repetitions: parseScalar(inputs.wells) * Number(inputs.plates ?? 1) });
    if (result.calculatorId === "freezing" && Number(result.outputMap.vials) > 0) add("per-vial", "\u6BCF\u7BA1\u5206\u88C5 / Per vial", quantityInput("volumePerVialMl", "mL"), "\xB5L", "dispense", { source: "prepared-batch", destination: "vials", repetitions: Number(result.outputMap.vials) });
    if (result.calculatorId === "transfection") {
      if (inputs.complexMode === "two-tube") add("combine", "\u5408\u5E76A\u7BA1\u4E0EB\u7BA1 / Combine tubes A and B", quantityInput("tubeAVolumeUl", "\xB5L") * parseScalar(inputs.wells) * parseScalar(inputs.replicates) * (1 + parseScalar(inputs.overagePercent) / 100), "\xB5L", "transfer", { source: "transfection:A", destination: "transfection:B" });
      add("per-well", "\u6BCF\u5B54\u590D\u5408\u7269 / Complex per well", quantityInput("complexVolumeUlPerWell", "\xB5L"), "\xB5L", "dispense", { source: "prepared-complex", destination: "wells", repetitions: parseScalar(inputs.wells) * parseScalar(inputs.replicates) });
    }
    if (result.calculatorId === "percent-solution") {
      if (inputs.type === "v/v") output("soluteAmount");
      if (inputs.type !== "w/w") output("targetVolumeMl", "make-up-to");
    }
    if (result.calculatorId === "resuspension") output("finalVolumeUl", "make-up-to");
    if (result.calculatorId === "viability") output("resuspensionVolumeMl", "make-up-to");
    if (result.calculatorId === "molarity") {
      if (inputs.mode === "volume") output("volumeL", "make-up-to");
      else if (inputs.mode === "mass") add("final", "\u6EB6\u89E3\u540E\u5B9A\u5BB9\u81F3 / Dissolve then bring to", quantityInput("volumeL", "L"), "\xB5L", "make-up-to");
    }
    return { ...result, operations, operationVersion };
  }

  // src/lib/calculators/pipetting.ts
  function applyPipettingOptions(source, inputs) {
    let result = withLiquidOperations(source, inputs);
    let operations = [...result.operations ?? []];
    const warnings = result.warnings.filter((w) => !source.structuredWarnings?.some((old) => old.message === w));
    if (inputs.pipetteStepUl !== void 0 && inputs.pipetteStepUl !== null && inputs.pipetteStepUl !== "") {
      const step = parseScalar(inputs.pipetteStepUl);
      if (step <= 0) throw new Error("\u79FB\u6DB2\u6B65\u8FDB\u5FC5\u987B\u5927\u4E8E0 / Pipetting increment must be positive");
      if (!["dilution", "reagent-dosing", "fold-dilution"].includes(result.calculatorId) || inputs.mode === "add") warnings.push("\u6B64\u6A21\u5F0F\u4FDD\u7559\u7406\u8BBA\u91CF\uFF1B\u672A\u5E94\u7528\u6B65\u8FDB\u820D\u5165 / This mode retains theoretical values; rounding not applied.");
      else {
        const stock = Number(result.outputMap.stockVolumeUl), finalOutput = result.outputs.find((o) => o.key === "finalVolume");
        if (!finalOutput || typeof finalOutput.value !== "number" || !finalOutput.unit) throw new Error("Missing final volume");
        const final = convert(finalOutput.value, finalOutput.unit, "\xB5L"), actual = Math.round(stock / step) * step;
        if (actual > final || stock > 0 && actual === 0 || final - stock > 0 && final - actual === 0) throw new Error("\u6B65\u8FDB\u820D\u5165\u4F7F\u975E\u96F6\u7EC4\u5206\u4E3A0\u6216\u8D85\u8FC7\u603B\u91CF\uFF1B\u6B64\u65B9\u6848\u4E0D\u53EF\u6267\u884C / Rounding removes a nonzero component or exceeds final volume");
        const deviation = stock === 0 ? 0 : (actual / stock - 1) * 100;
        result = { ...result, table: [{ component: "\u6BCD\u6DB2 / Stock", theoreticalUl: stock, actualUl: actual }, { component: "\u7A00\u91CA\u6DB2 / Diluent", theoreticalUl: final - stock, actualUl: final - actual }], notes: [...result.notes, `\u79FB\u6DB2\u6B65\u8FDB ${step} \xB5L\uFF1B\u5B9E\u9645\u6D53\u5EA6\u504F\u5DEE ${deviation.toPrecision(6)}% / Actual concentration deviation; outputs retain theory.`] };
        if (inputs.targetConcentration !== void 0) {
          const concentration = parseScalar(inputs.targetConcentration) * (stock === 0 ? 1 : actual / stock);
          const unit = String(inputs.targetConcentrationUnit ?? "\xB5M");
          result.outputs = [...result.outputs, { key: "adoptedConcentration", label: "Adopted concentration", labelZh: "\u91C7\u7528\u65B9\u6848\u6D53\u5EA6", value: concentration, unit }];
          result.outputMap = { ...result.outputMap, adoptedConcentration: concentration };
        }
        operations = [actual, final - actual].map((value, index) => operation(`adopted:${index}`, index ? "\u7A00\u91CA\u6DB2 / Diluent" : "\u6BCD\u6DB2 / Stock", value, "\xB5L", "add", { basis: "actual" }));
      }
    }
    const structuredWarnings = [];
    if (inputs.pipetteMinimumUl !== void 0 && inputs.pipetteMinimumUl !== null && inputs.pipetteMinimumUl !== "") {
      const minimum2 = parseScalar(inputs.pipetteMinimumUl);
      if (minimum2 <= 0) throw new Error("\u8BBE\u5907\u4E0B\u9650\u5FC5\u987B\u5927\u4E8E0 / Equipment minimum must be positive");
      for (const operation2 of operations) {
        if (operation2.role === "make-up-to" || operation2.repetitions === 0) continue;
        const volume = convert(operation2.quantity.value, operation2.quantity.unit, "\xB5L");
        if (!Number.isFinite(volume) || volume < 0) throw new Error("Invalid liquid operation");
        if (volume > 0 && volume < minimum2) {
          const message = `${operation2.groupName ? operation2.groupName + " \xB7 " : ""}${operation2.sample ? operation2.sample + " \xB7 " : ""}${operation2.component} (${operation2.basis}): ${formatQuantity(volume)} \xB5L\uFF0C\u4F4E\u4E8E\u6240\u8BBE ${formatQuantity(minimum2)} \xB5L \u4E0B\u9650 / below configured minimum. \u8C03\u6574\u5236\u5907\u89C4\u6A21\uFF0C\u6216\u8BC4\u4F30\u4E2D\u95F4\u6DB2\u65B9\u6848 / Adjust preparation scale or assess an intermediate dilution.`;
          structuredWarnings.push({ code: "below-minimum", operationId: operation2.id, component: operation2.component, sample: operation2.sample, basis: operation2.basis, volumeUl: volume, minimumUl: minimum2, message });
          warnings.push(message);
        }
      }
    }
    const minimum = inputs.pipetteMinimumUl === void 0 || inputs.pipetteMinimumUl === null || inputs.pipetteMinimumUl === "" ? void 0 : parseScalar(inputs.pipetteMinimumUl);
    const status = !operationCoverage[result.calculatorId] ? "incomplete" : operationCoverage[result.calculatorId].startsWith("not-applicable") ? "not-applicable" : !operations.some((o) => o.role !== "make-up-to") ? "incomplete" : minimum === void 0 ? "not-set" : structuredWarnings.length ? "below-minimum" : "passed";
    return { ...result, operations, pipettingCheck: { status, minimumUl: minimum }, warnings: [...new Set(warnings)], structuredWarnings };
  }

  // src/lib/calculators/task-definitions.ts
  var n = (key, label, labelZh, unit) => ({ key, label, labelZh, type: "number", unit });
  var select = (key, label, labelZh, options) => ({ key, label, labelZh, type: "select", defaultValue: options[0][0], options: options.map(([value, label2, labelZh2]) => ({ value, label: label2, labelZh: labelZh2 })) });
  function enhanceDefinition(d) {
    if (d.id === "master-mix") d.methodVersion = "master-mix-v3";
    if (d.id === "percent-solution") d.methodVersion = "percent-solution-v2";
    d = { ...d, fields: [...d.fields], aliases: [...d.aliases], methodVersion: d.methodVersion.replace(/-v1$/, "-v2") };
    if (["wb-loading", "bradford-bca", "elisa-4pl"].includes(d.id)) d.category = "protein";
    if (["od600", "cfu", "colony-counter"].includes(d.id)) d.category = "virology-microbiology";
    if (["dilution", "reagent-dosing", "fold-dilution"].includes(d.id)) {
      d.name = "Dilution & dosing";
      d.nameZh = "\u7A00\u91CA\u4E0E\u52A0\u836F";
      d.aliases.push("\u6297\u4F53", "1:1000", "antibody dilution", "10\xD7 PBS", "fold dilution", "\u52A0\u836F", "\u5E38\u89C4\u7A00\u91CA", "\u8BD5\u5242\u52A0\u836F", "\u500D\u6570\u7A00\u91CA");
      d.fields = [select("mode", "Mode", "\u6A21\u5F0F", [["final", "Final volume", "\u914D\u81F3\u6700\u7EC8\u4F53\u79EF"], ["add", "Add to existing liquid", "\u5411\u5DF2\u6709\u6DB2\u4F53\u52A0\u836F"], ["fold", "Fold dilution", "\u500D\u6DB2"], ["ratio", "1:N dilution", "1:N\u7A00\u91CA\uFF08\u5360\u6700\u7EC8\u4F53\u79EF1/N\uFF09"], ["parts", "Stock:diluent", "\u6BCD\u6DB2:\u7A00\u91CA\u6DB2"]]), n("stockConcentration", "Stock concentration", "\u6BCD\u6DB2\u6D53\u5EA6", "mM"), n("targetConcentration", "Target concentration", "\u76EE\u6807\u6D53\u5EA6", "\xB5M"), n("initialConcentration", "Initial concentration (same solute)", "\u5DF2\u6709\u6DB2\u4F53\u521D\u59CB\u6D53\u5EA6\uFF08\u540C\u4E00\u6EB6\u8D28\uFF09", "\xB5M"), n("stockFold", "Stock fold", "\u6BCD\u6DB2\u500D\u6570"), n("targetFold", "Target fold", "\u76EE\u6807\u500D\u6570"), n("ratio", "Dilution denominator", "\u7A00\u91CA\u5206\u6BCDN"), n("stockParts", "Stock parts", "\u6BCD\u6DB2\u4EFD\u6570"), n("diluentParts", "Diluent parts", "\u7A00\u91CA\u6DB2\u4EFD\u6570"), n("finalVolume", "Final / initial volume", "\u6700\u7EC8\u4F53\u79EF / \u5DF2\u6709\u6DB2\u4F53\u4F53\u79EF", "mL"), n("molecularWeight", "MW of confirmed chemical form", "\u5DF2\u786E\u8BA4\u76D0/\u6C34\u5408\u7269\u5F62\u5F0F\u7684\u5206\u5B50\u91CF", "g/mol")];
      d.exampleInputs = { mode: "final", stockConcentration: 10, targetConcentration: 10, finalVolume: 2, initialConcentration: 0 };
      if (d.id === "fold-dilution") {
        d.fields[0].defaultValue = "fold";
        d.exampleInputs = { mode: "fold", stockFold: 10, targetFold: 2, finalVolume: 100 };
      }
    }
    if (d.id === "molarity") {
      d.name = "Weigh & prepare";
      d.nameZh = "\u79F0\u91CF\u914D\u6DB2";
      d.fields.push(n("purityPercent", "Mass purity", "\u8D28\u91CF\u7EAF\u5EA6", "%"));
      d.exampleInputs.purityPercent = 100;
    }
    if (d.id === "seeding") {
      d.fields = d.fields.filter((f) => f.key !== "plates");
      d.fields[0] = { ...d.fields[0], label: "Viable-cell concentration", labelZh: "\u6D3B\u7EC6\u80DE\u6D53\u5EA6" };
      d.aliases.push("seeding", "\u94FA24\u5B54");
    }
    if (d.id === "hemocytometer") {
      d.fields.unshift(select("countRegion", "Counting region", "\u8BA1\u6570\u533A", [["standard", "Standard large square (100 nL)", "\u6807\u51C6\u5927\u65B9\u683C\uFF08100 nL\uFF09"], ["custom", "Custom geometry", "\u81EA\u5B9A\u4E49\u51E0\u4F55\u53C2\u6570"]]));
      d.fields.push(n("areaMm2", "Counting area", "\u8BA1\u6570\u9762\u79EF", "mm\xB2"), n("depthMm", "Chamber depth", "\u8BA1\u6570\u6DF1\u5EA6", "mm"));
    }
    if (["ic50-ec50", "bradford-bca", "elisa-4pl"].includes(d.id)) {
      d.fields.unshift(select("concentrationUnit", "Concentration unit", "\u6D53\u5EA6\u5355\u4F4D", [["", "Choose a unit", "\u8BF7\u9009\u62E9\u5355\u4F4D"], ["\xB5M", "\xB5M", "\xB5M"], ["nM", "nM", "nM"], ["mg/mL", "mg/mL", "mg/mL"], ["\xB5g/mL", "\xB5g/mL", "\xB5g/mL"], ["ng/mL", "ng/mL", "ng/mL"], ["pg/mL", "pg/mL", "pg/mL"]]));
      d.exampleInputs.concentrationUnit = d.id === "ic50-ec50" ? "\xB5M" : d.id === "bradford-bca" ? "mg/mL" : "pg/mL";
    }
    if (d.id === "centrifuge") {
      d.aliases.push("g\u8F6Crpm");
      d.fields.push(select("radiusDefinition", "Radius definition", "\u534A\u5F84\u6765\u6E90\u5B9A\u4E49", [["entered", "User-entered rotor radius", "\u7528\u6237\u5F55\u5165\u8F6C\u5B50\u534A\u5F84"], ["maximum", "Maximum radius", "\u6700\u5927\u534A\u5F84"], ["mean", "Mean radius", "\u5E73\u5747\u534A\u5F84"]]));
    }
    if (d.id === "transfection") {
      d.fields.unshift(select("complexMode", "Mixing template", "\u6DF7\u5408\u6A21\u677F", [["combined", "Combined mixture", "\u5355\u4F53\u7CFB"], ["two-tube", "Two separate tubes", "\u4E24\u7BA1\u5206\u522B\u914D\u5236\u518D\u6DF7\u5408"]]));
      d.fields.push(n("tubeAVolumeUl", "Tube A final volume per well", "\u6BCF\u5B54A\u7BA1\u603B\u4F53\u79EF", "\xB5L"));
    }
    if (d.id === "wb-loading") {
      d.fields.unshift(select("bufferContainsReducingAgent", "Buffer contains reducing agent", "Buffer\u662F\u5426\u5DF2\u542B\u8FD8\u539F\u5242", [["", "Please confirm", "\u8BF7\u9009\u62E9\u786E\u8BA4"], ["no", "No; specify separate amount", "\u5426\uFF0C\u5355\u72EC\u8BBE\u7F6E\u7528\u91CF"], ["yes", "Yes; do not add twice", "\u662F\uFF0C\u4E0D\u518D\u91CD\u590D\u6DFB\u52A0"]]));
      d.fields.push({ key: "reducingAgentName", type: "text", label: "Reducing-agent stock name", labelZh: "\u8FD8\u539F\u5242\u539F\u6DB2\u540D\u79F0" }, select("reducingMode", "Reducing-agent definition", "\u8FD8\u539F\u5242\u6DFB\u52A0\u5B9A\u4E49", [["volume-fraction", "Stock fraction of final volume", "\u539F\u6DB2\u5360\u6700\u7EC8\u4F53\u79EF\u6BD4\u4F8B"], ["target-concentration", "Target active concentration (%)", "\u6709\u6548\u6210\u5206\u76EE\u6807\u6D53\u5EA6\uFF08%\uFF09"]]), n("reducingStockPercent", "Stock concentration (%)", "\u539F\u6DB2\u6709\u6548\u6210\u5206\u6D53\u5EA6\uFF08%\uFF09", "%"));
      d.exampleInputs = { ...d.exampleInputs, bufferContainsReducingAgent: "no", reducingAgentName: "Specified stock", reducingMode: "volume-fraction" };
      d.methodVersion = "wb-loading-v3";
    }
    if (d.id === "split") {
      d.fields.unshift(select("areaMode", "Container area", "\u5BB9\u5668\u9762\u79EF", [["same", "Same source and target area", "\u6765\u6E90\u548C\u76EE\u6807\u5BB9\u5668\u9762\u79EF\u76F8\u540C"], ["different", "Different areas", "\u6765\u6E90\u548C\u76EE\u6807\u5BB9\u5668\u9762\u79EF\u4E0D\u540C"]]));
      d.fields.push(n("sourceAreaCm2", "Source area", "\u6765\u6E90\u5BB9\u5668\u9762\u79EF", "cm\xB2"), n("targetAreaCm2", "Area of each target container", "\u6BCF\u4E2A\u76EE\u6807\u5BB9\u5668\u9762\u79EF", "cm\xB2"));
    }
    if (d.id === "dna-rna-conversion") d.aliases.push("ng/\u03BCL \u8F6C nM", "DNA\u6D53\u5EA6", "ng\u6BCF\u03BCL\u8F6CnM");
    if (d.id === "percent-solution") {
      d.fields[0].options = [...d.fields[0].options, { value: "w/w", label: "w/w", labelZh: "\u8D28\u91CF/\u8D28\u91CF" }];
      d.fields.push(n("targetMassG", "Final mixture mass", "\u6700\u7EC8\u6DF7\u5408\u7269\u8D28\u91CF", "g"));
    }
    if (d.id === "serial-dilution") {
      d.fields.push(select("volumeMode", "Volume meaning", "\u4F53\u79EF\u542B\u4E49", [["mixed", "Mixed volume", "\u6BCF\u7BA1\u6DF7\u5300\u65F6\u4F53\u79EF"], ["retained", "Retained volume", "\u8F6C\u79FB\u540E\u4FDD\u7559\u4F53\u79EF"]]));
      d.fields.find((f) => f.key === "startingConcentration").unit = "\xB5M";
    }
    if (["media-recipe", "buffer-recipe"].includes(d.id)) {
      d.fields = d.fields.filter((f) => f.key !== "components");
      d.fields.push(select("recipeMode", "Preparation mode", "\u914D\u5236\u6A21\u5F0F", [["final", "Bring to final volume", "\u6EB6\u89E3\u540E\u5B9A\u5BB9\u81F3\u6700\u7EC8\u4F53\u79EF"], ["add", "Add to existing base liquid", "\u5411\u5DF2\u6709\u57FA\u7840\u6DB2\u6DFB\u52A0"]]));
    }
    if (d.id === "serial-dilution") {
      d.fields.unshift(select("gradientMode", "Gradient", "\u68AF\u5EA6\u65B9\u5F0F", [["geometric", "Geometric serial", "\u7B49\u500D\u8FDE\u7EED"], ["linear", "Linear parallel", "\u7EBF\u6027\u5E76\u884C\u914D\u5236"], ["custom", "Custom parallel", "\u81EA\u5B9A\u4E49\u6D53\u5EA6\u5E76\u884C\u914D\u5236"]]));
      d.fields.push(n("requiredVolumeUl", "Required retained volume (optional)", "\u8F6C\u79FB\u540E\u6240\u9700\u7528\u91CF\uFF08\u53EF\u9009\uFF09", "\xB5L"), n("endingConcentration", "Last concentration", "\u672B\u70B9\u6D53\u5EA6", "\xB5M"), { key: "customTargets", label: "Targets (one \xB5M value per line)", labelZh: "\u76EE\u6807\u6D53\u5EA6\uFF08\u6BCF\u884C\u4E00\u4E2A\xB5M\u6570\u503C\uFF09", type: "textarea" }, select("firstSource", "Starting solution", "\u7B2C\u4E00\u7BA1\u6765\u6E90", [["prepared", "Already prepared starting solution", "\u5DF2\u5907\u8D77\u59CB\u6DB2"], ["stock", "Prepare from stock", "\u4ECE\u66F4\u6D53\u6BCD\u6DB2\u5236\u5907"]]), n("sourceConcentration", "Source stock concentration", "\u6765\u6E90\u6BCD\u6DB2\u6D53\u5EA6", "\xB5M"));
    }
    if (d.id === "master-mix") {
      d.name = "Reaction preparation";
      d.nameZh = "\u53CD\u5E94\u914D\u6DB2";
      d.fields = [n("samples", "Samples", "\u6837\u672C\u6570", "integer"), n("replicates", "Replicates per sample", "\u6BCF\u6837\u672C\u91CD\u590D\u6570", "integer"), n("controls", "Control reactions", "\u989D\u5916\u5BF9\u7167\u53CD\u5E94\u6570", "integer"), n("overagePercent", "Overage", "\u9884\u6DF7\u4F59\u91CF", "%"), n("reactionVolumeUl", "Final volume per reaction", "\u5355\u53CD\u5E94\u603B\u4F53\u79EF", "\xB5L")];
      d.exampleInputs = { samples: 8, replicates: 3, controls: 2, overagePercent: 10, reactionVolumeUl: 20, rows: [{ name: "2\xD7 Mix", volume: "10", premix: true }, { name: "F", volume: "0.5", premix: true }, { name: "R", volume: "0.5", premix: true }, { name: "Template", volume: "2", premix: false }, { name: "Water", volume: "7", premix: true }] };
    }
    return d;
  }
  var newDefinitions = [
    { id: "resuspension", name: "Reagent resuspension", nameZh: "\u8BD5\u5242\u590D\u6EB6", shortDescription: "Final volume from amount and concentration", shortDescriptionZh: "\u6839\u636E\u8BD5\u5242\u91CF\u8BA1\u7B97\u590D\u6EB6\u6700\u7EC8\u4F53\u79EF", category: "solutions", aliases: ["\u5F15\u7269\u6EB6\u89E3", "oligo resuspension"], plateAware: false, method: "Final volume = amount / target concentration", methodZh: "\u6700\u7EC8\u4F53\u79EF = \u91CF / \u76EE\u6807\u6D53\u5EA6\uFF1B\u6309\u4EA7\u54C1\u8BF4\u660E\u9009\u62E9\u6EB6\u5242", methodVersion: "resuspension-v2", fields: [select("mode", "Mode", "\u6A21\u5F0F", [["amount", "Amount \u2192 molarity", "\u7269\u8D28\u7684\u91CF\u2192\u6469\u5C14\u6D53\u5EA6"], ["mass", "Mass \u2192 mass concentration", "\u8D28\u91CF\u2192\u8D28\u91CF\u6D53\u5EA6"], ["mass-molar", "Mass + MW \u2192 molarity", "\u8D28\u91CF\uFF0B\u5206\u5B50\u91CF\u2192\u6469\u5C14\u6D53\u5EA6"]]), n("amount", "Amount", "\u7269\u8D28\u7684\u91CF", "nmol"), n("mass", "Mass", "\u8D28\u91CF", "mg"), n("molecularWeight", "Molecular weight", "\u5206\u5B50\u91CF", "g/mol"), n("targetMolar", "Target molarity", "\u76EE\u6807\u6469\u5C14\u6D53\u5EA6", "\xB5M"), n("targetMass", "Target mass concentration", "\u76EE\u6807\u8D28\u91CF\u6D53\u5EA6", "mg/mL")], exampleInputs: { mode: "amount", amount: 25, targetMolar: 100 } },
    { id: "normalization", name: "Batch normalization", nameZh: "\u6279\u91CF\u6D53\u5EA6\u5F52\u4E00\u5316", shortDescription: "Row-by-row dilution with sample availability", shortDescriptionZh: "\u9010\u6837\u672C\u68C0\u67E5\u6D53\u5EA6\u548C\u53EF\u7528\u4F53\u79EF\uFF0C\u751F\u6210\u79FB\u6DB2\u8868", category: "solutions", aliases: ["batch dilution", "\u6279\u91CF\u7A00\u91CA"], plateAware: false, method: "C1V1=C2V2; each sample validated separately", methodZh: "C1V1=C2V2\uFF1B\u9010\u884C\u6821\u9A8C\u5E76\u4FDD\u7559\u65E0\u6548\u884C", methodVersion: "normalization-v2", fields: [n("targetConcentration", "Target concentration", "\u76EE\u6807\u6D53\u5EA6", "ng/\xB5L"), n("finalVolume", "Final volume", "\u6700\u7EC8\u4F53\u79EF", "\xB5L")], exampleInputs: { targetConcentration: 10, finalVolume: 20, samples: [{ id: "A", concentration: "50", available: "" }, { id: "B", concentration: "5", available: "" }] } }
  ];
  function isFieldVisible(id, key, inputs) {
    const mode = String(inputs.mode ?? "");
    if (["dilution", "reagent-dosing", "fold-dilution"].includes(id)) {
      const m = mode || "final";
      if (key === "molecularWeight") return ["final", "add"].includes(m) && units[normalizeUnit(String(inputs.stockConcentrationUnit ?? "mM"))]?.dimension !== units[normalizeUnit(String(inputs.targetConcentrationUnit ?? "\xB5M"))]?.dimension;
      if (["stockConcentration", "targetConcentration"].includes(key)) return ["final", "add"].includes(m);
      if (key === "initialConcentration") return m === "add";
      if (["stockFold", "targetFold"].includes(key)) return m === "fold";
      if (key === "ratio") return m === "ratio";
      if (["stockParts", "diluentParts"].includes(key)) return m === "parts";
    }
    if (id === "serial-dilution") {
      const gradient = inputs.gradientMode ?? "geometric";
      if (key === "startingConcentration" || key === "levels") return gradient !== "custom";
      if (key === "dilutionFactor" || key === "volumeMode") return gradient === "geometric";
      if (key === "endingConcentration") return gradient === "linear";
      if (key === "customTargets") return gradient === "custom";
      if (key === "sourceConcentration") return gradient !== "geometric" || inputs.firstSource === "stock";
      if (key === "firstSource") return gradient === "geometric";
    }
    if (id === "hemocytometer" && ["areaMm2", "depthMm"].includes(key)) return inputs.countRegion === "custom";
    if (id === "master-mix" && Array.isArray(inputs.groups) && ["samples", "replicates", "controls"].includes(key)) return false;
    if (id === "transfection" && key === "tubeAVolumeUl") return inputs.complexMode === "two-tube";
    if (id === "wb-loading" && ["reducingAgentPercent", "reducingAgentName", "reducingMode", "reducingStockPercent"].includes(key)) return inputs.bufferContainsReducingAgent === "no" && (key !== "reducingStockPercent" || inputs.reducingMode === "target-concentration");
    if (id === "split" && ["sourceAreaCm2", "targetAreaCm2"].includes(key)) return inputs.areaMode === "different";
    if (id === "molarity") return key !== { mass: "massG", concentration: "concentrationM", volume: "volumeL" }[mode || "mass"];
    if (id === "centrifuge") return key !== (mode === "rcf-to-rpm" ? "rpm" : "rcf");
    if (id === "percent-solution") {
      if (key === "targetMassG") return inputs.type === "w/w";
      if (key === "targetVolumeMl") return inputs.type !== "w/w";
    }
    if (id === "resuspension") {
      if (key === "amount") return mode === "amount";
      if (key === "mass") return mode !== "amount";
      if (key === "molecularWeight") return mode === "mass-molar";
      if (key === "targetMass") return mode === "mass";
      if (key === "targetMolar") return mode !== "mass";
    }
    if (id === "virus-titer") return key === "mode" || (mode === "tcid50" ? key === "tcidSeries" : key !== "tcidSeries");
    return true;
  }

  // src/lib/calculators/planning.ts
  function dilution(stock, target, volume) {
    if (![stock, target, volume].every(Number.isFinite) || stock <= 0 || target < 0 || target > stock || volume <= 0) throw new Error("\u76EE\u6807\u6D53\u5EA6\u6216\u4F53\u79EF\u4E0D\u53EF\u884C / Target concentration or volume is infeasible");
    const sample = target * volume / stock;
    return { sample, diluent: volume - sample, final: volume };
  }
  function addStock(stock, target, initial, volume) {
    if (![stock, target, initial, volume].every(Number.isFinite) || volume <= 0 || initial < 0 || target < initial || stock <= target) throw new Error("\u52A0\u5165\u6A21\u5F0F\u8981\u6C42\u6BCD\u6DB2\u6D53\u5EA6 > \u76EE\u6807\u6D53\u5EA6 \u2265 \u521D\u59CB\u6D53\u5EA6 / Require stock > target \u2265 initial");
    const sample = (target - initial) * volume / (stock - target);
    return { sample, diluent: volume, final: volume + sample };
  }
  function serialPlan(start, factor, count, volume, retained) {
    if (![start, factor, count, volume].every(Number.isFinite) || start <= 0 || factor <= 1 || !Number.isInteger(count) || count < 1 || count > 384 || volume <= 0) throw new Error("\u68AF\u5EA6\u53C2\u6570\u65E0\u6548 / Invalid gradient parameters");
    const prepared = Array(count).fill(volume);
    if (retained) for (let index = count - 2; index >= 0; index--) prepared[index] = volume + prepared[index + 1] / factor;
    return prepared.map((mixed, index) => {
      const transfer = index < count - 1 ? prepared[index + 1] / factor : 0;
      return { tube: index + 1, concentration: start / factor ** index, source: index ? `Tube ${index}` : "\u5DF2\u5907\u8D77\u59CB\u6DB2 / Prepared starting solution", takeUl: index ? mixed / factor : mixed, diluentUl: index ? mixed - mixed / factor : 0, mixedUl: mixed, transferUl: transfer, remainingUl: mixed - transfer };
    });
  }
  function mixPlan(rows, reactions, extra, final, groupId = "default", groupName = groupId) {
    if (!Number.isInteger(reactions) || reactions <= 0 || !Number.isFinite(extra) || extra < 0 || !Number.isFinite(final) || final <= 0 || !rows.length) throw new Error("\u53CD\u5E94\u53C2\u6570\u4E0D\u5B8C\u6574 / Incomplete reaction parameters");
    const volumes = rows.map((row) => row.inputMode === "concentration" ? dilution(convert(parseScalar(row.stock), row.stockUnit ?? "mM", row.targetUnit ?? "\xB5M"), parseScalar(row.target), final).sample : parseScalar(row.volume));
    if (rows.some((row) => !row.name.trim() || typeof row.premix !== "boolean") || volumes.some((v) => v < 0)) throw new Error("\u8BF7\u68C0\u67E5\u7EC4\u5206\u540D\u79F0\u53CA\u7528\u91CF / Check component names and volumes");
    const sum = volumes.reduce((a, b) => a + b, 0);
    if (sum > final + 1e-10) throw new Error("\u7EC4\u5206\u8D85\u8FC7\u5355\u53CD\u5E94\u4F53\u79EF / Components exceed reaction volume");
    const table = rows.map((row, index) => ({ component: row.name, perReactionUl: volumes[index], premix: row.premix ? "\u662F / Yes" : "\u72EC\u7ACB\u52A0\u6837 / Separate", batchUl: row.premix ? volumes[index] * (reactions + extra) : "", group: row.group || "default" }));
    if (final - sum > 1e-10) table.push({ component: "\u6C34 / Water", perReactionUl: final - sum, premix: "\u662F / Yes", batchUl: (final - sum) * (reactions + extra), group: "default" });
    const operations = rows.flatMap((row, index) => [operation(`mix:${groupId}:${row.id ?? index}`, row.name, row.premix ? volumes[index] * (reactions + extra) : volumes[index], "\xB5L", "add", { group: groupId, groupName, componentId: row.id ?? String(index), sample: row.sampleId, source: row.premix ? `stock:${index}` : `individual-samples:${row.sampleId ?? index}`, destination: row.premix ? `premix:${groupId}` : `reactions:${groupId}`, repetitions: row.premix ? 1 : reactions, inputRow: String(index) })]);
    if (final - sum > 1e-10) operations.push(operation(`mix:${groupId}:water`, "\u6C34 / Water", (final - sum) * (reactions + extra), "\xB5L", "add", { group: groupId, groupName, componentId: "auto-water", destination: `premix:${groupId}` }));
    const dispense = final - rows.reduce((s, row, index) => s + (row.premix ? 0 : volumes[index]), 0);
    if (dispense > 0) operations.push(operation(`mix:${groupId}:dispense`, "\u9884\u6DF7\u6DB2 / Premix", dispense, "\xB5L", "dispense", { group: groupId, groupName, source: `premix:${groupId}`, destination: `reactions:${groupId}`, repetitions: reactions }));
    return { operations, remaining: dispense * extra, table, total: table.reduce((s, row) => s + (typeof row.batchUl === "number" ? row.batchUl : 0), 0), separate: rows.reduce((s, row, index) => s + (row.premix ? 0 : volumes[index]), 0) };
  }
  function batchPlan(rows, target, volume, bufferFold, other = 0) {
    return rows.map((row) => {
      try {
        if (!row.id.trim() || rows.filter((other2) => other2.id.trim() === row.id.trim()).length > 1) throw new Error("\u6837\u672CID\u7F3A\u5931\u6216\u91CD\u590D / Missing or duplicate ID");
        const concentration = parseScalar(row.concentration);
        let plan;
        if (bufferFold !== void 0) {
          if (concentration <= 0 || bufferFold < 1 || volume <= 0 || target <= 0 || other < 0) throw new Error("\u53C2\u6570\u65E0\u6548 / Invalid parameters");
          const sample = target / concentration, buffer = volume / bufferFold;
          if (sample + buffer + other > volume) throw new Error("\u6D53\u5EA6\u4E0D\u8DB3 / Insufficient concentration");
          plan = { sample, diluent: volume - sample - buffer - other, buffer };
        } else plan = { ...dilution(concentration, target, volume), buffer: 0 };
        if (row.available.trim() && parseScalar(row.available) < plan.sample) throw new Error("\u53EF\u7528\u6837\u54C1\u4E0D\u8DB3 / Insufficient available sample");
        return { id: row.id, originalConcentration: row.concentration, availableUl: row.available, status: "\u6709\u6548 / Valid", sampleUl: plan.sample, diluentUl: plan.diluent, bufferUl: plan.buffer };
      } catch (error) {
        return { id: row.id, originalConcentration: row.concentration, availableUl: row.available, status: error.message, sampleUl: "", diluentUl: "", bufferUl: "" };
      }
    });
  }
  function wbPlan(rows, target, volume, bufferFold, agent) {
    const table = batchPlan(rows, target, volume, bufferFold, agent.volumeUl);
    return table.map((row) => {
      const valid = typeof row.sampleUl === "number";
      const full = { ...row, concentrationUnit: "\xB5g/\xB5L", targetProteinUg: target, reducingAgent: agent.name, reducingMode: agent.mode, reducingDefinition: agent.definition, reducingAgentUl: valid ? agent.volumeUl : "", totalUl: valid ? volume : "", volumeUnit: "\xB5L" };
      if (valid && Math.abs(Number(full.sampleUl) + Number(full.bufferUl) + Number(full.reducingAgentUl) + Number(full.diluentUl) - volume) > Math.max(1e-9, volume * 1e-9)) throw new Error("WB volume balance failed");
      return full;
    });
  }

  // src/lib/calculators/calculator-engine.ts
  var numberField = (key, label, labelZh, defaultValue, unit, min = 0) => ({ key, label, labelZh, type: "number", defaultValue, unit, min, step: "integer" === unit ? 1 : 0.01 });
  var textField = (key, label, labelZh, defaultValue, textarea = false) => ({ key, label, labelZh, type: textarea ? "textarea" : "text", defaultValue });
  var selectField = (key, label, labelZh, defaultValue, options) => ({ key, label, labelZh, type: "select", defaultValue, options: options.map(([value, en, zh]) => ({ value, label: en, labelZh: zh })) });
  var definitions = [
    { id: "hemocytometer", name: "Hemocytometer", nameZh: "\u8840\u7403\u8BA1\u6570\u677F", shortDescription: "Cell concentration from counted quadrants", shortDescriptionZh: "\u6839\u636E\u8BA1\u6570\u533A\u548C\u7A00\u91CA\u500D\u6570\u8BA1\u7B97\u7EC6\u80DE\u6D53\u5EA6", category: "cell-culture", aliases: ["cell count", "\u7EC6\u80DE\u8BA1\u6570"], plateAware: false, method: "Average count \xD7 dilution factor \xD7 10\u2074 cells/mL", methodZh: "\u5E73\u5747\u8BA1\u6570 \xD7 \u7A00\u91CA\u500D\u6570 \xD7 10\u2074 cells/mL", methodVersion: "hemocytometer-v1", fields: [textField("counts", "Quadrant counts", "\u8BA1\u6570\u533A\u7EC6\u80DE\u6570", "13,11,14,17"), numberField("dilutionFactor", "Dilution factor", "\u7A00\u91CA\u500D\u6570", 2), numberField("viabilityPercent", "Viability", "\u7EC6\u80DE\u6D3B\u7387", 90, "%")], exampleInputs: { counts: "13,11,14,17", dilutionFactor: 3, viabilityPercent: 90 } },
    { id: "seeding", name: "Seeding", nameZh: "\u7EC6\u80DE\u94FA\u677F", shortDescription: "Cells and suspension volume per well", shortDescriptionZh: "\u8BA1\u7B97\u6BCF\u5B54\u7EC6\u80DE\u91CF\u53CA\u6574\u6279\u7EC6\u80DE\u60AC\u6DB2", category: "cell-culture", aliases: ["plating", "\u94FA\u677F"], plateAware: true, method: "Cell requirement and volume balance with overage applied once", methodZh: "\u6309\u603B\u5B54\u6570\u8BA1\u7B97\u7EC6\u80DE\u9700\u6C42\u5E76\u4EC5\u7EDF\u4E00\u52A0\u5165\u4E00\u6B21\u4F59\u91CF", methodVersion: "seeding-v1", fields: [numberField("stockCellsPerMl", "Stock cell density", "\u7EC6\u80DE\u539F\u6DB2\u6D53\u5EA6", 1e6, "cells/mL"), numberField("wells", "Wells", "\u5B54\u6570", 24, "integer", 1), numberField("plates", "Plates", "\u677F\u6570", 1, "integer", 1), numberField("cellsPerWell", "Cells per well", "\u6BCF\u5B54\u7EC6\u80DE\u6570", 5e4, "cells"), numberField("volumePerWellUl", "Volume per well", "\u6BCF\u5B54\u4F53\u79EF", 500, "\xB5L"), numberField("overagePercent", "Overage", "\u989D\u5916\u4F59\u91CF", 10, "%")], exampleInputs: { stockCellsPerMl: 1e6, wells: 24, plates: 1, cellsPerWell: 5e4, volumePerWellUl: 500, overagePercent: 10 } },
    { id: "hydrogel", name: "Hydrogel", nameZh: "\u6C34\u51DD\u80F6\u57F9\u517B", shortDescription: "3D cell and hydrogel mixture", shortDescriptionZh: "\u8BA1\u7B973D\u57F9\u517B\u7684\u7EC6\u80DE\u4E0E\u6C34\u51DD\u80F6\u6DF7\u5408\u4F53\u7CFB", category: "cell-culture", aliases: ["3D culture", "Matrigel", "\u4E09\u7EF4\u57F9\u517B"], plateAware: true, method: "Target cells plus gel-to-cell-suspension volume ratio", methodZh: "\u4F9D\u636E\u76EE\u6807\u7EC6\u80DE\u91CF\u53CA\u51DD\u80F6\u4E0E\u7EC6\u80DE\u60AC\u6DB2\u4F53\u79EF\u6BD4\u8BA1\u7B97", methodVersion: "hydrogel-v1", fields: [numberField("stockCellsPerMl", "Stock cell density", "\u7EC6\u80DE\u539F\u6DB2\u6D53\u5EA6", 2e6, "cells/mL"), numberField("targetCellsPerMl", "Target density", "\u76EE\u6807\u7EC6\u80DE\u5BC6\u5EA6", 1e6, "cells/mL"), numberField("wells", "Wells", "\u5B54\u6570", 10, "integer", 1), numberField("volumePerWellUl", "Volume per well", "\u6BCF\u5B54\u4F53\u79EF", 100, "\xB5L"), numberField("gelParts", "Hydrogel parts", "\u6C34\u51DD\u80F6\u4EFD\u6570", 4), numberField("suspensionParts", "Cell suspension parts", "\u7EC6\u80DE\u60AC\u6DB2\u4EFD\u6570", 1)], exampleInputs: { stockCellsPerMl: 1e7, targetCellsPerMl: 1e6, wells: 10, volumePerWellUl: 100, gelParts: 4, suspensionParts: 1 } },
    { id: "split", name: "Split Calculator", nameZh: "\u7EC6\u80DE\u4F20\u4EE3", shortDescription: "Post-split confluency and readiness estimate", shortDescriptionZh: "\u4F30\u7B97\u4F20\u4EE3\u540E\u6C47\u5408\u5EA6\u53CA\u8FBE\u5230\u76EE\u6807\u7684\u65F6\u95F4", category: "cell-culture", aliases: ["passage", "\u4F20\u4EE3", "confluency"], plateAware: false, method: "Exponential growth estimate from confluency, split ratio, and doubling time", methodZh: "\u6839\u636E\u6C47\u5408\u5EA6\u3001\u4F20\u4EE3\u6BD4\u4F8B\u548C\u500D\u589E\u65F6\u95F4\u8FDB\u884C\u6307\u6570\u751F\u957F\u4F30\u7B97", methodVersion: "split-v1", fields: [numberField("currentConfluency", "Current confluency", "\u5F53\u524D\u6C47\u5408\u5EA6", 90, "%"), numberField("splitRatio", "Split denominator", "\u4F20\u4EE3\u6BD4\u4F8B\u5206\u6BCD", 4), numberField("targetConfluency", "Target confluency", "\u76EE\u6807\u6C47\u5408\u5EA6", 80, "%"), numberField("doublingTimeHours", "Doubling time", "\u500D\u589E\u65F6\u95F4", 24, "h")], exampleInputs: { currentConfluency: 90, splitRatio: 4, targetConfluency: 80, doublingTimeHours: 24 } },
    { id: "freezing", name: "Freezing", nameZh: "\u7EC6\u80DE\u51BB\u5B58", shortDescription: "Cryovials and freezing-medium composition", shortDescriptionZh: "\u8BA1\u7B97\u51BB\u5B58\u7BA1\u6570\u548C\u51BB\u5B58\u6DB2\u7EC4\u6210", category: "cell-culture", aliases: ["cryopreservation", "\u51BB\u5B58"], plateAware: false, method: "Available cells divided by target cells per vial; medium components by percentage", methodZh: "\u6309\u6BCF\u7BA1\u76EE\u6807\u7EC6\u80DE\u6570\u53CA\u51BB\u5B58\u6DB2\u767E\u5206\u6BD4\u8BA1\u7B97", methodVersion: "freezing-v1", fields: [numberField("totalCells", "Total cells", "\u603B\u7EC6\u80DE\u6570", 1e7, "cells"), numberField("cellsPerVial", "Cells per vial", "\u6BCF\u7BA1\u7EC6\u80DE\u6570", 1e6, "cells"), numberField("volumePerVialMl", "Volume per vial", "\u6BCF\u7BA1\u4F53\u79EF", 1, "mL"), numberField("dmsoPercent", "DMSO", "DMSO\u6BD4\u4F8B", 10, "%"), numberField("serumPercent", "Serum", "\u8840\u6E05\u6BD4\u4F8B", 20, "%")], exampleInputs: { totalCells: 1e7, cellsPerVial: 1e6, volumePerVialMl: 1, dmsoPercent: 10, serumPercent: 20 } },
    { id: "transfection", name: "Transfection", nameZh: "\u8F6C\u67D3\u4F53\u7CFB", shortDescription: "Nucleic acid and reagent master mix", shortDescriptionZh: "\u8BA1\u7B97\u6838\u9178\u3001\u8F6C\u67D3\u8BD5\u5242\u548C\u7A00\u91CA\u6DB2", category: "cell-culture", aliases: ["lipofection", "siRNA", "\u8D28\u7C92\u8F6C\u67D3"], plateAware: true, method: "Per-well nucleic acid and reagent ratio scaled by wells, replicates, and overage", methodZh: "\u6309\u6BCF\u5B54\u6838\u9178\u91CF\u3001\u8BD5\u5242\u6BD4\u4F8B\u3001\u5B54\u6570\u53CA\u4F59\u91CF\u8BA1\u7B97", methodVersion: "transfection-v1", fields: [numberField("wells", "Wells", "\u5B54\u6570", 6, "integer", 1), numberField("replicates", "Replicates", "\u91CD\u590D\u6570", 1, "integer", 1), numberField("dnaUgPerWell", "DNA per well", "\u6BCF\u5B54DNA", 2, "\xB5g"), numberField("dnaConcentrationUgUl", "DNA stock concentration", "DNA\u6BCD\u6DB2\u6D53\u5EA6", 1, "\xB5g/\xB5L"), numberField("reagentUlPerUg", "Reagent per \xB5g DNA", "\u6BCF\xB5g DNA\u8BD5\u5242\u91CF", 3, "\xB5L/\xB5g"), numberField("complexVolumeUlPerWell", "Complex volume per well", "\u6BCF\u5B54\u590D\u5408\u7269\u4F53\u79EF", 125, "\xB5L"), numberField("overagePercent", "Overage", "\u989D\u5916\u4F59\u91CF", 10, "%")], exampleInputs: { wells: 6, replicates: 1, dnaUgPerWell: 2, dnaConcentrationUgUl: 1, reagentUlPerUg: 3, complexVolumeUlPerWell: 125, overagePercent: 10 } },
    { id: "kill-curve", name: "Kill Curve", nameZh: "\u6740\u706D\u66F2\u7EBF", shortDescription: "Antibiotic dose series and stock additions", shortDescriptionZh: "\u751F\u6210\u6297\u751F\u7D20\u6D53\u5EA6\u68AF\u5EA6\u53CA\u6BCD\u6DB2\u52A0\u5165\u91CF", category: "cell-culture", aliases: ["antibiotic", "\u7B5B\u9009\u6D53\u5EA6"], plateAware: true, method: "Linear or logarithmic dose series followed by C1V1=C2V2", methodZh: "\u751F\u6210\u7EBF\u6027\u6216\u5BF9\u6570\u6D53\u5EA6\u5E8F\u5217\u540E\u6309C1V1=C2V2\u8BA1\u7B97", methodVersion: "kill-curve-v1", fields: [numberField("stockConcentration", "Stock concentration", "\u6BCD\u6DB2\u6D53\u5EA6", 10, "mg/mL"), numberField("minimum", "Minimum dose", "\u6700\u4F4E\u6D53\u5EA6", 0.5, "\xB5g/mL"), numberField("maximum", "Maximum dose", "\u6700\u9AD8\u6D53\u5EA6", 10, "\xB5g/mL"), numberField("points", "Dose points", "\u6D53\u5EA6\u70B9\u6570", 8, "integer", 2), numberField("volumePerWellMl", "Volume per well", "\u6BCF\u5B54\u4F53\u79EF", 0.5, "mL"), selectField("scale", "Scale", "\u68AF\u5EA6\u65B9\u5F0F", "linear", [["linear", "Linear", "\u7EBF\u6027"], ["log", "Logarithmic", "\u5BF9\u6570"]])], exampleInputs: { stockConcentration: 10, minimum: 0.5, maximum: 10, points: 8, volumePerWellMl: 0.5, scale: "linear" } },
    { id: "viability", name: "Viability", nameZh: "\u7EC6\u80DE\u6D3B\u7387", shortDescription: "Live/dead cells and resuspension", shortDescriptionZh: "\u8BA1\u7B97\u6D3B\u7EC6\u80DE\u3001\u6B7B\u7EC6\u80DE\u53CA\u91CD\u60AC\u4F53\u79EF", category: "cell-culture", aliases: ["trypan blue", "\u53F0\u76FC\u84DD"], plateAware: false, method: "Total cells partitioned by viability; optional live-cell target density", methodZh: "\u6309\u6D3B\u7387\u62C6\u5206\u6D3B/\u6B7B\u7EC6\u80DE\uFF0C\u5E76\u53EF\u6309\u76EE\u6807\u6D3B\u7EC6\u80DE\u6D53\u5EA6\u91CD\u60AC", methodVersion: "viability-v1", fields: [numberField("totalCells", "Total cells", "\u603B\u7EC6\u80DE\u6570", 2e5, "cells"), numberField("viabilityPercent", "Viability", "\u7EC6\u80DE\u6D3B\u7387", 90, "%"), numberField("targetLiveCellsPerMl", "Target live-cell density", "\u76EE\u6807\u6D3B\u7EC6\u80DE\u6D53\u5EA6", 1e5, "cells/mL")], exampleInputs: { totalCells: 2e5, viabilityPercent: 90, targetLiveCellsPerMl: 1e5 } },
    { id: "od600", name: "OD600", nameZh: "OD600\u83CC\u6DB2\u6D53\u5EA6", shortDescription: "Optical density to estimated cell density", shortDescriptionZh: "\u6839\u636EOD600\u4F30\u7B97\u5FAE\u751F\u7269\u6D53\u5EA6", category: "cell-culture", aliases: ["bacterial density", "\u83CC\u6DB2\u6D53\u5EA6"], plateAware: false, method: "OD600 corrected for path length and multiplied by an explicit empirical factor", methodZh: "\u6309\u5149\u7A0B\u6821\u6B63OD600\u540E\u4E58\u4EE5\u660E\u786E\u7684\u7ECF\u9A8C\u6362\u7B97\u56E0\u5B50", methodVersion: "od600-v1", fields: [numberField("od600", "OD600", "OD600\u8BFB\u6570", 0.8), numberField("pathLengthCm", "Path length", "\u5149\u7A0B", 1, "cm"), numberField("cellsPerMlPerOd", "Empirical factor", "\u7ECF\u9A8C\u6362\u7B97\u56E0\u5B50", 8e8, "cells/mL/OD"), numberField("cultureVolumeMl", "Culture volume", "\u57F9\u517B\u4F53\u79EF", 5, "mL")], exampleInputs: { od600: 0.8, pathLengthCm: 1, cellsPerMlPerOd: 8e8, cultureVolumeMl: 5 } },
    { id: "cfu", name: "CFU/mL", nameZh: "\u83CC\u843D\u5F62\u6210\u5355\u4F4D", shortDescription: "Colony-forming units from plated dilution", shortDescriptionZh: "\u6839\u636E\u83CC\u843D\u6570\u3001\u7A00\u91CA\u500D\u6570\u548C\u6D82\u677F\u4F53\u79EF\u8BA1\u7B97CFU/mL", category: "cell-culture", aliases: ["colony forming units", "\u83CC\u843D\u8BA1\u6570"], plateAware: false, method: "CFU/mL = colonies \xF7 (dilution \xD7 plated volume in mL)", methodZh: "CFU/mL = \u83CC\u843D\u6570 \xF7\uFF08\u7A00\u91CA\u5EA6 \xD7 \u6D82\u677F\u4F53\u79EFmL\uFF09", methodVersion: "cfu-v1", fields: [numberField("colonies", "Colonies", "\u83CC\u843D\u6570", 120, "integer", 1), numberField("dilution", "Dilution fraction", "\u7A00\u91CA\u5EA6", 1e-6), numberField("platedVolumeMl", "Plated volume", "\u6D82\u677F\u4F53\u79EF", 0.1, "mL"), numberField("dnaUg", "DNA amount (optional)", "DNA\u7528\u91CF\uFF08\u53EF\u9009\uFF09", 0, "\xB5g")], exampleInputs: { colonies: 120, dilution: 1e-6, platedVolumeMl: 0.1, dnaUg: 2 } },
    { id: "colony-counter", name: "Colony & Plaque Counter", nameZh: "\u83CC\u843D\u4E0E\u566C\u83CC\u6591\u8F85\u52A9\u8BA1\u6570", shortDescription: "Reviewable image-assisted counting", shortDescriptionZh: "\u53EF\u4EBA\u5DE5\u590D\u6838\u7684\u56FE\u50CF\u8F85\u52A9\u8BA1\u6570", category: "cell-culture", aliases: ["photo count", "\u83CC\u843D\u56FE\u7247", "plaque counter"], plateAware: false, method: "Browser-local connected-region detection followed by mandatory human confirmation", methodZh: "\u6D4F\u89C8\u5668\u672C\u5730\u8FDE\u901A\u533A\u57DF\u8BC6\u522B\uFF0C\u5E76\u8981\u6C42\u4EBA\u5DE5\u786E\u8BA4", methodVersion: "colony-counter-v1", fields: [numberField("automaticCount", "Automatic count", "\u81EA\u52A8\u8BC6\u522B\u6570", 42, "integer"), numberField("manualAdjustment", "Manual adjustment", "\u4EBA\u5DE5\u589E\u51CF", 0, "integer", -1e5)], exampleInputs: { automaticCount: 42, manualAdjustment: -2 } },
    { id: "reagent-dosing", name: "Reagent Dosing", nameZh: "\u8BD5\u5242\u52A0\u836F", shortDescription: "Stock addition to a desired final concentration", shortDescriptionZh: "\u4ECE\u6BCD\u6DB2\u8BA1\u7B97\u76EE\u6807\u7EC8\u6D53\u5EA6\u6240\u9700\u52A0\u5165\u91CF", category: "solutions", aliases: ["dose", "C1V1", "\u52A0\u836F"], plateAware: true, method: "C1V1 = C2V2", methodZh: "C1V1 = C2V2", methodVersion: "reagent-dosing-v1", fields: [numberField("stockConcentration", "Stock concentration", "\u6BCD\u6DB2\u6D53\u5EA6", 10, "mM"), numberField("targetConcentration", "Final concentration", "\u76EE\u6807\u7EC8\u6D53\u5EA6", 10, "\xB5M"), numberField("finalVolumeMl", "Final volume", "\u6700\u7EC8\u4F53\u79EF", 10, "mL"), numberField("stockToTargetFactor", "Stock-unit to target-unit factor", "\u6BCD\u6DB2\u5355\u4F4D\u76F8\u5BF9\u76EE\u6807\u5355\u4F4D\u500D\u6570", 1e3)], exampleInputs: { stockConcentration: 10, targetConcentration: 10, finalVolumeMl: 10, stockToTargetFactor: 1e3 } },
    { id: "dilution", name: "Dilution", nameZh: "\u5E38\u89C4\u7A00\u91CA", shortDescription: "Dilute a stock to a working concentration", shortDescriptionZh: "\u5C06\u6D53\u7F29\u6BCD\u6DB2\u7A00\u91CA\u81F3\u5DE5\u4F5C\u6D53\u5EA6", category: "solutions", aliases: ["C1V1=C2V2", "\u6BCD\u6DB2\u7A00\u91CA"], plateAware: true, method: "C1V1 = C2V2 with compatible concentration units", methodZh: "\u4F7F\u7528\u517C\u5BB9\u6D53\u5EA6\u5355\u4F4D\u7684C1V1=C2V2", methodVersion: "dilution-v1", fields: [numberField("stockConcentration", "Stock concentration", "\u6BCD\u6DB2\u6D53\u5EA6", 10), numberField("targetConcentration", "Target concentration", "\u76EE\u6807\u6D53\u5EA6", 1), numberField("finalVolume", "Final volume", "\u76EE\u6807\u603B\u4F53\u79EF", 10), selectField("volumeUnit", "Volume unit", "\u4F53\u79EF\u5355\u4F4D", "mL", [["\xB5L", "\xB5L", "\xB5L"], ["mL", "mL", "mL"], ["L", "L", "L"]])], exampleInputs: { stockConcentration: 10, targetConcentration: 1, finalVolume: 10, volumeUnit: "mL" } },
    { id: "fold-dilution", name: "Fold Dilution", nameZh: "\u500D\u6570\u7A00\u91CA", shortDescription: "Prepare 1\xD7 from a concentrated stock", shortDescriptionZh: "\u7531\u6D53\u7F29\u6DB2\u914D\u52361\xD7\u5DE5\u4F5C\u6DB2", category: "solutions", aliases: ["2x", "10x", "\u500D\u6DB2"], plateAware: true, method: "Concentrated-stock volume = final volume \xF7 fold", methodZh: "\u6D53\u7F29\u6DB2\u4F53\u79EF = \u6700\u7EC8\u4F53\u79EF \xF7 \u500D\u6570", methodVersion: "fold-dilution-v1", fields: [numberField("fold", "Stock fold", "\u6D53\u7F29\u500D\u6570", 10), numberField("finalVolume", "Final volume", "\u6700\u7EC8\u4F53\u79EF", 100, "mL")], exampleInputs: { fold: 10, finalVolume: 100 } },
    { id: "serial-dilution", name: "Serial Dilution", nameZh: "\u8FDE\u7EED\u7A00\u91CA", shortDescription: "Multi-step fixed-factor dilution", shortDescriptionZh: "\u751F\u6210\u591A\u7EA7\u56FA\u5B9A\u500D\u6570\u7A00\u91CA\u6B65\u9AA4", category: "solutions", aliases: ["\u68AF\u5EA6\u7A00\u91CA", "serial"], plateAware: true, method: "Each level transfers total volume \xF7 dilution factor from the prior level", methodZh: "\u6BCF\u4E00\u7EA7\u4ECE\u524D\u4E00\u7EA7\u8F6C\u79FB\u76EE\u6807\u603B\u4F53\u79EF\u9664\u4EE5\u7A00\u91CA\u500D\u6570", methodVersion: "serial-dilution-v1", fields: [numberField("startingConcentration", "Starting concentration", "\u8D77\u59CB\u6D53\u5EA6", 100), numberField("dilutionFactor", "Dilution factor", "\u6BCF\u7EA7\u7A00\u91CA\u500D\u6570", 10), numberField("levels", "Levels", "\u7EA7\u6570", 6, "integer", 1), numberField("totalVolumePerLevel", "Volume per level", "\u6BCF\u7EA7\u603B\u4F53\u79EF", 100, "\xB5L")], exampleInputs: { startingConcentration: 100, dilutionFactor: 10, levels: 6, totalVolumePerLevel: 100 } },
    { id: "molarity", name: "Molarity", nameZh: "\u6469\u5C14\u6D53\u5EA6", shortDescription: "Concentration, mass, or volume from molecular weight", shortDescriptionZh: "\u6839\u636E\u5206\u5B50\u91CF\u6C42\u6D53\u5EA6\u3001\u8D28\u91CF\u6216\u4F53\u79EF", category: "solutions", aliases: ["moles", "\u6469\u5C14", "\u79F0\u91CF"], plateAware: false, method: "Moles = mass \xF7 molecular weight; molarity = moles \xF7 volume", methodZh: "\u7269\u8D28\u7684\u91CF = \u8D28\u91CF \xF7 \u5206\u5B50\u91CF\uFF1B\u6469\u5C14\u6D53\u5EA6 = \u7269\u8D28\u7684\u91CF \xF7 \u4F53\u79EF", methodVersion: "molarity-v1", fields: [selectField("mode", "Solve for", "\u6C42\u89E3\u76EE\u6807", "mass", [["mass", "Mass to weigh", "\u79F0\u91CF\u8D28\u91CF"], ["concentration", "Concentration", "\u6D53\u5EA6"], ["volume", "Volume", "\u4F53\u79EF"]]), numberField("molecularWeight", "Molecular weight", "\u5206\u5B50\u91CF", 180.16, "g/mol"), numberField("concentrationM", "Concentration", "\u6469\u5C14\u6D53\u5EA6", 0.1, "M"), numberField("volumeL", "Volume", "\u4F53\u79EF", 0.1, "L"), numberField("massG", "Mass", "\u8D28\u91CF", 1.8016, "g")], exampleInputs: { mode: "mass", molecularWeight: 180.16, concentrationM: 0.1, volumeL: 0.1, massG: 1.8016 } },
    { id: "percent-solution", name: "% Solution", nameZh: "\u767E\u5206\u6BD4\u6EB6\u6DB2", shortDescription: "w/v or v/v solution preparation", shortDescriptionZh: "\u914D\u5236w/v\u6216v/v\u767E\u5206\u6BD4\u6EB6\u6DB2", category: "solutions", aliases: ["w/v", "v/v", "\u767E\u5206\u6D53\u5EA6"], plateAware: false, method: "% w/v = g per 100 mL; % v/v = mL per 100 mL", methodZh: "% w/v\u8868\u793A\u6BCF100 mL\u4E2D\u7684\u514B\u6570\uFF1B% v/v\u8868\u793A\u6BCF100 mL\u4E2D\u7684\u6BEB\u5347\u6570", methodVersion: "percent-solution-v1", fields: [selectField("type", "Solution type", "\u6EB6\u6DB2\u7C7B\u578B", "w/v", [["w/v", "w/v", "\u8D28\u91CF/\u4F53\u79EF"], ["v/v", "v/v", "\u4F53\u79EF/\u4F53\u79EF"]]), numberField("percentage", "Percentage", "\u767E\u5206\u6D53\u5EA6", 5, "%"), numberField("targetVolumeMl", "Target volume", "\u76EE\u6807\u4F53\u79EF", 500, "mL")], exampleInputs: { type: "w/v", percentage: 5, targetVolumeMl: 500 } },
    { id: "media-recipe", name: "Media Recipe", nameZh: "\u57F9\u517B\u57FA\u914D\u65B9", shortDescription: "Scale a custom medium recipe", shortDescriptionZh: "\u6309\u76EE\u6807\u4F53\u79EF\u7F29\u653E\u57F9\u517B\u57FA\u914D\u65B9", category: "solutions", aliases: ["culture medium", "\u57F9\u517B\u6DB2"], plateAware: false, method: "Each component scales linearly from the recipe base volume", methodZh: "\u5404\u7EC4\u5206\u6309\u914D\u65B9\u57FA\u7840\u4F53\u79EF\u7EBF\u6027\u7F29\u653E", methodVersion: "media-recipe-v1", fields: [numberField("baseVolumeMl", "Recipe base volume", "\u914D\u65B9\u57FA\u7840\u4F53\u79EF", 500, "mL"), numberField("targetVolumeMl", "Target volume", "\u76EE\u6807\u4F53\u79EF", 1e3, "mL"), textField("components", "Components (name, amount, unit)", "\u7EC4\u5206\uFF08\u540D\u79F0,\u7528\u91CF,\u5355\u4F4D\uFF09", "FBS,50,mL\nPen/Strep,5,mL", true)], exampleInputs: { baseVolumeMl: 500, targetVolumeMl: 1e3, components: "FBS,50,mL\nPen/Strep,5,mL" } },
    { id: "buffer-recipe", name: "Buffer Recipe", nameZh: "\u7F13\u51B2\u6DB2\u914D\u65B9", shortDescription: "Scale a custom buffer recipe", shortDescriptionZh: "\u6309\u76EE\u6807\u4F53\u79EF\u7F29\u653E\u7F13\u51B2\u6DB2\u914D\u65B9", category: "solutions", aliases: ["PBS", "Tris", "\u7F13\u51B2\u6DB2"], plateAware: false, method: "Each component scales linearly from the recipe base volume", methodZh: "\u5404\u7EC4\u5206\u6309\u914D\u65B9\u57FA\u7840\u4F53\u79EF\u7EBF\u6027\u7F29\u653E", methodVersion: "buffer-recipe-v1", fields: [numberField("baseVolumeMl", "Recipe base volume", "\u914D\u65B9\u57FA\u7840\u4F53\u79EF", 1e3, "mL"), numberField("targetVolumeMl", "Target volume", "\u76EE\u6807\u4F53\u79EF", 500, "mL"), textField("components", "Components (name, amount, unit)", "\u7EC4\u5206\uFF08\u540D\u79F0,\u7528\u91CF,\u5355\u4F4D\uFF09", "NaCl,8,g\nKCl,0.2,g", true)], exampleInputs: { baseVolumeMl: 1e3, targetVolumeMl: 500, components: "NaCl,8,g\nKCl,0.2,g" } },
    { id: "ic50-ec50", name: "IC50 / EC50", nameZh: "IC50 / EC50\u62DF\u5408", shortDescription: "Four-parameter logistic dose-response fit", shortDescriptionZh: "\u56DB\u53C2\u6570Logistic\u5242\u91CF\u53CD\u5E94\u62DF\u5408", category: "solutions", aliases: ["4PL", "dose response", "\u534A\u6570\u6291\u5236"], plateAware: false, method: "Four-parameter logistic model fitted by deterministic coordinate descent", methodZh: "\u4F7F\u7528\u786E\u5B9A\u6027\u5750\u6807\u4E0B\u964D\u62DF\u5408\u56DB\u53C2\u6570Logistic\u6A21\u578B", methodVersion: "four-pl-v2", fields: [selectField("mode", "Response direction", "\u53CD\u5E94\u65B9\u5411", "activation", [["inhibition", "Remaining response (falling)", "\u6B8B\u5B58\u53CD\u5E94\uFF08\u4E0B\u964D\uFF09"], ["activation", "Activation (rising)", "\u6FC0\u6D3B\u53CD\u5E94\uFF08\u4E0A\u5347\uFF09"]]), textField("points", "Dose,response pairs", "\u6D53\u5EA6,\u53CD\u5E94\u503C", "0.1,1\n1,10\n10,50\n100,90\n1000,99", true)], exampleInputs: { mode: "activation", points: "0.1,1\n1,10\n10,50\n100,90\n1000,99" } },
    { id: "master-mix", name: "Master Mix", nameZh: "Master Mix\u4F53\u7CFB", shortDescription: "Scale repeated reaction components", shortDescriptionZh: "\u6309\u53CD\u5E94\u6570\u548C\u4F59\u91CF\u8BA1\u7B97\u6574\u6279\u53CD\u5E94\u4F53\u7CFB", category: "molecular-biology", aliases: ["PCR mix", "\u53CD\u5E94\u4F53\u7CFB"], plateAware: true, method: "Per-reaction components \xD7 reactions \xD7 (1 + overage)", methodZh: "\u5355\u53CD\u5E94\u7EC4\u5206 \xD7 \u53CD\u5E94\u6570 \xD7\uFF081 + \u4F59\u91CF\uFF09", methodVersion: "master-mix-v1", fields: [numberField("reactions", "Reactions", "\u53CD\u5E94\u6570", 10, "integer", 1), numberField("overagePercent", "Overage", "\u989D\u5916\u4F59\u91CF", 10, "%"), textField("components", "Components (name, \xB5L/reaction)", "\u7EC4\u5206\uFF08\u540D\u79F0,\u6BCF\u53CD\u5E94\xB5L\uFF09", "2\xD7 SYBR Mix,10\nForward primer,0.5\nReverse primer,0.5\nWater,8", true)], exampleInputs: { reactions: 10, overagePercent: 10, components: "2\xD7 SYBR Mix,10\nForward primer,0.5\nReverse primer,0.5\nWater,8" } },
    { id: "ligation", name: "Ligation", nameZh: "\u8FDE\u63A5\u53CD\u5E94", shortDescription: "Insert mass for a vector:insert molar ratio", shortDescriptionZh: "\u6309\u8F7D\u4F53\u4E0E\u63D2\u5165\u7247\u6BB5\u6469\u5C14\u6BD4\u8BA1\u7B97\u63D2\u5165\u7247\u6BB5\u8D28\u91CF", category: "molecular-biology", aliases: ["cloning", "\u8F7D\u4F53\u8FDE\u63A5"], plateAware: false, method: "Insert ng = vector ng \xD7 insert bp \xF7 vector bp \xD7 molar ratio", methodZh: "\u63D2\u5165\u7247\u6BB5ng = \u8F7D\u4F53ng \xD7 \u63D2\u5165\u7247\u6BB5bp \xF7 \u8F7D\u4F53bp \xD7 \u6469\u5C14\u6BD4", methodVersion: "ligation-v1", fields: [numberField("vectorBp", "Vector length", "\u8F7D\u4F53\u957F\u5EA6", 5e3, "bp"), numberField("insertBp", "Insert length", "\u63D2\u5165\u7247\u6BB5\u957F\u5EA6", 1e3, "bp"), numberField("vectorNg", "Vector mass", "\u8F7D\u4F53\u8D28\u91CF", 50, "ng"), numberField("molarRatio", "Insert:vector molar ratio", "\u63D2\u5165:\u8F7D\u4F53\u6469\u5C14\u6BD4", 3)], exampleInputs: { vectorBp: 5e3, insertBp: 1e3, vectorNg: 50, molarRatio: 3 } },
    { id: "tm", name: "Tm Calculator", nameZh: "\u5F15\u7269Tm\u8BA1\u7B97", shortDescription: "Primer melting-temperature estimate", shortDescriptionZh: "\u6839\u636E\u5E8F\u5217\u4E0E\u76D0\u6761\u4EF6\u4F30\u7B97\u5F15\u7269\u7194\u89E3\u6E29\u5EA6", category: "molecular-biology", aliases: ["primer", "melting temperature", "\u5F15\u7269"], plateAware: false, method: "Wallace rule for short oligos; empirical long-oligo formula with monovalent-salt correction", methodZh: "\u77ED\u5BE1\u6838\u82F7\u9178\u4F7F\u7528Wallace\u89C4\u5219\uFF0C\u957F\u5E8F\u5217\u4F7F\u7528\u542B\u5355\u4EF7\u76D0\u6821\u6B63\u7684\u7ECF\u9A8C\u516C\u5F0F", methodVersion: "tm-basic-v1", fields: [textField("sequence", "Primer sequence", "\u5F15\u7269\u5E8F\u5217", "ATGCGTACGTTAGCTAAGCT"), numberField("sodiumMm", "Monovalent salt", "\u5355\u4EF7\u76D0\u6D53\u5EA6", 50, "mM")], exampleInputs: { sequence: "ATGCGTACGTTAGCTAAGCT", sodiumMm: 50 } },
    { id: "dna-rna-conversion", name: "DNA / RNA Conversions", nameZh: "DNA / RNA\u6362\u7B97", shortDescription: "Mass, moles, molecules, and concentration", shortDescriptionZh: "\u8D28\u91CF\u3001\u6469\u5C14\u6570\u3001\u5206\u5B50\u6570\u548C\u6D53\u5EA6\u6362\u7B97", category: "molecular-biology", aliases: ["copies", "molecules", "\u6838\u9178\u6362\u7B97"], plateAware: false, method: "Molecular weight from length and nucleic-acid type; molecules from Avogadro constant", methodZh: "\u6309\u957F\u5EA6\u4E0E\u6838\u9178\u7C7B\u578B\u4F30\u7B97\u5206\u5B50\u91CF\uFF0C\u518D\u7528\u963F\u4F0F\u4F3D\u5FB7\u7F57\u5E38\u6570\u8BA1\u7B97\u5206\u5B50\u6570", methodVersion: "nucleic-acid-conversion-v1", fields: [selectField("type", "Nucleic acid", "\u6838\u9178\u7C7B\u578B", "dsDNA", [["dsDNA", "dsDNA", "\u53CC\u94FEDNA"], ["ssDNA", "ssDNA", "\u5355\u94FEDNA"], ["RNA", "RNA", "RNA"]]), numberField("length", "Length", "\u957F\u5EA6", 500, "nt/bp"), numberField("massUg", "Mass", "\u8D28\u91CF", 1, "\xB5g"), numberField("volumeUl", "Volume", "\u4F53\u79EF", 20, "\xB5L")], exampleInputs: { type: "dsDNA", length: 500, massUg: 1, volumeUl: 20 } },
    { id: "bradford-bca", name: "Bradford / BCA", nameZh: "Bradford / BCA\u86CB\u767D\u5B9A\u91CF", shortDescription: "Protein standard curve and sample back-calculation", shortDescriptionZh: "\u86CB\u767D\u6807\u51C6\u66F2\u7EBF\u62DF\u5408\u4E0E\u6837\u54C1\u6D53\u5EA6\u56DE\u7B97", category: "molecular-biology", aliases: ["protein assay", "\u6807\u51C6\u66F2\u7EBF", "\u86CB\u767D\u6D53\u5EA6"], plateAware: false, method: "Blank-corrected ordinary least-squares linear standard curve", methodZh: "\u7A7A\u767D\u6263\u9664\u540E\u7684\u666E\u901A\u6700\u5C0F\u4E8C\u4E58\u7EBF\u6027\u6807\u51C6\u66F2\u7EBF", methodVersion: "protein-linear-v1", fields: [textField("standards", "Standards (concentration, absorbance)", "\u6807\u51C6\u54C1\uFF08\u6D53\u5EA6,\u5438\u5149\u5EA6\uFF09", "0,0.05\n0.25,0.18\n0.5,0.31\n1,0.57\n1.5,0.82", true), numberField("sampleAbsorbance", "Sample absorbance", "\u6837\u54C1\u5438\u5149\u5EA6", 0.44), numberField("dilutionFactor", "Sample dilution factor", "\u6837\u54C1\u7A00\u91CA\u500D\u6570", 2)], exampleInputs: { standards: "0,0.05\n0.25,0.18\n0.5,0.31\n1,0.57\n1.5,0.82", sampleAbsorbance: 0.44, dilutionFactor: 2 } },
    { id: "elisa-4pl", name: "ELISA 4PL", nameZh: "ELISA\u56DB\u53C2\u6570\u62DF\u5408", shortDescription: "ELISA standard curve and sample back-calculation", shortDescriptionZh: "ELISA\u6807\u51C6\u66F2\u7EBF\u62DF\u5408\u548C\u6837\u54C1\u6D53\u5EA6\u56DE\u7B97", category: "molecular-biology", aliases: ["ELISA", "4PL", "\u514D\u75AB\u6D4B\u5B9A"], plateAware: false, method: "Four-parameter logistic standard curve with inverse sample calculation", methodZh: "\u56DB\u53C2\u6570Logistic\u6807\u51C6\u66F2\u7EBF\u53CA\u6837\u54C1\u53CD\u7B97", methodVersion: "elisa-four-pl-v1", fields: [textField("standards", "Standards (concentration, signal)", "\u6807\u51C6\u54C1\uFF08\u6D53\u5EA6,\u4FE1\u53F7\uFF09", "0.1,0.08\n1,0.2\n10,1.0\n100,1.8\n1000,1.95", true), numberField("sampleSignal", "Sample signal", "\u6837\u54C1\u4FE1\u53F7", 1), numberField("dilutionFactor", "Sample dilution factor", "\u6837\u54C1\u7A00\u91CA\u500D\u6570", 1)], exampleInputs: { standards: "0.1,0.08\n1,0.2\n10,1.0\n100,1.8\n1000,1.95", sampleSignal: 1, dilutionFactor: 1 } },
    { id: "wb-loading", name: "WB Loading", nameZh: "Western Blot\u4E0A\u6837", shortDescription: "Sample, loading buffer, and reducing agent", shortDescriptionZh: "\u8BA1\u7B97\u6837\u54C1\u3001Loading Buffer\u4E0E\u8FD8\u539F\u5242", category: "molecular-biology", aliases: ["western blot", "\u4E0A\u6837\u4F53\u7CFB"], plateAware: false, method: "Sample volume from target protein mass; concentrated buffer by final fold", methodZh: "\u6309\u76EE\u6807\u86CB\u767D\u8D28\u91CF\u8BA1\u7B97\u6837\u54C1\u4F53\u79EF\uFF0C\u5E76\u6309\u7EC8\u6D53\u5EA6\u8BA1\u7B97\u6D53\u7F29\u4E0A\u6837\u7F13\u51B2\u6DB2", methodVersion: "wb-loading-v1", fields: [numberField("sampleConcentrationUgUl", "Sample concentration", "\u6837\u54C1\u6D53\u5EA6", 2, "\xB5g/\xB5L"), numberField("targetProteinUg", "Protein per lane", "\u6BCF\u5B54\u86CB\u767D\u91CF", 20, "\xB5g"), numberField("finalLoadingVolumeUl", "Final loading volume", "\u6700\u7EC8\u4E0A\u6837\u4F53\u79EF", 20, "\xB5L"), numberField("bufferFold", "Loading buffer stock", "Loading Buffer\u500D\u6570", 4), numberField("reducingAgentPercent", "Reducing agent", "\u8FD8\u539F\u5242\u6BD4\u4F8B", 5, "%")], exampleInputs: { sampleConcentrationUgUl: 2, targetProteinUg: 20, finalLoadingVolumeUl: 20, bufferFold: 4, reducingAgentPercent: 5 } },
    { id: "moi", name: "MOI", nameZh: "\u611F\u67D3\u590D\u6570 MOI", shortDescription: "Virus amount and Poisson infection probabilities", shortDescriptionZh: "\u8BA1\u7B97\u75C5\u6BD2\u7528\u91CF\u53CA\u6CCA\u677E\u611F\u67D3\u6982\u7387", category: "virology-microbiology", aliases: ["multiplicity of infection", "\u75C5\u6BD2\u611F\u67D3"], plateAware: true, method: "Particles required = cells \xD7 MOI; Poisson probabilities use e^-MOI", methodZh: "\u6240\u9700\u611F\u67D3\u5355\u4F4D = \u7EC6\u80DE\u6570 \xD7 MOI\uFF1B\u611F\u67D3\u6982\u7387\u6309e^-MOI\u8BA1\u7B97", methodVersion: "moi-v1", fields: [numberField("cells", "Cells", "\u7EC6\u80DE\u6570", 1e6, "cells"), numberField("desiredMoi", "Desired MOI", "\u76EE\u6807MOI", 1), numberField("titer", "Virus titer", "\u75C5\u6BD2\u6EF4\u5EA6", 1e8), selectField("titerUnit", "Titer unit", "\u6EF4\u5EA6\u5355\u4F4D", "PFU/mL", [["PFU/mL", "PFU/mL", "PFU/mL"], ["IU/mL", "IU/mL", "IU/mL"], ["TU/mL", "TU/mL", "TU/mL"], ["VG/mL", "VG/mL", "VG/mL"]])], exampleInputs: { cells: 1e6, desiredMoi: 1, titer: 1e8, titerUnit: "PFU/mL" } },
    { id: "virus-titer", name: "Virus Titer", nameZh: "\u75C5\u6BD2\u6EF4\u5EA6", shortDescription: "Plaque-assay PFU/mL or TCID50 estimate", shortDescriptionZh: "\u566C\u83CC\u6591PFU/mL\u6216TCID50\u4F30\u7B97", category: "virology-microbiology", aliases: ["PFU", "TCID50", "\u75C5\u6BD2\u6EF4\u5EA6"], plateAware: false, method: "Plaque assay: plaques \xF7 (dilution \xD7 inoculum mL); TCID50 remains a distinct mode", methodZh: "\u566C\u83CC\u6591\u6CD5\uFF1A\u6591\u6570 \xF7\uFF08\u7A00\u91CA\u5EA6 \xD7 \u63A5\u79CD\u4F53\u79EFmL\uFF09\uFF1BTCID50\u4FDD\u6301\u72EC\u7ACB\u6A21\u5F0F", methodVersion: "virus-titer-v1", fields: [selectField("mode", "Method", "\u65B9\u6CD5", "plaque", [["plaque", "Plaque assay", "\u566C\u83CC\u6591\u6CD5"], ["tcid50", "TCID50", "TCID50"]]), numberField("plaques", "Plaques", "\u566C\u83CC\u6591\u6570", 20, "integer", 1), numberField("dilution", "Dilution fraction", "\u7A00\u91CA\u5EA6", 1e-6), numberField("inoculumMl", "Inoculum volume", "\u63A5\u79CD\u4F53\u79EF", 0.1, "mL"), textField("tcidSeries", "TCID50 positive wells (dilution,positive,total)", "TCID50\u9633\u6027\u5B54\uFF08\u7A00\u91CA\u5EA6,\u9633\u6027\u6570,\u603B\u5B54\u6570\uFF09", "0.001,8,8\n0.0001,6,8\n0.00001,2,8\n0.000001,0,8", true)], exampleInputs: { mode: "plaque", plaques: 20, dilution: 1e-6, inoculumMl: 0.1 } },
    { id: "unit-converter", name: "Unit Converter", nameZh: "\u5355\u4F4D\u6362\u7B97", shortDescription: "Mass, volume, concentration, and temperature", shortDescriptionZh: "\u8D28\u91CF\u3001\u4F53\u79EF\u3001\u6D53\u5EA6\u548C\u6E29\u5EA6\u6362\u7B97", category: "general", aliases: ["convert", "\u6362\u7B97"], plateAware: false, method: "Dimension-specific SI conversion; temperature uses affine conversion", methodZh: "\u540C\u7EF4\u5EA6SI\u5355\u4F4D\u6362\u7B97\uFF1B\u6E29\u5EA6\u4F7F\u7528\u4EFF\u5C04\u6362\u7B97", methodVersion: "unit-converter-v1", fields: [selectField("dimension", "Dimension", "\u6362\u7B97\u7C7B\u578B", "volume", [["mass", "Mass", "\u8D28\u91CF"], ["volume", "Volume", "\u4F53\u79EF"], ["concentration", "Concentration", "\u6D53\u5EA6"], ["temperature", "Temperature", "\u6E29\u5EA6"]]), numberField("value", "Value", "\u6570\u503C", 1), textField("fromUnit", "From unit", "\u539F\u5355\u4F4D", "mL"), textField("toUnit", "To unit", "\u76EE\u6807\u5355\u4F4D", "\xB5L")], exampleInputs: { dimension: "volume", value: 1, fromUnit: "mL", toUnit: "\xB5L" } },
    { id: "centrifuge", name: "Centrifuge", nameZh: "\u79BB\u5FC3\u6362\u7B97", shortDescription: "RPM and RCF conversion", shortDescriptionZh: "RPM\u4E0ERCF\u76F8\u4E92\u6362\u7B97", category: "general", aliases: ["g force", "\u8F6C\u901F", "\u79BB\u5FC3\u529B"], plateAware: false, method: "RCF = 1.118 \xD7 10\u207B\u2075 \xD7 radius(cm) \xD7 RPM\xB2", methodZh: "RCF = 1.118 \xD7 10\u207B\u2075 \xD7 \u534A\u5F84(cm) \xD7 RPM\xB2", methodVersion: "centrifuge-v1", fields: [selectField("mode", "Conversion", "\u6362\u7B97\u65B9\u5411", "rpm-to-rcf", [["rpm-to-rcf", "RPM to RCF", "RPM\u8F6CRCF"], ["rcf-to-rpm", "RCF to RPM", "RCF\u8F6CRPM"]]), numberField("rpm", "RPM", "\u8F6C\u901F", 1e4, "rpm"), numberField("rcf", "RCF", "\u76F8\u5BF9\u79BB\u5FC3\u529B", 11180, "\xD7g"), numberField("radiusCm", "Rotor radius", "\u8F6C\u5B50\u534A\u5F84", 10, "cm")], exampleInputs: { mode: "rpm-to-rcf", rpm: 1e4, radiusCm: 10 } }
  ];
  definitions.push(...newDefinitions);
  var byId = new Map(definitions.map((definition) => [definition.id, definition]));
  var round = (value) => value;
  var num = (inputs, key, options = {}) => {
    const value = parseScalar(inputs[key]);
    if (key === "dilution" && value > 1) throw new Error("\u7A00\u91CA\u5EA6\u4E0D\u5F97\u8D85\u8FC71 / Dilution fraction must not exceed 1");
    if (["points", "levels"].includes(key) && value > 384) throw new Error("\u6700\u591A384\u4E2A\u6D53\u5EA6\u70B9 / Maximum 384 concentration points");
    if (["wells", "plates", "replicates", "points", "levels", "reactions", "colonies", "plaques", "automaticCount", "manualAdjustment", "samples", "controls", "cells", "cellsPerWell", "vectorBp", "insertBp", "length"].includes(key) && !Number.isInteger(value)) throw new Error(`${key}: \u5FC5\u987B\u662F\u6574\u6570 / Must be an integer`);
    if (["viabilityPercent", "currentConfluency", "targetConfluency"].includes(key) && value > 100) throw new Error(`${key}: \u4E0D\u5F97\u8D85\u8FC7100% / Must not exceed 100%`);
    if (!Number.isFinite(value) || options.positive && value <= 0 || options.min !== void 0 && value < options.min) throw new Error(`${key} must be a valid number${options.positive ? " greater than zero" : ""}.`);
    return value;
  };
  var str = (inputs, key) => String(inputs[key] ?? "").trim();
  var parseNumbers = (value) => String(value ?? "").trim().split(/[\s,;]+/).map((item) => {
    const n2 = parseScalar(item);
    if (n2 < 0 || !Number.isInteger(n2)) throw new Error("\u8BA1\u6570\u5FC5\u987B\u662F\u975E\u8D1F\u6574\u6570 / Counts must be nonnegative integers");
    return n2;
  });
  var parseRows = (value, columns2 = 2) => String(value ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => line.split(/[,\t]/).map((part) => part.trim())).map((row) => {
    if (row.length < columns2 || row.some((cell) => !cell)) throw new Error("\u8868\u683C\u542B\u4E0D\u5B8C\u6574\u884C / Incomplete table row");
    return row;
  });
  var out = (key, label, labelZh, value, unit) => ({ key, label, labelZh, value: typeof value === "number" ? round(value) : value, unit });
  var finish = (definition, outputs, warnings = [], notes = [], table) => ({ calculatorId: definition.id, methodVersion: definition.methodVersion.replace(/-v1$/, "-v2"), outputs, outputMap: Object.fromEntries(outputs.map((item) => [item.key, item.value])), warnings, notes, table });
  function linearRegression(rows) {
    if (rows.length < 2 || rows.some((row) => row.some((n3) => !Number.isFinite(n3)))) throw new Error("At least two finite standard points are required.");
    const n2 = rows.length;
    const sx = rows.reduce((s, r) => s + r[0], 0), sy = rows.reduce((s, r) => s + r[1], 0);
    const sxx = rows.reduce((s, r) => s + r[0] ** 2, 0), sxy = rows.reduce((s, r) => s + r[0] * r[1], 0);
    const denominator = n2 * sxx - sx ** 2;
    if (Math.abs(denominator) < 1e-12) throw new Error("Standard concentrations must not all be identical.");
    const slope = (n2 * sxy - sx * sy) / denominator;
    const intercept = (sy - slope * sx) / n2;
    const mean = sy / n2;
    const ssTotal = rows.reduce((s, r) => s + (r[1] - mean) ** 2, 0);
    const ssResidual = rows.reduce((s, r) => s + (r[1] - (slope * r[0] + intercept)) ** 2, 0);
    return { slope, intercept, r2: ssTotal ? 1 - ssResidual / ssTotal : 1 };
  }
  function fourPlFit(rows, responseDirection) {
    if (rows.some(([x, y]) => !Number.isFinite(x) || x <= 0 || !Number.isFinite(y))) throw new Error("4PL\u8981\u6C42\u5B8C\u6574\u7684\u6B63\u6D53\u5EA6\u6570\u636E / 4PL requires finite positive concentration data");
    const points = [...rows].sort((a, b) => a[0] - b[0]);
    if (points.length < 4) throw new Error("At least four positive-concentration points are required for 4PL fitting.");
    if (new Set(points.map((point) => point[0])).size < 4) throw new Error("4PL\u81F3\u5C11\u9700\u8981\u56DB\u4E2A\u4E0D\u540C\u6D53\u5EA6 / At least four distinct concentrations required");
    const ys = points.map((p) => p[1]);
    if (Math.max(...ys) === Math.min(...ys)) throw new Error("\u53CD\u5E94\u503C\u6CA1\u6709\u53D8\u5316\uFF0C\u65E0\u6CD5\u62DF\u5408 / Constant response cannot identify a curve");
    if (responseDirection && (ys.at(-1) - ys[0]) * responseDirection <= 0) throw new Error("Response data do not support the selected curve direction.");
    let params = [Math.min(...ys), Math.max(...ys), points[Math.floor(points.length / 2)][0], points.at(-1)[1] >= points[0][1] ? 1 : -1];
    const score = (p) => points.reduce((sum, [x, y]) => {
      const e = y - (p[0] + (p[1] - p[0]) / (1 + (p[2] / x) ** p[3]));
      return sum + e * e;
    }, 0);
    let step = [Math.max(1, Math.abs(params[1] - params[0]) * 0.1), Math.max(1, Math.abs(params[1] - params[0]) * 0.1), params[2] * 0.5, 0.5];
    let best = score(params);
    for (let iteration = 0; iteration < 800; iteration += 1) {
      let improved = false;
      for (let index = 0; index < 4; index += 1) for (const direction of [-1, 1]) {
        const candidate = [...params];
        candidate[index] += step[index] * direction;
        if (candidate[1] <= candidate[0] || candidate[2] <= 0 || Math.abs(candidate[3]) <= 0.05 || Math.abs(candidate[3]) > 10 || responseDirection !== void 0 && candidate[3] * responseDirection <= 0.05) continue;
        const next = score(candidate);
        if (next < best) {
          params = candidate;
          best = next;
          improved = true;
        }
      }
      if (!improved) step = step.map((value) => value * 0.7);
      if (Math.max(...step) < 1e-8) break;
    }
    const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
    const total = ys.reduce((s, y) => s + (y - mean) ** 2, 0);
    return { bottom: params[0], top: params[1], ec50: params[2], hill: params[3], converged: Math.max(...step) < 1e-8, r2: total ? 1 - best / total : 1 };
  }
  function getCalculatorCatalog() {
    return definitions.map((definition) => enhanceDefinition({ ...definition, exampleInputs: { ...definition.exampleInputs }, fields: definition.fields.map((field) => ({ ...field })) }));
  }
  function getCalculatorDefinition(id) {
    const definition = byId.get(id);
    if (!definition) throw new Error(`Unknown calculator: ${id}`);
    return enhanceDefinition({ ...definition, exampleInputs: { ...definition.exampleInputs }, fields: definition.fields.map((field) => ({ ...field })) });
  }
  function calculateInternal(request) {
    const definition = byId.get(request.calculatorId);
    if (!definition) throw new Error(`Unknown calculator: ${request.calculatorId}`);
    const i = { ...request.inputs };
    const current = getCalculatorDefinition(definition.id);
    if (["ic50-ec50", "bradford-bca", "elisa-4pl"].includes(definition.id) && i.concentrationUnit === "") throw new Error("\u8BF7\u9009\u62E9\u6D53\u5EA6\u5355\u4F4D / Choose concentration units");
    for (const field of current.fields) {
      if (!isFieldVisible(definition.id, field.key, i)) continue;
      if (field.type === "select" && i[field.key] !== void 0 && !field.options?.some((option) => option.value === i[field.key])) throw new Error(`${field.labelZh} / ${field.label}: \u65E0\u6548\u9009\u9879 / Invalid option`);
      if (["dilution", "reagent-dosing", "fold-dilution"].includes(definition.id) && ["stockConcentration", "targetConcentration", "initialConcentration"].includes(field.key)) continue;
      const selectedUnit = i[`${field.key}Unit`];
      if (field.unit && typeof selectedUnit === "string") i[field.key] = convert(parseScalar(i[field.key]), selectedUnit, field.unit);
    }
    if (definition.id === "wb-loading" && i.bufferContainsReducingAgent === "yes") i.reducingAgentPercent = 0;
    if (definition.id === "seeding" && i.plates === void 0) i.plates = 1;
    if (definition.id === "molarity" && (i.purityPercent === "" || i.purityPercent === void 0)) i.purityPercent = 100;
    switch (definition.id) {
      case "hemocytometer": {
        const counts = parseNumbers(i.counts);
        if (!counts.length) throw new Error("Enter at least one quadrant count.");
        const average = counts.reduce((a, b) => a + b, 0) / counts.length;
        const concentration = average * num(i, "dilutionFactor", { positive: true }) * (i.countRegion === "custom" ? 1e3 / (num(i, "areaMm2", { positive: true }) * num(i, "depthMm", { positive: true })) : 1e4);
        const viability = num(i, "viabilityPercent", { min: 0 });
        return finish(definition, [out("averageCount", "Average count", "\u5E73\u5747\u8BA1\u6570", average, "cells/quadrant"), out("concentrationCellsPerMl", "Cell concentration", "\u7EC6\u80DE\u6D53\u5EA6", concentration, "cells/mL"), out("viableCellsPerMl", "Viable-cell concentration", "\u6D3B\u7EC6\u80DE\u6D53\u5EA6", concentration * viability / 100, "cells/mL")], viability > 100 ? ["Viability exceeds 100%. Check the input."] : []);
      }
      case "seeding": {
        const wells = num(i, "wells", { positive: true }) * num(i, "plates", { positive: true });
        const factor = 1 + num(i, "overagePercent", { min: 0 }) / 100;
        const totalCells = num(i, "cellsPerWell", { positive: true }) * wells * factor;
        const finalMl = num(i, "volumePerWellUl", { positive: true }) * wells * factor / 1e3;
        const stockMl = totalCells / num(i, "stockCellsPerMl", { positive: true });
        if (stockMl > finalMl) throw new Error("Stock cell density is too low for the requested seeding density and volume.");
        return finish(definition, [out("totalCells", "Total cells", "\u603B\u7EC6\u80DE\u6570", totalCells, "cells"), out("stockVolumeMl", "Cell suspension", "\u7EC6\u80DE\u60AC\u6DB2", stockMl, "mL"), out("mediumVolumeMl", "Medium", "\u57F9\u517B\u57FA", finalMl - stockMl, "mL"), out("finalVolumeMl", "Final suspension", "\u6700\u7EC8\u60AC\u6DB2", finalMl, "mL")]);
      }
      case "hydrogel": {
        const totalUl = num(i, "wells", { positive: true }) * num(i, "volumePerWellUl", { positive: true });
        const totalCells = num(i, "targetCellsPerMl", { positive: true }) * totalUl / 1e3;
        const cellStockUl = totalCells / num(i, "stockCellsPerMl", { positive: true }) * 1e3;
        const parts = num(i, "gelParts", { positive: true }) + num(i, "suspensionParts", { positive: true });
        const gelUl = totalUl * num(i, "gelParts", { positive: true }) / parts;
        const suspensionUl = totalUl - gelUl;
        if (cellStockUl > suspensionUl) throw new Error("\u7EC6\u80DE\u539F\u6DB2\u8D85\u8FC7\u60AC\u6DB2\u5206\u91CF / Cell stock exceeds suspension fraction");
        return finish(definition, [out("totalCells", "Total cells", "\u603B\u7EC6\u80DE\u6570", totalCells, "cells"), out("hydrogelUl", "Hydrogel", "\u6C34\u51DD\u80F6", gelUl, "\xB5L"), out("cellStockUl", "Cell stock", "\u7EC6\u80DE\u539F\u6DB2", cellStockUl, "\xB5L"), out("mediumUl", "Suspension medium", "\u60AC\u6DB2\u57F9\u517B\u57FA", Math.max(0, suspensionUl - cellStockUl), "\xB5L")], cellStockUl > suspensionUl ? ["The requested cells do not fit in the cell-suspension fraction; increase stock density or suspension fraction."] : []);
      }
      case "split": {
        const post = num(i, "currentConfluency", { positive: true }) / num(i, "splitRatio", { positive: true }) * (i.areaMode === "different" ? num(i, "sourceAreaCm2", { positive: true }) / num(i, "targetAreaCm2", { positive: true }) : 1);
        const target = num(i, "targetConfluency", { positive: true });
        const hours = target <= post ? 0 : Math.log2(target / post) * num(i, "doublingTimeHours", { positive: true });
        return finish(definition, [out("postSplitConfluency", "Post-split confluency", "\u4F20\u4EE3\u540E\u6C47\u5408\u5EA6", post, "%"), out("hoursToTarget", "Estimated time to target", "\u9884\u8BA1\u8FBE\u5230\u76EE\u6807\u65F6\u95F4", hours, "h"), out("daysToTarget", "Estimated days", "\u9884\u8BA1\u5929\u6570", hours / 24, "days")], [], ["This is an exponential-growth estimate; attachment lag and density effects are not modeled."]);
      }
      case "freezing": {
        const vials = Math.floor(num(i, "totalCells", { min: 0 }) / num(i, "cellsPerVial", { positive: true }));
        const total = vials * num(i, "volumePerVialMl", { positive: true });
        const dmso = total * num(i, "dmsoPercent", { min: 0 }) / 100;
        const serum = total * num(i, "serumPercent", { min: 0 }) / 100;
        if (num(i, "dmsoPercent") + num(i, "serumPercent") > 100) throw new Error("\u914D\u65B9\u6BD4\u4F8B\u8D85\u8FC7100% / Recipe exceeds 100%");
        return finish(definition, [out("vials", "Complete vials", "\u53EF\u51BB\u5B58\u6574\u7BA1\u6570", vials, "vials"), out("remainingCells", "Remaining cells", "\u5269\u4F59\u7EC6\u80DE", num(i, "totalCells") - vials * num(i, "cellsPerVial"), "cells"), out("totalMediumMl", "Total freezing medium", "\u51BB\u5B58\u6DB2\u603B\u91CF", total, "mL"), out("dmsoMl", "DMSO", "DMSO", dmso, "mL"), out("serumMl", "Serum", "\u8840\u6E05", serum, "mL"), out("baseMediumMl", "Base medium", "\u57FA\u7840\u57F9\u517B\u57FA", total - dmso - serum, "mL")], dmso + serum > total ? ["DMSO and serum percentages exceed 100% combined."] : []);
      }
      case "transfection": {
        const n2 = num(i, "wells", { positive: true }) * num(i, "replicates", { positive: true });
        const f = 1 + num(i, "overagePercent", { min: 0 }) / 100;
        const dna = num(i, "dnaUgPerWell", { min: 0 }) * n2 * f;
        const reagent = dna * num(i, "reagentUlPerUg", { min: 0 });
        const total = num(i, "complexVolumeUlPerWell", { positive: true }) * n2 * f;
        const dnaVolume = dna / num(i, "dnaConcentrationUgUl", { positive: true });
        if (dnaVolume + reagent > total) throw new Error("\u6838\u9178\u548C\u8BD5\u5242\u8D85\u8FC7\u590D\u5408\u7269\u4F53\u79EF / DNA and reagent exceed complex volume");
        let tubeTable;
        if (i.complexMode === "two-tube") {
          const a = num(i, "tubeAVolumeUl", { positive: true }) * n2 * f, b = total - a;
          if (a < dnaVolume || b < reagent) throw new Error("\u6838\u9178\u6216\u8BD5\u5242\u8D85\u8FC7\u5BF9\u5E94\u7BA1\u4F53\u79EF / DNA or reagent exceeds its tube volume");
          tubeTable = [{ tube: "A", component: "\u6838\u9178\u539F\u6DB2 / DNA stock", volumeUl: dnaVolume }, { tube: "A", component: "\u7A00\u91CA\u6DB2 / Diluent", volumeUl: a - dnaVolume }, { tube: "B", component: "\u8BD5\u5242 / Reagent", volumeUl: reagent }, { tube: "B", component: "\u7A00\u91CA\u6DB2 / Diluent", volumeUl: b - reagent }];
        }
        return finish(definition, [out("dnaUg", "DNA", "DNA", dna, "\xB5g"), out("reagentUl", "Transfection reagent", "\u8F6C\u67D3\u8BD5\u5242", reagent, "\xB5L"), out("dnaVolumeUl", "DNA solution", "DNA\u539F\u6DB2", dnaVolume, "\xB5L"), out("diluentUl", "Diluent", "\u7A00\u91CA\u6DB2", total - reagent - dnaVolume, "\xB5L"), out("totalComplexUl", "Total complex", "\u590D\u5408\u7269\u603B\u91CF", total, "\xB5L")], [], ["\u8BD5\u5242\u3001\u7A00\u91CA\u6DB2\u53CA\u6DF7\u5408\u987A\u5E8F\u9075\u5FAA\u6240\u7528\u4EA7\u54C1\u8BF4\u660E / Follow product-specific reagent, diluent and mixing instructions"], tubeTable);
      }
      case "kill-curve": {
        const points = num(i, "points", { positive: true });
        if (points < 2) throw new Error("\u81F3\u5C11\u4E24\u4E2A\u6D53\u5EA6\u70B9 / At least two dose points required");
        const min = num(i, "minimum", { min: 0 }), max = num(i, "maximum", { positive: true });
        if (max < min) throw new Error("Maximum dose must be at least the minimum dose.");
        const doses = Array.from({ length: points }, (_, index) => str(i, "scale") === "log" ? min * (max / min) ** (index / Math.max(1, points - 1)) : min + (max - min) * index / Math.max(1, points - 1));
        if (str(i, "scale") === "log" && min <= 0) throw new Error("\u5BF9\u6570\u68AF\u5EA6\u6700\u4F4E\u6D53\u5EA6\u5FC5\u987B\u5927\u4E8E0 / Log minimum must be positive");
        const stockUgMl = num(i, "stockConcentration", { positive: true }) * 1e3;
        if (max > stockUgMl) throw new Error("\u76EE\u6807\u6D53\u5EA6\u8D85\u8FC7\u6BCD\u6DB2 / Target exceeds stock");
        const volume = num(i, "volumePerWellMl", { positive: true });
        const table = doses.map((dose, index) => ({ level: index + 1, doseUgMl: round(dose), stockToAddUl: round(dose * volume / stockUgMl * 1e3) }));
        return finish(definition, [out("dosePoints", "Dose points", "\u6D53\u5EA6\u70B9\u6570", points), out("highestStockAdditionUl", "Highest stock addition", "\u6700\u9AD8\u6D53\u5EA6\u6BCD\u6DB2\u52A0\u5165\u91CF", table.at(-1)?.stockToAddUl ?? 0, "\xB5L")], [], [], table);
      }
      case "viability": {
        const total = num(i, "totalCells", { min: 0 }), viability = num(i, "viabilityPercent", { min: 0 });
        const live = total * viability / 100;
        const target = num(i, "targetLiveCellsPerMl", { positive: true });
        return finish(definition, [out("liveCells", "Live cells", "\u6D3B\u7EC6\u80DE", live, "cells"), out("deadCells", "Dead cells", "\u6B7B\u7EC6\u80DE", total - live, "cells"), out("resuspensionVolumeMl", "Resuspension volume", "\u91CD\u60AC\u4F53\u79EF", live / target, "mL")], viability > 100 ? ["Viability exceeds 100%."] : []);
      }
      case "od600": {
        const corrected = num(i, "od600", { min: 0 }) / num(i, "pathLengthCm", { positive: true });
        const density = corrected * num(i, "cellsPerMlPerOd", { positive: true });
        return finish(definition, [out("pathCorrectedOd", "Path-corrected OD600", "\u5149\u7A0B\u6821\u6B63OD600", corrected), out("estimatedCellsPerMl", "Estimated density", "\u4F30\u7B97\u7EC6\u80DE\u6D53\u5EA6", density, "cells/mL"), out("estimatedTotalCells", "Estimated total cells", "\u4F30\u7B97\u603B\u7EC6\u80DE\u6570", density * num(i, "cultureVolumeMl", { min: 0 }), "cells")], [], ["The conversion factor is organism-, instrument-, and growth-condition-specific."]);
      }
      case "cfu": {
        const cfu = num(i, "colonies", { min: 0 }) / (num(i, "dilution", { positive: true }) * num(i, "platedVolumeMl", { positive: true }));
        const dna = num(i, "dnaUg", { min: 0 });
        return finish(definition, [out("cfuPerMl", "CFU/mL", "CFU/mL", cfu, "CFU/mL"), out("log10CfuPerMl", "log10 CFU/mL", "log10 CFU/mL", cfu > 0 ? Math.log10(cfu) : "\u672A\u68C0\u51FA / Not detected"), dna > 0 ? out("transformantsPerUg", "Transformation efficiency", "\u8F6C\u5316\u6548\u7387", cfu / dna, "CFU/\xB5g") : out("transformantsPerUg", "Transformation efficiency", "\u8F6C\u5316\u6548\u7387", "Not calculated")], num(i, "colonies", { min: 0 }) < 30 ? ["Low colony count may be statistically unstable."] : []);
      }
      case "colony-counter": {
        if (num(i, "automaticCount", { min: 0 }) + num(i, "manualAdjustment") < 0) throw new Error("\u8BA1\u6570\u4E0D\u53EF\u4E3A\u8D1F / Count cannot be negative");
        const automatic = Math.round(num(i, "automaticCount", { min: 0 }));
        const adjustment = Math.round(num(i, "manualAdjustment"));
        return finish(definition, [out("automaticCount", "Automatic detections", "\u81EA\u52A8\u8BC6\u522B\u6570", automatic), out("confirmedCount", "Human-confirmed count", "\u4EBA\u5DE5\u786E\u8BA4\u8BA1\u6570", Math.max(0, automatic + adjustment))], [], ["Uploaded images are transient and are not included in saved calculation records."]);
      }
      case "reagent-dosing":
      case "dilution":
      case "fold-dilution": {
        const mode = str(i, "mode") || (definition.id === "fold-dilution" ? "fold" : "final");
        const modern = Boolean(i.mode);
        const volume = num(i, definition.id === "reagent-dosing" && !modern ? "finalVolumeMl" : "finalVolume", { positive: true });
        let stock = 1, target = 1, initial = 0;
        if (mode === "fold") {
          stock = num(i, modern ? "stockFold" : "fold", { positive: true });
          target = modern ? num(i, "targetFold", { positive: true }) : 1;
        } else if (mode === "ratio") {
          stock = num(i, "ratio", { positive: true });
          if (stock < 1) throw new Error("\u7A00\u91CA\u5206\u6BCD\u81F3\u5C11\u4E3A1 / Ratio denominator must be at least 1");
        } else if (mode === "parts") {
          target = num(i, "stockParts", { positive: true });
          stock = target + num(i, "diluentParts", { min: 0 });
        } else {
          stock = num(i, "stockConcentration", { positive: true });
          target = num(i, "targetConcentration", { min: 0 });
          if (modern) {
            const from = String(i.stockConcentrationUnit ?? "mM"), to = String(i.targetConcentrationUnit ?? "\xB5M");
            const source = units[normalizeUnit(from)], targetUnit = units[normalizeUnit(to)];
            if (!source || !targetUnit || ![source.dimension, targetUnit.dimension].every((d) => ["mass-concentration", "molar-concentration"].includes(d))) throw new Error("\u6D53\u5EA6\u5355\u4F4D\u65E0\u6548 / Invalid concentration unit");
            if (source.dimension === targetUnit.dimension) stock = convert(stock, from, to);
            else {
              const mw = num(i, "molecularWeight", { positive: true });
              stock = stock * source.factor * (source.dimension === "molar-concentration" ? mw : 1 / mw) / targetUnit.factor;
            }
          } else if (definition.id === "reagent-dosing") {
            if (num(i, "stockToTargetFactor") !== 1e3) throw new Error("\u65E7\u500D\u7387\u4E0E\u5355\u4F4D\u51B2\u7A81\uFF0C\u8BF7\u786E\u8BA4\u5355\u4F4D / Legacy factor conflicts with units");
            stock *= 1e3;
          }
          if (mode === "add") initial = convert(num(i, "initialConcentration", { min: 0 }), String(i.initialConcentrationUnit ?? "\xB5M"), String(i.targetConcentrationUnit ?? "\xB5M"));
        }
        const plan = mode === "add" ? addStock(stock, target, initial, volume) : dilution(stock, target, volume);
        const unit = modern ? "mL" : definition.id === "dilution" ? str(i, "volumeUnit") : "mL";
        return finish(current, [out("stockVolume", "Take stock", "\u53D6\u6BCD\u6DB2", plan.sample, unit), out("stockVolumeUl", "Take stock", "\u53D6\u6BCD\u6DB2", convert(plan.sample, unit, "\xB5L"), "\xB5L"), out("diluentVolume", "Diluent", "\u7A00\u91CA\u6DB2", mode === "add" ? 0 : plan.diluent, unit), out("finalVolume", "Final volume", "\u6700\u7EC8\u4F53\u79EF", plan.final, unit)], [], ["\u4F53\u79EF\u53EF\u52A0\u548C\u8FD1\u4F3C / Assumes additive volumes."]);
      }
      case "serial-dilution": {
        if (i.gradientMode === "linear" || i.gradientMode === "custom") {
          const start = i.gradientMode === "linear" ? num(i, "startingConcentration", { min: 0 }) : 0;
          const count = i.gradientMode === "linear" ? num(i, "levels", { positive: true }) : 1;
          if (count > 384) throw new Error("\u6700\u591A384\u70B9 / Maximum 384 points");
          const targets = i.gradientMode === "custom" ? String(i.customTargets ?? "").split(/\r?\n/).map((value) => parseScalar(value)) : Array.from({ length: count }, (_, index) => start + (num(i, "endingConcentration", { min: 0 }) - start) * index / Math.max(1, count - 1));
          const table2 = targets.map((concentration, index) => {
            const plan = dilution(num(i, "sourceConcentration", { positive: true }), concentration, num(i, "totalVolumePerLevel", { positive: true }));
            return { tube: index + 1, concentration, source: "\u6BCD\u6DB2 / Stock", takeUl: plan.sample, diluentUl: plan.diluent, mixedUl: plan.final, transferUl: 0, remainingUl: plan.final };
          });
          return finish(current, [out("levels", "Concentration points", "\u6D53\u5EA6\u70B9\u6570", table2.length)], [], ["\u5E76\u884C\u914D\u5236\uFF1B\u6D53\u5EA6\xB5M\uFF0C\u4F53\u79EF\xB5L / Parallel preparation; \xB5M and \xB5L"], table2);
        }
        const table = serialPlan(num(i, "startingConcentration", { positive: true }), num(i, "dilutionFactor", { positive: true }), num(i, "levels", { positive: true }), num(i, "totalVolumePerLevel", { positive: true }), i.volumeMode === "retained");
        if (i.firstSource === "stock") {
          const first = table[0];
          const plan = dilution(num(i, "sourceConcentration", { positive: true }), num(i, "startingConcentration", { positive: true }), first.mixedUl);
          first.source = "\u6BCD\u6DB2 / Stock";
          first.takeUl = plan.sample;
          first.diluentUl = plan.diluent;
        }
        const required = i.requiredVolumeUl ? num(i, "requiredVolumeUl", { min: 0 }) : i.volumeMode === "retained" ? num(i, "totalVolumePerLevel", { positive: true }) : void 0;
        const planned = table.map((row) => ({ ...row, requiredUl: required ?? "\u672A\u8BBE\u7F6E / Unspecified", sufficient: required === void 0 ? "\u672A\u8BC4\u4F30 / Not assessed" : row.remainingUl >= required ? "\u662F / Yes" : "\u5426 / No" }));
        return finish(current, [out("levels", "Points including start", "\u6D53\u5EA6\u70B9\u6570\uFF08\u542B\u8D77\u59CB\u70B9\uFF09", table.length), out("transferVolume", "First transfer", "\u9996\u6B21\u8F6C\u79FB", table[0].transferUl, "\xB5L")], required !== void 0 && table.some((row) => row.remainingUl < required) ? ["\u90E8\u5206\u7BA1\u4FDD\u7559\u91CF\u4E0D\u8DB3\uFF0C\u8BF7\u8C03\u6574\u89C4\u5212 / Some tubes retain insufficient volume; revise the plan"] : [], [i.firstSource === "stock" ? "\u9996\u7BA1\u4ECE\u66F4\u6D53\u6BCD\u6DB2\u5236\u5907 / Prepare first tube from stock" : "\u7B2C\u4E00\u7BA1\u4E3A\u5DF2\u5907\u8D77\u59CB\u6DB2 / First tube is prepared starting solution", "\u5BF9\u7167\u5355\u72EC\u8BBE\u7F6E\uFF1B\u6D53\u5EA6\xB5M\uFF0C\u4F53\u79EF\xB5L / Controls separate; concentrations \xB5M, volumes \xB5L"], planned);
      }
      case "molarity": {
        const mw = num(i, "molecularWeight", { positive: true });
        const mode = str(i, "mode");
        const purity = i.purityPercent === void 0 ? 1 : num(i, "purityPercent", { positive: true }) / 100;
        if (purity > 1) throw new Error("\u7EAF\u5EA6\u4E0D\u5F97\u8D85\u8FC7100% / Purity exceeds 100%");
        if (mode === "mass") return finish(definition, [out("massG", "Mass to weigh", "\u79F0\u91CF\u8D28\u91CF", mw * num(i, "concentrationM", { positive: true }) * num(i, "volumeL", { positive: true }) / purity, "g")], [], ["\u6EB6\u89E3\u540E\u5B9A\u5BB9\uFF1B\u7EAF\u5EA6\u6309\u8D28\u91CF\u5206\u6570 / Dissolve then bring to final volume; purity is a mass fraction."]);
        if (mode === "concentration") return finish(definition, [out("concentrationM", "Molarity", "\u6469\u5C14\u6D53\u5EA6", num(i, "massG", { positive: true }) * purity / mw / num(i, "volumeL", { positive: true }), "M")]);
        if (mode !== "volume") throw new Error("\u8BF7\u9009\u62E9\u6C42\u89E3\u76EE\u6807 / Select a solve mode");
        return finish(definition, [out("volumeL", "Required volume", "\u5B9A\u5BB9\u4F53\u79EF", num(i, "massG", { positive: true }) * purity / mw / num(i, "concentrationM", { positive: true }), "L")]);
      }
      case "percent-solution": {
        if (num(i, "percentage", { min: 0 }) > 100 && str(i, "type") !== "w/v") throw new Error("\u6BD4\u4F8B\u8D85\u8FC7100% / Fraction exceeds 100%");
        if (str(i, "type") === "w/w") {
          const final = num(i, "targetMassG", { positive: true });
          const mass = final * num(i, "percentage", { min: 0 }) / 100;
          return finish(current, [out("soluteAmount", "Solute mass", "\u6EB6\u8D28\u8D28\u91CF", mass, "g"), out("otherMassG", "Other components", "\u5176\u4ED6\u7EC4\u5206\u5408\u8BA1", final - mass, "g")]);
        }
        const amount = num(i, "percentage", { min: 0 }) * num(i, "targetVolumeMl", { positive: true }) / 100;
        return finish(definition, [out("soluteAmount", str(i, "type") === "w/v" ? "Solute mass" : "Liquid solute", str(i, "type") === "w/v" ? "\u6EB6\u8D28\u8D28\u91CF" : "\u6DB2\u4F53\u6EB6\u8D28\u4F53\u79EF", amount, str(i, "type") === "w/v" ? "g" : "mL"), out("targetVolumeMl", "Bring to final volume", "\u5B9A\u5BB9\u81F3", num(i, "targetVolumeMl", { positive: true }), "mL")]);
      }
      case "media-recipe":
      case "buffer-recipe": {
        const scale = num(i, "targetVolumeMl", { positive: true }) / num(i, "baseVolumeMl", { positive: true });
        const source = Array.isArray(i.recipeRows) ? i.recipeRows.map((row) => {
          if (row.inputMode === "concentration") {
            if (i.recipeMode === "add") throw new Error("\u76EE\u6807\u6D53\u5EA6\u6A21\u5F0F\u9700\u660E\u786E\u6700\u7EC8\u4F53\u79EF\uFF0C\u8BF7\u9009\u62E9\u5B9A\u5BB9\u6A21\u5F0F / Target concentration requires final-volume mode");
            const plan = dilution(convert(parseScalar(row.stock), row.stockUnit ?? "mM", row.targetUnit ?? "\xB5M"), parseScalar(row.target), num(i, "targetVolumeMl", { positive: true }));
            return [row.name, String(plan.sample / scale), "mL"];
          }
          return [row.name, row.amount, row.unit];
        }) : parseRows(i.components, 3);
        const table = source.map(([name, amount, unit], index) => ({ component: name, componentId: String(index), action: "add", amount: parseScalar(amount) * scale, unit }));
        if (table.some((row) => !row.component.trim() || row.amount < 0)) throw new Error("\u7EC4\u5206\u540D\u79F0\u6216\u7528\u91CF\u65E0\u6548 / Invalid component name or amount");
        const liquidMl = table.filter((row) => ["mL", "\xB5L", "L"].includes(row.unit)).reduce((sum, row) => sum + convert(row.amount, row.unit, "mL"), 0);
        if (i.recipeMode === "final" && liquidMl > num(i, "targetVolumeMl")) throw new Error("\u6DB2\u4F53\u7EC4\u5206\u8D85\u8FC7\u6700\u7EC8\u4F53\u79EF / Liquid components exceed final volume");
        if (i.recipeMode === "final") table.push({ component: "\u6EB6\u89E3\u540E\u5B9A\u5BB9\u81F3 / Dissolve then bring to", componentId: "final", action: "make-up-to", amount: num(i, "targetVolumeMl"), unit: "mL" });
        if (!table.length || table.some((row) => !Number.isFinite(Number(row.amount)))) throw new Error("Enter components as name, amount, unit.");
        return finish(definition, [out("scaleFactor", "Scale factor", "\u7F29\u653E\u500D\u6570", scale), out("componentCount", "Components", "\u7EC4\u5206\u6570", table.length)], [], [], table);
      }
      case "ic50-ec50": {
        const rows = parseRows(i.points).map((row) => [Number(row[0]), Number(row[1])]);
        const fit = fourPlFit(rows, str(i, "mode") === "inhibition" ? -1 : 1);
        return finish(definition, [out("midpoint", "Relative 4PL midpoint", "\u76F8\u5BF94PL\u66F2\u7EBF\u4E2D\u70B9", fit.ec50), out("bottom", "Bottom", "\u4E0B\u5E73\u53F0", fit.bottom), out("top", "Top", "\u4E0A\u5E73\u53F0", fit.top), out("hillSlope", "Hill slope", "Hill\u659C\u7387", fit.hill), out("rSquared", "R\xB2", "R\xB2", fit.r2), out("converged", "Converged", "\u6570\u503C\u6536\u655B", fit.converged ? "Yes / \u662F" : "No / \u5426")], fit.r2 < 0.9 || !fit.converged ? ["\u62DF\u5408\u9700\u590D\u6838\uFF1AR\xB2\u4E0D\u4EE3\u8868\u6A21\u578B\u53EF\u9760\u6027 / Review fit; R\xB2 alone is not validation"] : [], ["\u76F8\u5BF9\u4E2D\u70B9\u4E0D\u662F\u6240\u6709\u5B9A\u4E49\u7684\u7EDD\u5BF950%\u6548\u5E94\uFF1B\u68C0\u67E5\u5E73\u53F0\u548C\u91CF\u7A0B / Relative midpoint is not necessarily absolute 50% effect; inspect plateaus and range."], rows.map(([x, y]) => ({ concentration: x, observed: y, fitted: fit.bottom + (fit.top - fit.bottom) / (1 + (fit.ec50 / x) ** fit.hill) })));
      }
      case "master-mix": {
        if (Array.isArray(i.groups)) {
          const groups = i.groups;
          if (!groups.length || groups.some((group) => !group.name.trim()) || new Set(groups.map((group) => group.name.trim())).size !== groups.length) throw new Error("\u914D\u6DB2\u7EC4\u540D\u79F0\u7F3A\u5931\u6216\u91CD\u590D / Missing or duplicate mix group name");
          const plans = groups.map((group, groupIndex) => {
            const reactions2 = parseScalar(group.reactions);
            return { group, plan: mixPlan(group.rows, reactions2, reactions2 * num(i, "overagePercent", { min: 0 }) / 100, num(i, "reactionVolumeUl", { positive: true }), String(groupIndex), group.name) };
          });
          return { ...finish(current, [out("groups", "Separate mix groups", "\u72EC\u7ACB\u914D\u6DB2\u7EC4", groups.length), out("totalMasterMixUl", "Total across separate groups", "\u5404\u7EC4\u9884\u6DF7\u603B\u91CF\uFF08\u5206\u522B\u914D\u5236\uFF09", plans.reduce((sum, item) => sum + item.plan.total, 0), "\xB5L")], [], ["\u4E0D\u540C\u7EC4\u5206\u522B\u914D\u5236\uFF0C\u4E0D\u5408\u5E76\u6A21\u677F / Prepare each group separately; never pool templates"], plans.flatMap(({ group, plan: plan2 }) => plan2.table.map((row) => ({ ...row, group: group.name })))), operations: plans.flatMap(({ plan: plan2 }) => plan2.operations) };
        }
        const reactions = i.samples !== void 0 ? num(i, "samples", { positive: true }) * num(i, "replicates", { positive: true }) + num(i, "controls", { min: 0 }) : num(i, "reactions", { positive: true });
        if (!Number.isInteger(reactions)) throw new Error("\u53CD\u5E94\u6570\u5FC5\u987B\u662F\u6574\u6570 / Reaction count must be an integer");
        const rows = Array.isArray(i.rows) ? i.rows : parseRows(i.components).map(([name, volume]) => ({ name, volume, premix: true }));
        const final = i.reactionVolumeUl !== void 0 ? num(i, "reactionVolumeUl", { positive: true }) : rows.reduce((s, row) => s + parseScalar(row.volume), 0);
        const extra = reactions * num(i, "overagePercent", { min: 0 }) / 100;
        const plan = mixPlan(rows, reactions, extra, final);
        return { ...finish(current, [out("actualReactions", "Actual reactions", "\u5B9E\u9645\u53CD\u5E94\u6570", reactions), out("preparedReactions", "Premix equivalents", "\u9884\u6DF7\u53CD\u5E94\u5F53\u91CF", reactions + extra), out("totalMasterMixUl", "Prepare premix", "\u914D\u5236\u9884\u6DF7\u6DB2", plan.total, "\xB5L"), out("dispenseUl", "Premix per reaction", "\u6BCF\u53CD\u5E94\u5206\u88C5\u9884\u6DF7\u6DB2", final - plan.separate, "\xB5L"), out("separateUl", "Separate sample per reaction", "\u6BCF\u53CD\u5E94\u72EC\u7ACB\u52A0\u6837", plan.separate, "\xB5L"), out("remainingPremixUl", "Premix reserve", "\u9884\u6DF7\u4F59\u91CF", plan.remaining, "\xB5L")], [], ["\u6BCF\u53CD\u5E94\u5F53\u91CF\u4EC5\u8868\u793A\u7EC4\u6210\uFF1B\u9884\u6DF7\u7EC4\u5206\u6309\u6574\u6279\u52A0\u5165\uFF0C\u72EC\u7ACB\u6837\u672C\u5206\u522B\u52A0\u6837 / Per-reaction equivalents describe composition; prepare premix in bulk, add samples individually."], plan.table), operations: plan.operations };
      }
      case "resuspension": {
        const mode = str(i, "mode");
        let volume;
        if (mode === "amount") volume = num(i, "amount", { positive: true }) * 1e-9 / (num(i, "targetMolar", { positive: true }) * 1e-6);
        else if (mode === "mass") volume = num(i, "mass", { positive: true }) * 1e-3 / num(i, "targetMass", { positive: true });
        else volume = num(i, "mass", { positive: true }) * 1e-3 / num(i, "molecularWeight", { positive: true }) / (num(i, "targetMolar", { positive: true }) * 1e-6);
        return finish(current, [out("finalVolumeUl", "Final solution volume", "\u6700\u7EC8\u6EB6\u6DB2\u4F53\u79EF", volume * 1e6, "\xB5L")], [], ["\u4EE5COA\u91CF\u6216\u5206\u5B50\u91CF\u4E3A\u4F9D\u636E\uFF1B\u6EB6\u5242\u53CA\u590D\u6EB6\u64CD\u4F5C\u9075\u5FAA\u4EA7\u54C1\u8BF4\u660E / Use COA amount or MW and product instructions."]);
      }
      case "normalization": {
        if (!Array.isArray(i.samples) || !i.samples.length) throw new Error("\u8BF7\u8F93\u5165\u6837\u672C / Enter samples");
        const table = batchPlan(i.samples, num(i, "targetConcentration", { min: 0 }), num(i, "finalVolume", { positive: true }));
        return finish(current, [out("validRows", "Valid samples", "\u6709\u6548\u6837\u672C", table.filter((row) => typeof row.sampleUl === "number").length)], [], ["\u6D53\u5EA6\u5355\u4F4Dng/\xB5L\uFF0C\u4F53\u79EF\u5355\u4F4D\xB5L\uFF1B\u65E0\u6548\u884C\u4E0D\u63D0\u4F9B\u79FB\u6DB2\u91CF / Concentrations ng/\xB5L, volumes \xB5L; invalid rows have no volumes."], table);
      }
      case "ligation": {
        const insert = num(i, "vectorNg", { positive: true }) * num(i, "insertBp", { positive: true }) / num(i, "vectorBp", { positive: true }) * num(i, "molarRatio", { positive: true });
        return finish(definition, [out("insertNg", "Insert DNA required", "\u6240\u9700\u63D2\u5165\u7247\u6BB5DNA", insert, "ng"), out("vectorNg", "Vector DNA", "\u8F7D\u4F53DNA", num(i, "vectorNg", { positive: true }), "ng")]);
      }
      case "tm": {
        const sequence = str(i, "sequence").toUpperCase();
        if (!/^[ACGT]+$/.test(sequence) || sequence.length < 4) throw new Error("Enter a DNA primer sequence containing A, C, G, and T.");
        const gc = [...sequence].filter((base) => base === "G" || base === "C").length;
        const saltM = num(i, "sodiumMm", { positive: true }) / 1e3;
        const tm = sequence.length < 14 ? 2 * (sequence.length - gc) + 4 * gc : 64.9 + 41 * (gc - 16.4) / sequence.length + 16.6 * Math.log10(saltM);
        return finish(definition, [out("length", "Primer length", "\u5F15\u7269\u957F\u5EA6", sequence.length, "nt"), out("gcPercent", "GC content", "GC\u542B\u91CF", gc / sequence.length * 100, "%"), out("tmC", "Estimated Tm", "\u4F30\u7B97Tm", tm, "\xB0C")], [], ["This screening estimate does not model Mg\xB2\u207A, dNTPs, mismatches, or nearest-neighbor thermodynamics."]);
      }
      case "dna-rna-conversion": {
        const factor = str(i, "type") === "dsDNA" ? 660 : str(i, "type") === "ssDNA" ? 330 : 340;
        const mw = num(i, "length", { positive: true }) * factor;
        const grams = num(i, "massUg", { min: 0 }) * 1e-6;
        const moles = grams / mw;
        const molecules = moles * 602214076e15;
        return finish(definition, [out("molecularWeight", "Estimated molecular weight", "\u4F30\u7B97\u5206\u5B50\u91CF", mw, "g/mol"), out("concentrationNm", "Estimated molar concentration", "\u4F30\u7B97\u6469\u5C14\u6D53\u5EA6", moles / (num(i, "volumeUl", { positive: true }) * 1e-6) * 1e9, "nM"), out("moles", "Amount", "\u7269\u8D28\u7684\u91CF", moles, "mol"), out("molecules", "Molecules", "\u5206\u5B50\u6570", molecules, "molecules"), out("concentrationUgUl", "Mass concentration", "\u8D28\u91CF\u6D53\u5EA6", num(i, "massUg", { min: 0 }) / num(i, "volumeUl", { positive: true }), "\xB5g/\xB5L")]);
      }
      case "bradford-bca": {
        const rows = parseRows(i.standards).map((row) => [Number(row[0]), Number(row[1])]);
        const fit = linearRegression(rows);
        if (fit.slope <= 0) throw new Error("The standard curve slope must be positive.");
        const concentration = (num(i, "sampleAbsorbance", { min: 0 }) - fit.intercept) / fit.slope * num(i, "dilutionFactor", { positive: true });
        if (concentration < 0) throw new Error("\u6837\u54C1\u4FE1\u53F7\u4F4E\u4E8E\u53EF\u53CD\u7B97\u8303\u56F4 / Sample signal is below the invertible range");
        const minX = Math.min(...rows.map((r) => r[0])), maxX = Math.max(...rows.map((r) => r[0]));
        return finish(definition, [out("slope", "Slope", "\u659C\u7387", fit.slope), out("intercept", "Intercept", "\u622A\u8DDD", fit.intercept), out("rSquared", "R\xB2", "R\xB2", fit.r2), out("sampleConcentration", "Sample concentration", "\u6837\u54C1\u6D53\u5EA6", concentration)], concentration / num(i, "dilutionFactor", { positive: true }) < minX || concentration / num(i, "dilutionFactor", { positive: true }) > maxX ? ["Back-calculated concentration is outside the standard range."] : [], ["\u4EC5\u5728\u5DF2\u9A8C\u8BC1\u7EBF\u6027\u91CF\u7A0B\u5185\u4F7F\u7528 / Use only within the validated linear range"], rows.map(([x, y]) => ({ concentration: x, observed: y, fitted: fit.intercept + fit.slope * x })));
      }
      case "elisa-4pl": {
        const rows = parseRows(i.standards).map((row) => [Number(row[0]), Number(row[1])]);
        const fit = fourPlFit(rows);
        const signal = num(i, "sampleSignal", { min: 0 });
        const ratio = (fit.top - fit.bottom) / (signal - fit.bottom) - 1;
        const concentration = ratio > 0 ? fit.ec50 / ratio ** (1 / fit.hill) * num(i, "dilutionFactor", { positive: true }) : NaN;
        if (!Number.isFinite(concentration)) throw new Error("Sample signal cannot be inverted within the fitted 4PL range.");
        return finish(definition, [out("sampleConcentration", "Sample concentration", "\u6837\u54C1\u6D53\u5EA6", concentration), out("ec50", "Curve midpoint", "\u66F2\u7EBF\u4E2D\u70B9", fit.ec50), out("hillSlope", "Hill slope", "Hill\u659C\u7387", fit.hill), out("rSquared", "R\xB2", "R\xB2", fit.r2), out("bottom", "Bottom", "\u4E0B\u5E73\u53F0", fit.bottom), out("top", "Top", "\u4E0A\u5E73\u53F0", fit.top), out("converged", "Converged", "\u6570\u503C\u6536\u655B", fit.converged ? "Yes / \u662F" : "No / \u5426")], concentration / num(i, "dilutionFactor", { positive: true }) < Math.min(...rows.map((row) => row[0])) || concentration / num(i, "dilutionFactor", { positive: true }) > Math.max(...rows.map((row) => row[0])) ? ["\u7A00\u91CA\u6837\u672C\u53CD\u7B97\u6D53\u5EA6\u8D85\u51FA\u6807\u51C6\u8303\u56F4 / Diluted sample is outside the standard range"] : [], ["\u68C0\u67E5\u6807\u51C6\u66F2\u7EBF\u8986\u76D6\u8303\u56F4\u3001\u5E73\u53F0\u4E0E\u6536\u655B / Inspect range, plateaus and convergence"], rows.map(([x, y]) => ({ concentration: x, observed: y, fitted: fit.bottom + (fit.top - fit.bottom) / (1 + (fit.ec50 / x) ** fit.hill) })));
      }
      case "wb-loading": {
        const inclusion = str(i, "bufferContainsReducingAgent");
        if (!["yes", "no"].includes(inclusion)) throw new Error("\u8BF7\u786E\u8BA4Buffer\u662F\u5426\u542B\u8FD8\u539F\u5242 / Confirm whether buffer contains reducing agent");
        const final = num(i, "finalLoadingVolumeUl", { positive: true });
        const mode = inclusion === "yes" ? "included" : str(i, "reducingMode") || "volume-fraction";
        const percent = inclusion === "yes" ? 0 : num(i, "reducingAgentPercent", { min: 0 });
        let reducing = final * percent / 100;
        if (mode === "target-concentration") {
          const stock = num(i, "reducingStockPercent", { positive: true });
          if (percent > stock || stock > 100) throw new Error("\u8FD8\u539F\u5242\u6D53\u5EA6\u4E0D\u53EF\u884C / Invalid reducing-agent concentration");
          reducing = final * percent / stock;
        }
        if (reducing > final) throw new Error("\u8FD8\u539F\u5242\u8D85\u8FC7\u603B\u4F53\u79EF / Reducing agent exceeds total volume");
        const name = inclusion === "yes" ? "\u5DF2\u5305\u542B\u4E8EBuffer / Included in buffer" : str(i, "reducingAgentName") || (reducing === 0 ? "\u65E0\u72EC\u7ACB\u8FD8\u539F\u5242 / None" : "");
        if (!name) throw new Error("\u8BF7\u6CE8\u660E\u8FD8\u539F\u5242\u539F\u6DB2\u540D\u79F0 / Name the reducing-agent stock");
        const definition2 = mode === "included" ? "\u5DF2\u5305\u542B\u4E8EBuffer / Included in buffer" : mode === "target-concentration" ? `\u76EE\u6807 ${percent}%\uFF1B\u539F\u6DB2 ${i.reducingStockPercent}% / Target and stock concentrations` : `\u6700\u7EC8\u4F53\u79EF\u7684 ${percent}% v/v \u539F\u6DB2\uFF1B\u4E0D\u4EE3\u8868\u6709\u6548\u6210\u5206\u7EC8\u6D53\u5EA6 / Fraction of final volume, not active concentration`;
        const rows = Array.isArray(i.samples) ? i.samples : [{ id: "Sample", concentration: String(i.sampleConcentrationUgUl ?? ""), available: "" }];
        const table = wbPlan(rows, num(i, "targetProteinUg", { positive: true }), final, num(i, "bufferFold", { positive: true }), { name, mode, volumeUl: reducing, definition: definition2 });
        if (!Array.isArray(i.samples) && typeof table[0]?.sampleUl !== "number") throw new Error(table[0]?.status ?? "Invalid WB sample");
        const row = table[0];
        const outputs = Array.isArray(i.samples) ? [out("validRows", "Valid samples", "\u6709\u6548\u6837\u672C", table.filter((r) => typeof r.sampleUl === "number").length)] : [out("sampleUl", "Sample", "\u6837\u54C1", row.sampleUl, "\xB5L"), out("loadingBufferUl", "Loading buffer", "Loading Buffer", row.bufferUl, "\xB5L"), out("reducingAgentUl", name, name, row.reducingAgentUl, "\xB5L"), out("waterUl", "Water", "\u6C34", row.diluentUl, "\xB5L")];
        return finish(current, outputs, [], [definition2], table);
      }
      case "moi": {
        if (str(i, "titerUnit") === "VG/mL") throw new Error("VG\u4E0D\u662F\u529F\u80FD\u6027\u6EF4\u5EA6\uFF0C\u8BF7\u63D0\u4F9B\u529F\u80FD\u6027\u6EF4\u5EA6 / VG is not a functional titer");
        const moi = num(i, "desiredMoi", { min: 0 }), units2 = num(i, "cells", { positive: true }) * moi;
        const volume = units2 / num(i, "titer", { positive: true }) * 1e3;
        const p0 = Math.exp(-moi);
        const p1 = moi * p0;
        return finish(definition, [out("virusVolumeUl", "Virus volume", "\u75C5\u6BD2\u4F53\u79EF", volume, "\xB5L"), out("probabilityUninfectedPercent", "Uninfected", "\u672A\u611F\u67D3\u6982\u7387", p0 * 100, "%"), out("probabilityExactlyOnePercent", "Exactly one event", "\u6070\u597D\u4E00\u6B21\u611F\u67D3\u6982\u7387", p1 * 100, "%"), out("probabilityAtLeastOnePercent", "At least one event", "\u81F3\u5C11\u4E00\u6B21\u611F\u67D3\u6982\u7387", (1 - p0) * 100, "%")], [], [`\u7406\u8BBA\u6CCA\u677E\u6A21\u578B\uFF1A\u72EC\u7ACB\u3001\u5747\u4E00\u4E8B\u4EF6\u5047\u8BBE\uFF0C\u4E0D\u4EE3\u8868\u786E\u5B9A\u611F\u67D3\u7387 / Theoretical Poisson model: independent homogeneous events. ${str(i, "titerUnit")}; PFU, IU, TU, TCID50, VG are not equivalent.`]);
      }
      case "virus-titer": {
        if (str(i, "mode") === "plaque") {
          const titer = num(i, "plaques", { min: 0 }) / (num(i, "dilution", { positive: true }) * num(i, "inoculumMl", { positive: true }));
          return finish(definition, [out("pfuPerMl", "Virus titer", "\u75C5\u6BD2\u6EF4\u5EA6", titer, "PFU/mL"), out("log10PfuPerMl", "log10 titer", "log10\u6EF4\u5EA6", titer > 0 ? Math.log10(titer) : "\u672A\u68C0\u51FA / Not detected")]);
        }
        const rows = parseRows(i.tcidSeries, 3).map((row) => [Number(row[0]), Number(row[1]), Number(row[2])]);
        if (rows.length < 2) throw new Error("Enter at least two TCID50 dilution rows.");
        if (rows.some(([d, p, t]) => !Number.isFinite(d) || d <= 0 || d > 1 || !Number.isInteger(p) || !Number.isInteger(t) || p < 0 || t <= 0 || p > t)) throw new Error("\u7EC8\u70B9\u884C\u65E0\u6548 / Invalid endpoint row");
        const crossing = rows.find(([, positive, total]) => positive / total <= 0.5);
        if (!crossing) throw new Error("\u672A\u8DE8\u8D8A50%\u7EC8\u70B9 / No 50% crossing observed");
        return finish(definition, [out("approximateTcid50Dilution", "Approximate 50% endpoint dilution", "\u8FD1\u4F3C50%\u7EC8\u70B9\u7A00\u91CA\u5EA6", crossing[0])], ["This quick endpoint identifies the first dilution at or below 50%; use a protocol-specific Reed\u2013Muench or Spearman\u2013K\xE4rber workflow for formal reporting."]);
      }
      case "unit-converter":
        return finish(definition, [out("convertedValue", "Converted value", "\u6362\u7B97\u7ED3\u679C", convert(num(i, "value"), str(i, "fromUnit"), str(i, "toUnit")), str(i, "toUnit"))]);
      case "centrifuge": {
        const radius = num(i, "radiusCm", { positive: true });
        if (str(i, "mode") === "rcf-to-rpm") return finish(definition, [out("rpm", "RPM", "\u8F6C\u901F", Math.sqrt(num(i, "rcf", { min: 0 }) / (1118e-8 * radius)), "rpm")]);
        return finish(definition, [out("rcf", "RCF", "\u76F8\u5BF9\u79BB\u5FC3\u529B", 1118e-8 * radius * num(i, "rpm", { min: 0 }) ** 2, "\xD7g")]);
      }
      default:
        throw new Error(`Calculator implementation missing: ${definition.id}`);
    }
  }
  function calculate(request) {
    const result = applyPipettingOptions(calculateInternal(request), request.inputs);
    if (["ic50-ec50", "bradford-bca", "elisa-4pl"].includes(request.calculatorId)) result.outputs = result.outputs.map((output) => ["midpoint", "ec50", "sampleConcentration"].includes(output.key) ? { ...output, unit: String(request.inputs.concentrationUnit ?? "\u672A\u6CE8\u660E / Unspecified") } : output);
    if (request.calculatorId === "dna-rna-conversion") result.notes.push("\u957F\u5EA6\u4F30\u7B97\u7CFB\u6570\uFF1AdsDNA 660\u3001ssDNA 330\u3001RNA 340 g/mol/bp\u6216nt\u3002\u4FEE\u9970\u6838\u9178\u4F18\u5148\u4F7F\u7528COA\u5206\u5B50\u91CF / Length-based estimate; prefer COA MW for modified nucleic acids.");
    const definition = getCalculatorDefinition(request.calculatorId);
    const normalizedInputs = {};
    for (const field of definition.fields) {
      if (!isFieldVisible(definition.id, field.key, request.inputs) || request.inputs[field.key] === void 0 || request.inputs[field.key] === "") continue;
      normalizedInputs[field.key] = field.unit && units[normalizeUnit(field.unit)] ? { value: parseScalar(request.inputs[field.key]) * units[normalizeUnit(String(request.inputs[`${field.key}Unit`] ?? field.unit))].factor + (units[normalizeUnit(String(request.inputs[`${field.key}Unit`] ?? field.unit))].offset ?? 0), dimension: units[normalizeUnit(String(request.inputs[`${field.key}Unit`] ?? field.unit))].dimension, unit: canonicalUnits[units[normalizeUnit(String(request.inputs[`${field.key}Unit`] ?? field.unit))].dimension] ?? field.unit, sourceUnit: String(request.inputs[`${field.key}Unit`] ?? field.unit) } : request.inputs[field.key];
    }
    if (result.outputs.some((output) => typeof output.value === "number" && !Number.isFinite(output.value))) throw new Error("\u8BA1\u7B97\u6EA2\u51FA\u6216\u6761\u4EF6\u65E0\u6548 / Numerical overflow or invalid conditions");
    return { ...result, displayUnits: validateDisplayUnits(result, request.inputs.__displayUnits), schemaVersion: 2, status: ["split", "od600", "tm", "dna-rna-conversion", "moi", "virus-titer", "ic50-ec50", "elisa-4pl", "bradford-bca"].includes(request.calculatorId) ? "estimate" : result.table?.some((row) => typeof row.status === "string" && row.status !== "\u6709\u6548 / Valid") ? "partial" : "valid", mode: String(request.inputs.mode ?? "default"), rawInputs: structuredClone(request.inputs), normalizedInputs };
  }

  // src/lib/calculators/task-presentation.ts
  var names = { dilution: ["Dilution", "\u7A00\u91CA\u52A0\u836F"], molarity: ["Solutions", "\u79F0\u91CF\u914D\u6DB2"], seeding: ["Seeding", "\u7EC6\u80DE\u94FA\u677F"], "master-mix": ["Reaction mix", "\u53CD\u5E94\u914D\u6DB2"], "wb-loading": ["WB loading", "WB\u4E0A\u6837"], centrifuge: ["Centrifuge", "\u79BB\u5FC3\u6362\u7B97"] };
  var tips = { dilution: ["Choose final volume or adding to existing liquid; they differ.", "\u5148\u9009\u914D\u5230\u603B\u4F53\u79EF\u6216\u5411\u5DF2\u6709\u6DB2\u4F53\u52A0\u5165\uFF0C\u4E24\u79CD\u6A21\u5F0F\u4E0D\u540C\u3002"], molarity: ["Confirm the molecular weight of the chemical form and concentration definition.", "\u6838\u5BF9\u5206\u5B50\u91CF\u5BF9\u5E94\u7684\u5316\u5B66\u5F62\u5F0F\uFF0C\u533A\u5206\u767E\u5206\u6D53\u5EA6\u7C7B\u578B\u3002"], seeding: ["Use viable-cell concentration; do not apply viability twice.", "\u8F93\u5165\u6D3B\u7EC6\u80DE\u6D53\u5EA6\u65F6\uFF0C\u4E0D\u8981\u518D\u6B21\u4E58\u6D3B\u7387\u3002"], "master-mix": ["Separate premix components from each sample template.", "\u533A\u5206\u53EF\u9884\u6DF7\u7EC4\u5206\u4E0E\u5404\u6837\u672C\u72EC\u7ACB\u52A0\u5165\u7684\u6A21\u677F\u3002"], "wb-loading": ["Confirm buffer reducing agent and check all component volumes.", "\u786E\u8BA4Buffer\u662F\u5426\u542B\u8FD8\u539F\u5242\uFF0C\u5E76\u6838\u5BF9\u6240\u6709\u7EC4\u5206\u603B\u91CF\u3002"], centrifuge: ["Use the actual rotor radius; RPM and RCF require it.", "\u4F7F\u7528\u5B9E\u9645\u8F6C\u5B50\u534A\u5F84\uFF1B\u7F3A\u5C11\u534A\u5F84\u4E0D\u80FD\u76F4\u63A5\u4E92\u6362\u3002"] };
  function taskPresentation(id, zh) {
    const d = getCalculatorDefinition(id);
    return { name: names[id]?.[zh ? 1 : 0] ?? (zh ? d.nameZh : d.name), description: zh ? d.shortDescriptionZh : d.shortDescription, advice: tips[id]?.[zh ? 1 : 0] ?? (zh ? d.methodZh : d.method) };
  }
  var generatedTaskIcons = { dilution: "dilution", molarity: "solution-prep", seeding: "cell-seeding", "master-mix": "reaction-mix", "wb-loading": "wb-loading", centrifuge: "centrifuge" };
  function taskIconResource(taskId, pack) {
    return pack === "lab-soft" && generatedTaskIcons[taskId] ? `/icons/lab-soft-v1/${generatedTaskIcons[taskId]}.png` : null;
  }

  // src/lib/system-theme.ts
  function defineSystemTheme(theme) {
    return {
      ...theme,
      colors: [theme.tokens["--paper"], theme.tokens["--sage"], theme.tokens["--clay"]],
      navigation: {
        background: theme.tokens["--nav-active-bg"],
        foreground: theme.tokens["--nav-active-fg"]
      }
    };
  }
  var systemThemes = [
    defineSystemTheme({
      id: "moon-dai",
      name: "\u6708\u767D\u9EDB\u9752",
      motif: "huiwen",
      description: "\u6708\u767D\u7EB8\u9762\u3001\u9EDB\u9752\u7ED3\u6784\u4E0E\u97CE\u97D0\u6696\u7EA2\uFF0C\u51B7\u6696\u5BF9\u7167\u66F4\u6E05\u695A\u3002",
      tokens: {
        "--paper": "#f7f9fb",
        "--warm": "#fbfcfd",
        "--stone": "#eef2f5",
        "--sand-panel": "#e1e8ed",
        "--ink": "#20282f",
        "--graphite": "#475863",
        "--muted": "#5b6a73",
        "--disabled": "#a5ada9",
        "--moss": "#2a475f",
        "--moss-hover": "#213a4e",
        "--moss-surface": "#e6eef4",
        "--moss-surface-hover": "#dce7ef",
        "--moss-border": "#bdcfdd",
        "--action": "#2a475f",
        "--action-hover": "#213a4e",
        "--action-surface": "#e6eef4",
        "--action-surface-hover": "#dce7ef",
        "--action-border": "#bdcfdd",
        "--contrast-action": "#a5441b",
        "--contrast-action-hover": "#893614",
        "--contrast-action-fg": "#ffffff",
        "--contrast-action-soft": "#f6e9e2",
        "--contrast-action-border": "#8d3716",
        "--sage": "#2a475f",
        "--sage-surface": "#eaf1f5",
        "--fog": "#526f83",
        "--fog-surface": "#edf2f6",
        "--clay": "#a5441b",
        "--pale-sand": "#f6e9e2",
        "--hairline": "#dce4e9",
        "--border-strong": "#c4d0d8",
        "--brand-mark-bg": "#2a475f",
        "--brand-mark-fg": "#ffffff",
        "--brand-mark-border": "#213a4e",
        "--nav-active-bg": "#a5441b",
        "--nav-active-fg": "#ffffff",
        "--nav-active-border": "#8d3716"
      }
    }),
    defineSystemTheme({
      id: "azure-coral",
      name: "\u6CD5\u84DD\u8D6A\u971E",
      motif: "ruyi-cloud",
      description: "\u660E\u4EAE\u800C\u6E05\u6670\uFF0C\u589E\u5F3A\u64CD\u4F5C\u4E0E\u9009\u4E2D\u72B6\u6001\u7684\u8FA8\u8BC6\u5EA6\u3002",
      tokens: {
        "--paper": "#f5fafb",
        "--warm": "#fbfdfe",
        "--stone": "#eaf5f7",
        "--sand-panel": "#dceef2",
        "--ink": "#20282b",
        "--graphite": "#47595e",
        "--muted": "#586c72",
        "--disabled": "#a3b0b3",
        "--moss": "#147d99",
        "--moss-hover": "#106b84",
        "--moss-surface": "#def3f7",
        "--moss-surface-hover": "#d2edf3",
        "--moss-border": "#a9dbe6",
        "--action": "#147d99",
        "--action-hover": "#106b84",
        "--action-surface": "#def3f7",
        "--action-surface-hover": "#d2edf3",
        "--action-border": "#a9dbe6",
        "--contrast-action": "#bf4f42",
        "--contrast-action-hover": "#a23f35",
        "--contrast-action-fg": "#ffffff",
        "--contrast-action-soft": "#f9e7e3",
        "--contrast-action-border": "#a23f35",
        "--sage": "#30aecf",
        "--sage-surface": "#e4f6fa",
        "--fog": "#4a7f8c",
        "--fog-surface": "#e8f4f6",
        "--clay": "#de7565",
        "--pale-sand": "#f9e7e3",
        "--hairline": "#d8e6e9",
        "--border-strong": "#bdd3d8",
        "--brand-mark-bg": "#147d99",
        "--brand-mark-fg": "#ffffff",
        "--brand-mark-border": "#116b83",
        "--nav-active-bg": "#de7565",
        "--nav-active-fg": "#2b1815",
        "--nav-active-border": "#bd5d50"
      }
    }),
    defineSystemTheme({
      id: "celadon-pine",
      name: "\u9752\u74F7\u677E\u77F3",
      motif: "lotus",
      description: "\u9752\u74F7\u4E0E\u677E\u77F3\u8D1F\u8D23\u79E9\u5E8F\uFF0C\u4EE5\u69DF\u6994\u68D5\u4F5C\u4E3A\u6E29\u6696\u7684\u9009\u4E2D\u649E\u8272\u3002",
      tokens: {
        "--paper": "#f5f8f2",
        "--warm": "#fbfcf8",
        "--stone": "#edf2e8",
        "--sand-panel": "#e1e9dc",
        "--ink": "#222a25",
        "--graphite": "#4b5a51",
        "--muted": "#5d6d63",
        "--disabled": "#a6afa9",
        "--moss": "#397978",
        "--moss-hover": "#2e6665",
        "--moss-surface": "#e2f1ef",
        "--moss-surface-hover": "#d5eae7",
        "--moss-border": "#b8d8d4",
        "--action": "#397978",
        "--action-hover": "#2e6665",
        "--action-surface": "#e2f1ef",
        "--action-surface-hover": "#d5eae7",
        "--action-border": "#b8d8d4",
        "--contrast-action": "#986524",
        "--contrast-action-hover": "#7c5019",
        "--contrast-action-fg": "#ffffff",
        "--contrast-action-soft": "#f8eadb",
        "--contrast-action-border": "#7c5019",
        "--sage": "#4a9d9c",
        "--sage-surface": "#e5f3f1",
        "--fog": "#5c7d78",
        "--fog-surface": "#edf3ef",
        "--clay": "#c1651a",
        "--pale-sand": "#f8eadb",
        "--hairline": "#dde5da",
        "--border-strong": "#c7d2c3",
        "--brand-mark-bg": "#397978",
        "--brand-mark-fg": "#ffffff",
        "--brand-mark-border": "#2e6665",
        "--nav-active-bg": "#986524",
        "--nav-active-fg": "#ffffff",
        "--nav-active-border": "#7c5019"
      }
    }),
    defineSystemTheme({
      id: "lotus-ink",
      name: "\u85D5\u8377\u781A\u58A8",
      motif: "linked-diamond",
      description: "\u85D5\u8377\u7D2B\u4E0E\u5B98\u7EFF\u76F8\u649E\uFF0C\u4FDD\u7559\u6E29\u6DA6\u7EB8\u611F\u53C8\u6709\u660E\u786E\u7126\u70B9\u3002",
      tokens: {
        "--paper": "#faf6f4",
        "--warm": "#fdfaf8",
        "--stone": "#f3ecec",
        "--sand-panel": "#ebe1e3",
        "--ink": "#2a2528",
        "--graphite": "#5a4e54",
        "--muted": "#6d5d65",
        "--disabled": "#aea4a9",
        "--moss": "#75556b",
        "--moss-hover": "#624659",
        "--moss-surface": "#f1e8ee",
        "--moss-surface-hover": "#eadee6",
        "--moss-border": "#ddcbd7",
        "--action": "#75556b",
        "--action-hover": "#624659",
        "--action-surface": "#f1e8ee",
        "--action-surface-hover": "#eadee6",
        "--action-border": "#ddcbd7",
        "--contrast-action": "#587f3d",
        "--contrast-action-hover": "#45672f",
        "--contrast-action-fg": "#ffffff",
        "--contrast-action-soft": "#edf3e6",
        "--contrast-action-border": "#45672f",
        "--sage": "#75556b",
        "--sage-surface": "#f3ebf0",
        "--fog": "#796674",
        "--fog-surface": "#f3edef",
        "--clay": "#7aa35a",
        "--pale-sand": "#edf3e6",
        "--hairline": "#e8dedf",
        "--border-strong": "#d5c7ca",
        "--brand-mark-bg": "#75556b",
        "--brand-mark-fg": "#ffffff",
        "--brand-mark-border": "#624659",
        "--nav-active-bg": "#7aa35a",
        "--nav-active-fg": "#15210f",
        "--nav-active-border": "#638948"
      }
    }),
    defineSystemTheme({
      id: "indigo-xiangqi",
      name: "\u975B\u9752\u7F03\u7EEE",
      motif: "linked-diamond",
      description: "\u6DF1\u975B\u84DD\u642D\u914D\u660E\u4EAE\u7F03\u7EEE\u91D1\uFF0C\u7406\u6027\u5185\u5BB9\u4E2D\u5E26\u6E05\u6670\u884C\u52A8\u7126\u70B9\u3002",
      tokens: {
        "--paper": "#f6f8fc",
        "--warm": "#fbfcff",
        "--stone": "#eaf0f8",
        "--sand-panel": "#dce5f1",
        "--ink": "#1f2937",
        "--graphite": "#46566b",
        "--muted": "#5c6b7e",
        "--disabled": "#a4afbd",
        "--moss": "#1661ab",
        "--moss-hover": "#0f4f91",
        "--moss-surface": "#e4eefb",
        "--moss-surface-hover": "#d7e6f8",
        "--moss-border": "#b8d0ee",
        "--action": "#1661ab",
        "--action-hover": "#0f4f91",
        "--action-surface": "#e4eefb",
        "--action-surface-hover": "#d7e6f8",
        "--action-border": "#b8d0ee",
        "--contrast-action": "#8a5a12",
        "--contrast-action-hover": "#6f470c",
        "--contrast-action-fg": "#ffffff",
        "--contrast-action-soft": "#fcf0dc",
        "--contrast-action-border": "#6f470c",
        "--sage": "#1661ab",
        "--sage-surface": "#eaf2fc",
        "--fog": "#526b89",
        "--fog-surface": "#edf2f8",
        "--clay": "#f8c471",
        "--pale-sand": "#fcf0dc",
        "--hairline": "#d9e2ef",
        "--border-strong": "#bdcbe0",
        "--brand-mark-bg": "#1661ab",
        "--brand-mark-fg": "#ffffff",
        "--brand-mark-border": "#0f4f91",
        "--nav-active-bg": "#f8c471",
        "--nav-active-fg": "#2f240e",
        "--nav-active-border": "#d29b42"
      }
    }),
    defineSystemTheme({
      id: "palace-jasmine",
      name: "\u5BAB\u7EFF\u8309\u8389",
      motif: "lotus",
      description: "\u5BAB\u6BBF\u7EFF\u4E0E\u8349\u8309\u8389\u7EA2\u5F62\u6210\u9C9C\u660E\u4E92\u8865\uFF0C\u660E\u5FEB\u4F46\u4E0D\u8FC7\u91CF\u3002",
      tokens: {
        "--paper": "#f7faf5",
        "--warm": "#fbfdf9",
        "--stone": "#edf4ea",
        "--sand-panel": "#dfead9",
        "--ink": "#202b23",
        "--graphite": "#46584b",
        "--muted": "#5c6d60",
        "--disabled": "#a5b0a7",
        "--moss": "#20894d",
        "--moss-hover": "#176b3b",
        "--moss-surface": "#e4f3e9",
        "--moss-surface-hover": "#d7ebdf",
        "--moss-border": "#b9d9c5",
        "--action": "#20894d",
        "--action-hover": "#176b3b",
        "--action-surface": "#e4f3e9",
        "--action-surface-hover": "#d7ebdf",
        "--action-border": "#b9d9c5",
        "--contrast-action": "#c92f46",
        "--contrast-action-hover": "#aa2338",
        "--contrast-action-fg": "#ffffff",
        "--contrast-action-soft": "#fde9ed",
        "--contrast-action-border": "#aa2338",
        "--sage": "#20894d",
        "--sage-surface": "#edf4e7",
        "--fog": "#5c7b63",
        "--fog-surface": "#edf3ee",
        "--clay": "#ef475d",
        "--pale-sand": "#fde9ed",
        "--hairline": "#dce6d8",
        "--border-strong": "#c4d2bf",
        "--brand-mark-bg": "#20894d",
        "--brand-mark-fg": "#ffffff",
        "--brand-mark-border": "#176b3b",
        "--nav-active-bg": "#ef475d",
        "--nav-active-fg": "#2c1015",
        "--nav-active-border": "#ca3347"
      }
    }),
    defineSystemTheme({
      id: "ganqing-buddha",
      name: "\u7EC0\u9752\u4F5B\u624B",
      motif: "huiwen",
      description: "\u6E05\u4EAE\u7EC0\u9752\u914D\u4F5B\u624B\u9EC4\uFF0C\u9002\u5408\u504F\u5E74\u8F7B\u3001\u8FA8\u8BC6\u5EA6\u9AD8\u7684\u5DE5\u4F5C\u754C\u9762\u3002",
      tokens: {
        "--paper": "#f7f9ff",
        "--warm": "#fcfdff",
        "--stone": "#edf1fb",
        "--sand-panel": "#dfe6f5",
        "--ink": "#202a3a",
        "--graphite": "#495a72",
        "--muted": "#5d6d84",
        "--disabled": "#a5afbe",
        "--moss": "#356fdc",
        "--moss-hover": "#285bb9",
        "--moss-surface": "#e6edff",
        "--moss-surface-hover": "#d9e4ff",
        "--moss-border": "#bdcdf5",
        "--action": "#356fdc",
        "--action-hover": "#285bb9",
        "--action-surface": "#e6edff",
        "--action-surface-hover": "#d9e4ff",
        "--action-border": "#bdcdf5",
        "--contrast-action": "#745b00",
        "--contrast-action-hover": "#594600",
        "--contrast-action-fg": "#ffffff",
        "--contrast-action-soft": "#fff8cf",
        "--contrast-action-border": "#594600",
        "--sage": "#4f84ff",
        "--sage-surface": "#edf2ff",
        "--fog": "#5a7199",
        "--fog-surface": "#eff2f8",
        "--clay": "#fed71a",
        "--pale-sand": "#fff8cf",
        "--hairline": "#dce3f0",
        "--border-strong": "#c5cede",
        "--brand-mark-bg": "#356fdc",
        "--brand-mark-fg": "#ffffff",
        "--brand-mark-border": "#285bb9",
        "--nav-active-bg": "#fed71a",
        "--nav-active-fg": "#1f2a44",
        "--nav-active-border": "#d8b400"
      }
    })
  ];
  function isSystemThemeId(value) {
    return systemThemes.some((theme) => theme.id === value);
  }

  // src/lib/ui-scale.ts
  var uiScaleOptions = [
    {
      id: "compact",
      name: "\u7D27\u51D1",
      nameEn: "Compact",
      description: "\u66F4\u5C0F\u7684\u754C\u9762\u5B57\u4E0E\u66F4\u6E05\u695A\u7684\u4FE1\u606F\u5C42\u7EA7",
      descriptionEn: "Smaller interface type with a clearer hierarchy"
    },
    {
      id: "standard",
      name: "\u6807\u51C6",
      nameEn: "Standard",
      description: "\u63A5\u8FD1\u6D4F\u89C8\u5668\u5E38\u89C4\u754C\u9762\u5B57\u53F7",
      descriptionEn: "Balanced everyday interface sizing"
    },
    {
      id: "comfortable",
      name: "\u8212\u5C55",
      nameEn: "Comfortable",
      description: "\u653E\u5927\u754C\u9762\u6587\u5B57\uFF0C\u63A7\u4EF6\u95F4\u8DDD\u4FDD\u6301\u4E0D\u53D8",
      descriptionEn: "Larger interface type without changing control spacing"
    }
  ];
  var defaultUiScale = "compact";
  function isUiScaleId(value) {
    return typeof value === "string" && uiScaleOptions.some((option) => option.id === value);
  }

  // src/lib/appearance.ts
  var appearanceKey = "labnest.appearance";
  var appearanceDefaults = { schemaVersion: 1, mode: "system", colorSchemeId: "moon-dai", uiFontId: "system-sans", dataFontId: "mono", uiScaleId: defaultUiScale, iconPackId: "lab-soft" };
  var preferenceIds = { mode: ["light", "dark", "system"], colorSchemeId: systemThemes.map((t) => t.id), uiFontId: ["system-sans", "system-serif"], dataFontId: ["system", "mono"], uiScaleId: uiScaleOptions.map((s) => s.id), iconPackId: ["classic-line", "lab-soft"] };
  function parseAppearance(raw, legacyTheme, legacyScale, existingUser) {
    const base = { ...appearanceDefaults, colorSchemeId: isSystemThemeId(legacyTheme) ? legacyTheme : "moon-dai", uiScaleId: isUiScaleId(legacyScale) ? legacyScale : defaultUiScale, iconPackId: existingUser ? "classic-line" : "lab-soft" };
    if (raw === null) return { value: base, preserve: false };
    try {
      const data = JSON.parse(raw);
      if (data?.schemaVersion !== 1) return { value: base, preserve: true };
      let preserve = false;
      for (const [key, ids] of Object.entries(preferenceIds)) {
        if (ids.includes(data[key])) base[key] = data[key];
        else preserve = true;
      }
      if (Object.keys(data).some((key) => key !== "schemaVersion" && !Object.prototype.hasOwnProperty.call(preferenceIds, key))) preserve = true;
      return { value: base, preserve };
    } catch {
      return { value: base, preserve: true };
    }
  }
  return __toCommonJS(standalone_exports);
})();
