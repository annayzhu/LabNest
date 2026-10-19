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
    { key: 'service', label: 'Add a model service', done: settings.providerCount > 0 },
    { key: 'default', label: 'Make it the default service and fill in its key and model', done: settings.setup.connected, detail: settings.setup.connected ? undefined : settings.setup.reason },
    { key: 'switch', label: 'Turn on “Enable AI”', done: settings.enabled },
  ];
}

export type AiPlace = { key: 'recognize' | 'design' | 'entry' | 'workbench'; label: string; detail: string; href?: string; here: boolean };

const places: Array<Omit<AiPlace, 'here'> & { href: string; at: (pathname: string) => boolean }> = [
  { key: 'recognize', label: 'Organize instructions or a non-template Protocol', detail: 'A PDF, Word file or pasted text made into a Protocol, every line checked against the original', href: '/protocols/import/recognize', at: pathname => pathname.startsWith('/protocols/import') },
  { key: 'design', label: 'Design a Protocol from a goal', detail: 'Search methods by experiment goal, have AI summarize them as method cards, then generate a draft Protocol', href: '/protocols/design', at: pathname => pathname === '/protocols' || pathname.startsWith('/protocols/design') },
  { key: 'entry', label: 'Propose next steps from a quick entry', detail: 'On a quick entry, click “Propose with AI” at the top right; proposals take effect only after you confirm them', href: '/entries', at: pathname => pathname === '/entries' || pathname.startsWith('/entries/') },
  { key: 'workbench', label: 'AI workbench', detail: 'Without a connected model, copy the prompt to any AI and paste the answer back', href: '/actions/manual', at: pathname => pathname.startsWith('/actions/manual') },
];

/** LabNest's AI features, the current page's first. A feature you are already on gets no link to itself. */
export function aiPlaces(pathname: string): AiPlace[] {
  const listed = places.map(({ at, ...place }) => ({ ...place, here: at(pathname), href: pathname.startsWith(place.href) ? undefined : place.href }));
  return [...listed.filter(place => place.here), ...listed.filter(place => !place.here)];
}
