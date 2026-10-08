var PreparationKernel = (() => {
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

  // <stdin>
  var stdin_exports = {};
  __export(stdin_exports, {
    addStock: () => addStock,
    batchPlan: () => batchPlan,
    convert: () => convert,
    dilution: () => dilution,
    mixPlan: () => mixPlan,
    parseScalar: () => parseScalar
  });

  // ../../../../../../Documents/Playground/LabNest/src/lib/calculators/quantities.ts
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

  // ../../../../../../Documents/Playground/LabNest/src/lib/calculators/operations.ts
  var operationVersion = "liquid-operations-v2";
  function operation(id, component, value, unit, role = "add", details = {}) {
    const quantity = { value: convert(value, unit, "\xB5L"), unit: "\xB5L", dimension: "volume" };
    const repetitions = details.repetitions ?? 1;
    if (!Number.isFinite(quantity.value) || quantity.value < 0 || !Number.isInteger(repetitions) || repetitions < 0) throw new Error("\u65E0\u6548\u6DB2\u4F53\u64CD\u4F5C / Invalid liquid operation");
    return { id, component, source: "specified-stock", destination: "preparation", repetitions, planVersion: operationVersion, basis: "theoretical", ...details, role, quantity };
  }

  // ../../../../../../Documents/Playground/LabNest/src/lib/calculators/planning.ts
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
  return __toCommonJS(stdin_exports);
})();
if (typeof module === "object" && module.exports) module.exports = PreparationKernel;
