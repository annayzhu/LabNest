/** Canonical units are g, L, mol, mol/L, g/L, cells/mL, cm, cm², s and K.
 * No cross-dimensional conversion is implicit (especially biological titers).
 */
export type Unit = { dimension: string; factor: number; offset?: number };
export type Quantity = { value: number; unit: string; dimension: string };
export const units: Record<string, Unit> = {};
function register(dimension: string, factors: Record<string, number>) {
  for (const [unit, factor] of Object.entries(factors)) units[unit] = { dimension, factor };
}
register('mass', { kg: 1000, g: 1, mg: 1e-3, 'µg': 1e-6, ng: 1e-9, pg: 1e-12 });
register('volume', { L: 1, mL: 1e-3, 'µL': 1e-6, nL: 1e-9 });
register('amount', { mol: 1, mmol: 1e-3, 'µmol': 1e-6, nmol: 1e-9, pmol: 1e-12, fmol: 1e-15 });
register('molar-concentration', { M: 1, 'mol/L': 1, mM: 1e-3, 'µM': 1e-6, nM: 1e-9, pM: 1e-12 });
register('mass-concentration', { 'g/L': 1, 'mg/mL': 1, 'µg/mL': 1e-3, 'ng/mL': 1e-6, 'pg/mL': 1e-9, 'µg/µL': 1, 'ng/µL': 1e-3 });
register('cell-concentration', { 'cells/mL': 1, 'cells/µL': 1000 });
register('length', { cm: 1, mm: 0.1, m: 100 });
register('area', { 'cm²': 1, 'mm²': 0.01, 'm²': 10000 });
register('time', { ms: 1e-3, s: 1, min: 60, h: 3600, day: 86400 });
// Bench equipment settings. Each stays in its own dimension: rpm is never ×g.
register('voltage', { kV: 1000, V: 1, mV: 1e-3 });
register('current', { A: 1, mA: 1e-3, 'µA': 1e-6 });
register('pressure', { MPa: 1e6, kPa: 1000, Pa: 1, bar: 1e5, mbar: 100, psi: 6894.757, Torr: 133.322, mmHg: 133.322, atm: 101325 });
register('capacitance', { F: 1, 'µF': 1e-6, nF: 1e-9 });
register('resistance', { 'MΩ': 1e6, 'kΩ': 1000, 'Ω': 1 });
register('acidity', { pH: 1 });
register('count', { cycles: 1, '次': 1 });
// Wells, folds and MOI are plain numbers with a meaning; each stays its own dimension.
register('wells', { '孔': 1 });
register('fold', { '×': 1 });
register('moi', { MOI: 1 });
for (const unit of ['U/mL', 'IU/mL', 'TU/mL', 'PFU/mL', 'TCID50/mL', 'VG/mL', '% w/v', '% v/v', '% w/w', 'rpm', '×g', 'g/mol', 'cells', 'nt', 'bp', '%', 'µL/µg']) register(unit, { [unit]: 1 });
units.K = { dimension: 'temperature', factor: 1 };
units['°C'] = { dimension: 'temperature', factor: 1, offset: 273.15 };
units['°F'] = { dimension: 'temperature', factor: 5 / 9, offset: 273.15 - 32 * 5 / 9 };
/** Common bench spellings of registered units, including Chinese and keyboard substitutes. */
export const unitAliases: Record<string, string> = {
  'µl': 'µL', ul: 'µL', ml: 'mL', nl: 'nL', 'ng/µl': 'ng/µL', 'µg/µl': 'µg/µL', 'mg/ml': 'mg/mL', 'µg/ml': 'µg/mL', 'ng/ml': 'ng/mL', 'cells/ml': 'cells/mL',
  sec: 's', secs: 's', second: 's', seconds: 's', '秒': 's', mins: 'min', minute: 'min', minutes: 'min', '分钟': 'min', hr: 'h', hrs: 'h', hour: 'h', hours: 'h', '小时': 'h', days: 'day', '天': 'day',
  wells: '孔', well: '孔', x: '×', X: '×', '倍': '×', fold: '×', moi: 'MOI',
  '℃': '°C', '° C': '°C', xg: '×g', 'x g': '×g', '× g': '×g', Xg: '×g', 'X g': '×g', RPM: 'rpm', uA: 'µA', uF: 'µF', torr: 'Torr',
};
export function normalizeUnit(unit: string) {
  const spelled = unit.replace(/μ/g, 'µ').replace(/^u(?=[LMgAF]|l$)/, 'µ').replace(/\/uL$/, '/µL');
  return unitAliases[spelled] ?? unitAliases[spelled.toLowerCase()] ?? spelled;
}
export function parseScalar(value: unknown, locale = 'en'): number {
  if (typeof value !== 'number' && typeof value !== 'string') throw new Error('请填写数值 / Enter a number');
  let text = String(value).trim();
  if (/^(de|fr|es|it)(-|$)/.test(locale)) {
    if (text.includes('.') && text.includes(',')) throw new Error('小数分隔符有歧义 / Ambiguous separators');
    text = text.replace(',', '.');
  }
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) || !Number.isFinite(Number(text))) throw new Error('请填写完整有限数值 / Enter a complete finite number');
  return Number(text);
}
export function convert(value: number, from: string, to: string): number {
  const a = units[normalizeUnit(from)], b = units[normalizeUnit(to)];
  if (!a || !b || a.dimension !== b.dimension || !Number.isFinite(value)) throw new Error('单位不兼容 / Incompatible units');
  const canonical = value * a.factor + (a.offset ?? 0);
  if (a.dimension === 'temperature' && canonical < 0) throw new Error('低于绝对零度 / Below absolute zero');
  // Same unit: exactly the value, without floating-point rounding through the canonical unit (500 µL stays 500).
  if (a === b) return value;
  return (canonical - (b.offset ?? 0)) / b.factor;
}
export function compatibleUnits(unit: string) {
  const definition = units[normalizeUnit(unit)];
  return definition ? Object.keys(units).filter(key => units[key].dimension === definition.dimension) : [];
}
export function quantity(value: unknown, unit: string): Quantity {
  const canonicalUnit = normalizeUnit(unit), definition = units[canonicalUnit];
  if (!definition) throw new Error('未知单位 / Unknown unit');
  return { value: parseScalar(value), unit: canonicalUnit, dimension: definition.dimension };
}

export const canonicalUnits: Record<string,string> = {mass:"g",volume:"L",amount:"mol","molar-concentration":"mol/L","mass-concentration":"g/L","cell-concentration":"cells/mL",length:"cm",area:"cm²",time:"s",temperature:"K"};
