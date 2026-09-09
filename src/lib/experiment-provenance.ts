/** Names come from the frozen method snapshot; missing historical fields stay explicit. */
export function experimentMethodNames(snapshot: unknown): string[] {
  if (!snapshot || typeof snapshot !== 'object') return ['方法未记录'];
  const value = snapshot as {methodMode?:unknown;versions?:unknown};
  if (value.methodMode === 'custom') return ['自行记录'];
  if (!Array.isArray(value.versions) || !value.versions.length) return ['方法未记录'];
  return value.versions.map(version => {
    const row = version && typeof version === 'object' ? version as Record<string,unknown> : {};
    const title = typeof row.protocolTitle === 'string' && row.protocolTitle.trim() ? row.protocolTitle : '规程名称未记录';
    const revision = typeof row.displayVersion === 'string' && row.displayVersion.trim() ? row.displayVersion : '版本未记录';
    return `${title} · ${revision}`;
  });
}

export function experimentPlanName(snapshot:unknown,currentName:string|null):string {
  const saved=snapshot && typeof snapshot==='object' && 'researchPlanTitle' in snapshot ? snapshot.researchPlanTitle : undefined;
  return typeof saved==='string' && saved.trim() ? saved : currentName || '未记录';
}
