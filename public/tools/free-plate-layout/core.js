(function attachPlateCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PlateCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPlateCore() {
  "use strict";

  const PLATE_SPECS = Object.freeze({
    6: Object.freeze({ rows: Object.freeze(["A", "B"]), columns: 3 }),
    12: Object.freeze({ rows: Object.freeze(["A", "B", "C"]), columns: 4 }),
    24: Object.freeze({ rows: Object.freeze(["A", "B", "C", "D"]), columns: 6 }),
    96: Object.freeze({ rows: Object.freeze(["A", "B", "C", "D", "E", "F", "G", "H"]), columns: 12 }),
    384: Object.freeze({ rows: Object.freeze(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"]), columns: 24 }),
  });

  function getSpec(size) {
    const spec = PLATE_SPECS[Number(size)];
    if (!spec) throw new Error(`Unsupported plate size: ${size}`);
    return spec;
  }

  function makeWellIds(size) {
    const spec = getSpec(size);
    return spec.rows.flatMap((row) =>
      Array.from({ length: spec.columns }, (_, index) => `${row}${index + 1}`),
    );
  }

  function parseWell(size, wellId) {
    const spec = getSpec(size);
    const match = /^([A-Z]+)(\d+)$/.exec(String(wellId || "").toUpperCase());
    if (!match) return null;
    const row = spec.rows.indexOf(match[1]);
    const column = Number(match[2]) - 1;
    if (row < 0 || column < 0 || column >= spec.columns) return null;
    return { row, column, index: row * spec.columns + column };
  }

  function orderedWellIds(size, order = "N") {
    const ids = makeWellIds(size);
    if (order === "Z") return ids;
    return ids.sort((leftId, rightId) => {
      const left = parseWell(size, leftId);
      const right = parseWell(size, rightId);
      return left.column - right.column || left.row - right.row;
    });
  }

  function rangeSelection(size, startId, endId) {
    const ids = makeWellIds(size);
    const start = ids.indexOf(startId);
    const end = ids.indexOf(endId);
    if (start < 0 || end < 0) return [];
    return ids.slice(Math.min(start, end), Math.max(start, end) + 1);
  }

  function rectangleSelection(size, startId, endId) {
    const spec = getSpec(size);
    const start = parseWell(size, startId);
    const end = parseWell(size, endId);
    if (!start || !end) return [];
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minColumn = Math.min(start.column, end.column);
    const maxColumn = Math.max(start.column, end.column);
    const result = [];
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let column = minColumn; column <= maxColumn; column += 1) {
        result.push(`${spec.rows[row]}${column + 1}`);
      }
    }
    return result;
  }

  function asFiniteNumber(value) {
    if (value === "" || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function applyOperation(left, operation, right) {
    if (operation === "multiply") return left * right;
    if (operation === "divide") return right === 0 ? null : left / right;
    if (operation === "add") return left + right;
    if (operation === "subtract") return left - right;
    throw new Error(`Unsupported operation: ${operation}`);
  }

  function calculateWells(options) {
    const {
      wellMap,
      wellIds,
      conditionId = "",
      conditionValue = "",
      sourceId,
      operation,
      operandMode,
      operandValue,
      operandId,
      outputId,
      precision = 4,
    } = options;

    const nextWells = { ...wellMap };
    let updated = 0;
    let skipped = 0;
    const safePrecision = Math.max(0, Math.min(12, Number(precision) || 0));

    for (const wellId of wellIds) {
      const current = wellMap[wellId] || { params: {} };
      const params = current.params || {};
      if (conditionId && String(params[conditionId] ?? "") !== String(conditionValue)) {
        continue;
      }

      const left = asFiniteNumber(params[sourceId]);
      const right = operandMode === "parameter"
        ? asFiniteNumber(params[operandId])
        : asFiniteNumber(operandValue);
      if (left === null || right === null) {
        skipped += 1;
        continue;
      }

      const rawResult = applyOperation(left, operation, right);
      if (rawResult === null || !Number.isFinite(rawResult)) {
        skipped += 1;
        continue;
      }

      const result = Number(rawResult.toFixed(safePrecision));
      nextWells[wellId] = { ...current, params: { ...params, [outputId]: result } };
      updated += 1;
    }

    return { nextWells, updated, skipped };
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function safeFileName(value) {
    const cleaned = String(value || "plate-layout")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "_");
    return cleaned || "plate-layout";
  }

  return {
    PLATE_SPECS,
    getSpec,
    makeWellIds,
    parseWell,
    orderedWellIds,
    rangeSelection,
    rectangleSelection,
    asFiniteNumber,
    applyOperation,
    calculateWells,
    csvEscape,
    safeFileName,
  };
});
