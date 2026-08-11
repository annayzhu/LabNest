export type ResearchPlanProtocolOption = {
  id: string;
  humanCode: string | null;
  title: string;
  scope: string;
  projectId: string | null;
};

export function filterProtocolPickerOptions(
  protocols: ResearchPlanProtocolOption[],
  selectedIds: string[],
  query: string,
) {
  const selected = new Set(selectedIds);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return protocols.filter((protocol) => {
    if (selected.has(protocol.id)) return false;
    if (!normalizedQuery) return true;
    return [protocol.humanCode, protocol.title, protocol.scope]
      .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
  }).slice(0, 50);
}
