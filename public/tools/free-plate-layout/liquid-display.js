// Display-only rounding for volumes. Saved plans and contributions keep their full values;
// everything a person reads, copies, exports or prints goes through these helpers.
(function attach(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LiquidDisplay = api;
})(globalThis, () => {
  "use strict";
  const SIGNIFICANT_FIGURES = 4;
  const VOLUME_IN_TEXT = /(?<![\d.,])(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?(?:e[+-]?\d+)?)(\s*)(nL|uL|µL|μL|mL|L)(?![A-Za-z])/g;

  function significant(value, locale = "en-US") {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return Number(number.toPrecision(SIGNIFICANT_FIGURES)).toLocaleString(locale, { maximumFractionDigits: 12 });
  }

  // Rounds every volume written in a sentence or table cell; other numbers stay untouched.
  function volumesInText(text, locale = "en-US") {
    return String(text ?? "").replace(VOLUME_IN_TEXT, (_, amount, gap, unit) => `${significant(amount.replaceAll(",", ""), locale)}${gap}${unit}`);
  }

  // A column whose header names a volume unit holds bare numbers.
  function tableCell(cell, header = "", locale = "en-US") {
    if (cell === null || cell === undefined || cell === "") return "";
    const bareNumber = typeof cell === "number" || /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/.test(String(cell).trim());
    if (bareNumber && /(nL|uL|µL|μL|mL)\b/.test(String(header))) return significant(cell, locale);
    return volumesInText(cell, locale);
  }

  function tableRows(headers, rows, locale = "en-US") {
    return (rows || []).map((row) => row.map((cell, index) => tableCell(cell, headers?.[index], locale)));
  }

  return { significant, volumesInText, tableCell, tableRows };
});
