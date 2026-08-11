export function selectedCollectionExportHref(exportPath: string, ids: string[]) {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, 500);
  const search = new URLSearchParams({ exportScope: "selected" });
  uniqueIds.forEach((id) => search.append("id", id));
  return `${exportPath}?${search.toString()}`;
}

export function allCollectionExportHref(exportPath: string) {
  return `${exportPath}?exportScope=all`;
}
