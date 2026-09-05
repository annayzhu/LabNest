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
register('time', { s: 1, min: 60, h: 3600, day: 86400 });
for (const unit of ['U/mL', 'IU/mL', 'TU/mL', 'PFU/mL', 'TCID50/mL', 'VG/mL', '% w/v', '% v/v', '% w/w', 'rpm', '×g', 'g/mol', 'cells', 'nt', 'bp', '%', 'µL/µg']) register(unit, { [unit]: 1 });
units.K = { dimension: 'temperature', factor: 1 };
units['°C'] = { dimension: 'temperature', factor: 1, offset: 273.15 };
units['°F'] = { dimension: 'temperature', factor: 5 / 9, offset: 273.15 - 32 * 5 / 9 };
export function normalizeUnit(unit: string) { return unit.replace(/μ/g, 'µ').replace(/^u(?=[LMg])/, 'µ').replace(/\/uL$/, '/µL'); }
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
