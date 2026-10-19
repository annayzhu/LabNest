import type { AISettingsView } from './ai-settings';

/**
 * What AI can do right now. Only 'ready' calls a model; 'incomplete' has the switch on but no working default
 * service; 'checking' and 'error' mean the settings have not been read.
 */
export type AiState = 'checking' | 'error' | 'off' | 'incomplete' | 'ready';

export function aiState(settings: AISettingsView | undefined, error?: string): AiState {
  if (error) return 'error';
  if (!settings) return 'checking';
  if (!settings.enabled) return 'off';
  return settings.availability.connected ? 'ready' : 'incomplete';
}

export type AiSetupStep = { key: 'service' | 'default' | 'switch'; label: string; done: boolean; detail?: string };

/** The setup guide: add a service, make it the working default, turn the switch on. Each step reads true while AI is off. */
export function aiSetupSteps(settings: AISettingsView): AiSetupStep[] {
  return [
    { key: 'service', label: '添加一个模型服务', done: settings.providerCount > 0 },
    { key: 'default', label: '选为默认服务，并填好密钥和模型', done: settings.setup.connected, detail: settings.setup.connected ? undefined : settings.setup.reason },
    { key: 'switch', label: '打开“启用 AI”', done: settings.enabled },
  ];
}

export type AiPlace = { key: 'recognize' | 'design' | 'entry' | 'workbench'; label: string; detail: string; href?: string; here: boolean };

const places: Array<Omit<AiPlace, 'here'> & { href: string; at: (pathname: string) => boolean }> = [
  { key: 'recognize', label: 'Organize instructions or a non-template Protocol', detail: 'A PDF, Word file or pasted text made into a Protocol, every line checked against the original', href: '/protocols/import/recognize', at: pathname => pathname.startsWith('/protocols/import') },
  { key: 'design', label: 'Design a Protocol from a goal', detail: 'Search methods by experiment goal, have AI summarize them as method cards, then generate a draft Protocol', href: '/protocols/design', at: pathname => pathname === '/protocols' || pathname.startsWith('/protocols/design') },
  { key: 'entry', label: '从快速记录提议后续操作', detail: '在快速记录页右上角点“Propose with AI”，提议等你确认后才生效', href: '/entries', at: pathname => pathname === '/entries' || pathname.startsWith('/entries/') },
  { key: 'workbench', label: 'AI 工作台', detail: '没有联网的模型时，复制提示词给任意 AI，再把回答贴回来', href: '/actions/manual', at: pathname => pathname.startsWith('/actions/manual') },
];

/** LabNest's AI features, the current page's first. A feature you are already on gets no link to itself. */
export function aiPlaces(pathname: string): AiPlace[] {
  const listed = places.map(({ at, ...place }) => ({ ...place, here: at(pathname), href: pathname.startsWith(place.href) ? undefined : place.href }));
  return [...listed.filter(place => place.here), ...listed.filter(place => !place.here)];
}
