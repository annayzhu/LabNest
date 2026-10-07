/** Nested plans are input too; display metadata and unit preferences alone are not. */
export function hasRestorableInputs(inputs:Record<string,unknown>):boolean {
 return Object.entries(inputs).some(([key,value])=>{
  if(key.startsWith('__')||key.endsWith('Unit'))return false;
  if(typeof value==='string')return Boolean(value.trim());
  if(typeof value==='number')return Number.isFinite(value);
  if(Array.isArray(value))return value.length>0;
  if(value&&typeof value==='object')return hasRestorableInputs(value as Record<string,unknown>);
  return false;
 });
}
