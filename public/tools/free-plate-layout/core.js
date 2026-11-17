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

  function wellIdAt(size, row, column) {
    const spec = getSpec(size);
    if (row < 0 || row >= spec.rows.length || column < 0 || column >= spec.columns) return null;
    return `${spec.rows[row]}${column + 1}`;
  }

  function inReadingOrder(size, wellIds) {
    return [...new Set(wellIds)]
      .map((id) => ({ id, position: parseWell(size, id) }))
      .filter((item) => item.position)
      .sort((left, right) => left.position.index - right.position.index);
  }

  // Dragging `fromWell` onto `toWell` shifts the whole selection by that offset.
  // Wells already sitting where the selection lands go back, in reading order,
  // into the wells the selection leaves. The result is a permutation of wells.
  function planSwap(size, selectedIds, fromWell, toWell) {
    const from = parseWell(size, fromWell);
    const to = parseWell(size, toWell);
    const sources = inReadingOrder(size, selectedIds);
    if (!from || !to || !sources.length) return { ok: false, reason: "empty", landing: [], displaced: [], moves: [] };
    const rowShift = to.row - from.row;
    const columnShift = to.column - from.column;
    const landing = [];
    const moves = [];
    let outside = false;
    for (const source of sources) {
      const target = wellIdAt(size, source.position.row + rowShift, source.position.column + columnShift);
      if (!target) { outside = true; continue; }
      landing.push(target);
      moves.push([source.id, target]);
    }
    if (outside) return { ok: false, reason: "out-of-bounds", landing, displaced: [], moves: [] };
    if (!rowShift && !columnShift) return { ok: true, unchanged: true, landing, displaced: [], moves: [] };
    const sourceIds = new Set(sources.map((source) => source.id));
    const landingIds = new Set(landing);
    const displaced = inReadingOrder(size, landing.filter((id) => !sourceIds.has(id))).map((item) => item.id);
    const vacated = sources.map((source) => source.id).filter((id) => !landingIds.has(id));
    displaced.forEach((id, index) => moves.push([id, vacated[index]]));
    return { ok: true, landing, displaced, moves };
  }

  function applyMoves(wells, moves) {
    const next = { ...wells };
    for (const [, to] of moves) delete next[to];
    for (const [from, to] of moves) if (wells[from]) next[to] = wells[from];
    return next;
  }

  // Offsets are relative to the first selected well in reading order, which is
  // the well that lands on the paste target. Empty wells keep the shape but are
  // never pasted.
  function copyShape(size, selectedIds, valueOf) {
    const items = inReadingOrder(size, selectedIds);
    if (!items.length) return null;
    const first = items[0].position;
    return {
      items: items.map(({ id, position }) => {
        const value = valueOf(id);
        return { rowOffset: position.row - first.row, columnOffset: position.column - first.column, value: value ?? null };
      }),
    };
  }

  function planPaste(size, clipboard, anchorWell, occupiedIds = []) {
    const anchor = parseWell(size, anchorWell);
    if (!anchor || !clipboard?.items?.length) return { ok: false, reason: "invalid-anchor", targets: [], overwritten: [], outside: 0 };
    const targets = [];
    let outside = 0;
    for (const item of clipboard.items) {
      if (item.value === null || item.value === undefined) continue;
      const wellId = wellIdAt(size, anchor.row + item.rowOffset, anchor.column + item.columnOffset);
      if (wellId) targets.push({ wellId, value: item.value });
      else outside += 1;
    }
    const occupied = new Set(occupiedIds);
    const overwritten = targets.filter((target) => occupied.has(target.wellId)).map((target) => target.wellId);
    if (!targets.length && !outside) return { ok: false, reason: "empty", targets, overwritten, outside };
    return { ok: !outside, reason: outside ? "out-of-bounds" : null, targets, overwritten, outside };
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
    wellIdAt,
    planSwap,
    applyMoves,
    copyShape,
    planPaste,
    asFiniteNumber,
    applyOperation,
    calculateWells,
    csvEscape,
    safeFileName,
  };
});
