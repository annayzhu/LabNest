export const systemThemeStorageKey = "labnest.system-theme";

type SystemThemeTokens = Readonly<Record<
  | "--paper" | "--warm" | "--stone" | "--sand-panel"
  | "--ink" | "--graphite" | "--muted" | "--disabled"
  | "--moss" | "--moss-hover" | "--moss-surface" | "--moss-surface-hover" | "--moss-border"
  | "--action" | "--action-hover" | "--action-surface" | "--action-surface-hover" | "--action-border"
  | "--sage" | "--sage-surface" | "--fog" | "--fog-surface"
  | "--clay" | "--pale-sand" | "--hairline" | "--border-strong"
  | "--brand-mark-bg" | "--brand-mark-fg" | "--brand-mark-border"
  | "--ai" | "--ai-fg",
  string
>>;

type Motif = "huiwen" | "ruyi-cloud" | "lotus" | "linked-diamond";

function defineSystemTheme<const Id extends string>(theme: {
  id: Id;
  name: string;
  description: string;
  motif: Motif;
  tokens: SystemThemeTokens;
}) {
  return {
    ...theme,
    tokens: { ...theme.tokens, "--ai-hover": hoverShade(theme.tokens["--ai"], theme.tokens["--ai-fg"]) },
    colors: [theme.tokens["--paper"], theme.tokens["--sage"], theme.tokens["--clay"]] as const,
  } as const;
}

/**
 * The second color of a theme marks AI. Its hover fill moves 14% away from the label color (toward white under a dark
 * label, toward black under a light one), so the label never loses contrast; darkening alone would fail on coral or gold.
 */
function hoverShade(fill: string, label: string) {
  const channels = (hex: string) => hex.replace("#", "").match(/../g)!.map(part => Number.parseInt(part, 16));
  const sum = (hex: string) => channels(hex).reduce((total, value) => total + value, 0);
  const toward = sum(label) < sum(fill) ? 255 : 0;
  return `#${channels(fill).map(value => Math.round(value + (toward - value) * 0.14).toString(16).padStart(2, "0")).join("")}`;
}

const establishedThemes = [
  defineSystemTheme({
    id: "moon-dai", name: "月白黛青", motif: "huiwen",
    description: "月白纸面、黛青结构与韎韐暖红，冷暖对照更清楚。",
    tokens: {
      "--paper":"#f7f9fb","--warm":"#fbfcfd","--stone":"#eef2f5","--sand-panel":"#e1e8ed",
      "--ink":"#20282f","--graphite":"#475863","--muted":"#5b6a73","--disabled":"#a5ada9",
      "--moss":"#2a475f","--moss-hover":"#213a4e","--moss-surface":"#e6eef4","--moss-surface-hover":"#dce7ef","--moss-border":"#bdcfdd",
      "--action":"#2a475f","--action-hover":"#213a4e","--action-surface":"#e6eef4","--action-surface-hover":"#dce7ef","--action-border":"#bdcfdd",
      "--sage":"#2a475f","--sage-surface":"#eaf1f5","--fog":"#526f83","--fog-surface":"#edf2f6",
      "--clay":"#a5441b","--pale-sand":"#f6e9e2","--hairline":"#dce4e9","--border-strong":"#c4d0d8",
      "--brand-mark-bg":"#2a475f","--brand-mark-fg":"#ffffff","--brand-mark-border":"#213a4e",
      "--ai":"#a5441b","--ai-fg":"#ffffff",
    },
  }),
  defineSystemTheme({
    id: "azure-coral", name: "法蓝赪霞", motif: "ruyi-cloud",
    description: "明亮而清晰，增强操作与选中状态的辨识度。",
    tokens: {
      "--paper":"#f5fafb","--warm":"#fbfdfe","--stone":"#eaf5f7","--sand-panel":"#dceef2",
      "--ink":"#20282b","--graphite":"#47595e","--muted":"#586c72","--disabled":"#a3b0b3",
      "--moss":"#147d99","--moss-hover":"#106b84","--moss-surface":"#def3f7","--moss-surface-hover":"#d2edf3","--moss-border":"#a9dbe6",
      "--action":"#147d99","--action-hover":"#106b84","--action-surface":"#def3f7","--action-surface-hover":"#d2edf3","--action-border":"#a9dbe6",
      "--sage":"#30aecf","--sage-surface":"#e4f6fa","--fog":"#4a7f8c","--fog-surface":"#e8f4f6",
      "--clay":"#de7565","--pale-sand":"#f9e7e3","--hairline":"#d8e6e9","--border-strong":"#bdd3d8",
      "--brand-mark-bg":"#147d99","--brand-mark-fg":"#ffffff","--brand-mark-border":"#116b83",
      "--ai":"#de7565","--ai-fg":"#2b1815",
    },
  }),
  defineSystemTheme({
    id: "celadon-pine", name: "青瓷松石", motif: "lotus",
    description: "青瓷与松石负责秩序，以琥珀橙作为温暖撞色。",
    tokens: {
      "--paper":"#f7faf7","--warm":"#fbfdfb","--stone":"#eef4ef","--sand-panel":"#e2ebe3",
      "--ink":"#222a25","--graphite":"#4b5a51","--muted":"#5d6d63","--disabled":"#a6afa9",
      "--moss":"#03756c","--moss-hover":"#04615a","--moss-surface":"#e0f2f0","--moss-surface-hover":"#d3ece9","--moss-border":"#aed8d2",
      "--action":"#03756c","--action-hover":"#04615a","--action-surface":"#e0f2f0","--action-surface-hover":"#d3ece9","--action-border":"#aed8d2",
      "--sage":"#27988d","--sage-surface":"#e7f5f2","--fog":"#4c7873","--fog-surface":"#ecf4f2",
      "--clay":"#f2973a","--pale-sand":"#fbebdd","--hairline":"#dde5de","--border-strong":"#c6d2c8",
      "--brand-mark-bg":"#03756c","--brand-mark-fg":"#ffffff","--brand-mark-border":"#04615a",
      "--ai":"#f2973a","--ai-fg":"#2a1704",
    },
  }),
  defineSystemTheme({
    id: "lotus-ink", name: "藕荷砚墨", motif: "linked-diamond",
    description: "藕荷紫与官绿相撞，保留温润纸感又有明确焦点。",
    tokens: {
      "--paper":"#fcf8f8","--warm":"#fefcfc","--stone":"#f7f0ef","--sand-panel":"#f0e5e4",
      "--ink":"#2a2528","--graphite":"#5a4e54","--muted":"#6d5d65","--disabled":"#aea4a9",
      "--moss":"#774771","--moss-hover":"#64395e","--moss-surface":"#f6e9f4","--moss-surface-hover":"#f2e0ee","--moss-border":"#e0c4db",
      "--action":"#774771","--action-hover":"#64395e","--action-surface":"#f6e9f4","--action-surface-hover":"#f2e0ee","--action-border":"#e0c4db",
      "--sage":"#774771","--sage-surface":"#f8eef6","--fog":"#80647c","--fog-surface":"#f5f0f4",
      "--clay":"#56b95d","--pale-sand":"#e4f3e4","--hairline":"#ebe0e0","--border-strong":"#dacac9",
      "--brand-mark-bg":"#774771","--brand-mark-fg":"#ffffff","--brand-mark-border":"#64395e",
      "--ai":"#56b95d","--ai-fg":"#0e230f",
    },
  }),
  defineSystemTheme({
    id: "indigo-xiangqi", name: "靛青缃绮", motif: "linked-diamond",
    description: "深靛蓝搭配明亮缃绮金，理性内容中带清晰行动焦点。",
    tokens: {
      "--paper":"#f7f9fd","--warm":"#fbfcfe","--stone":"#eef2f8","--sand-panel":"#e3e8f2",
      "--ink":"#1f2937","--graphite":"#46566b","--muted":"#5c6b7e","--disabled":"#a4afbd",
      "--moss":"#244d9e","--moss-hover":"#183d86","--moss-surface":"#e7eefc","--moss-surface-hover":"#dde7f9","--moss-border":"#becfec",
      "--action":"#244d9e","--action-hover":"#183d86","--action-surface":"#e7eefc","--action-surface-hover":"#dde7f9","--action-border":"#becfec",
      "--sage":"#244d9e","--sage-surface":"#ecf1fc","--fog":"#5f6f8c","--fog-surface":"#eff2f7",
      "--clay":"#f9b43f","--pale-sand":"#f8ecdc","--hairline":"#dee3ec","--border-strong":"#c7cfdc",
      "--brand-mark-bg":"#244d9e","--brand-mark-fg":"#ffffff","--brand-mark-border":"#183d86",
      "--ai":"#f9b43f","--ai-fg":"#2c1f05",
    },
  }),
  defineSystemTheme({
    id: "palace-jasmine", name: "宫绿茉莉", motif: "lotus",
    description: "宫殿绿与草茉莉红形成鲜明互补，明快但不过量。",
    tokens: {
      "--paper":"#f7faf7","--warm":"#fbfdfb","--stone":"#eef3ee","--sand-panel":"#e2eae2",
      "--ink":"#202b23","--graphite":"#46584b","--muted":"#5c6d60","--disabled":"#a5b0a7",
      "--moss":"#1b7d45","--moss-hover":"#0d6a38","--moss-surface":"#e8f4eb","--moss-surface-hover":"#d9ecde","--moss-border":"#b9d7c0",
      "--action":"#1b7d45","--action-hover":"#0d6a38","--action-surface":"#e8f4eb","--action-surface-hover":"#d9ecde","--action-border":"#b9d7c0",
      "--sage":"#1b7d45","--sage-surface":"#eaf4ec","--fog":"#597761","--fog-surface":"#eef3ef",
      "--clay":"#ef475d","--pale-sand":"#fee8e7","--hairline":"#dee5de","--border-strong":"#c7d2c7",
      "--brand-mark-bg":"#1b7d45","--brand-mark-fg":"#ffffff","--brand-mark-border":"#0d6a38",
      "--ai":"#ef475d","--ai-fg":"#2c1015",
    },
  }),
  defineSystemTheme({
    id: "ganqing-buddha", name: "绀青佛手", motif: "huiwen",
    description: "清亮绀青配佛手黄，适合偏年轻、辨识度高的工作界面。",
    tokens: {
      "--paper":"#f8f9fd","--warm":"#fbfcfe","--stone":"#eff2f8","--sand-panel":"#e4e8f2",
      "--ink":"#202a3a","--graphite":"#495a72","--muted":"#5d6d84","--disabled":"#a5afbe",
      "--moss":"#3364db","--moss-hover":"#2854be","--moss-surface":"#e7eefc","--moss-surface-hover":"#dde7f9","--moss-border":"#bfceec",
      "--action":"#3364db","--action-hover":"#2854be","--action-surface":"#e7eefc","--action-surface-hover":"#dde7f9","--action-border":"#bfceec",
      "--sage":"#4f82f5","--sage-surface":"#ecf1fc","--fog":"#5e6f8f","--fog-surface":"#eff2f7",
      "--clay":"#f7ca1d","--pale-sand":"#f4eedb","--hairline":"#dfe3ec","--border-strong":"#c9cedc",
      "--brand-mark-bg":"#3364db","--brand-mark-fg":"#ffffff","--brand-mark-border":"#2854be",
      "--ai":"#f7ca1d","--ai-fg":"#1f2a44",
    },
  }),
] as const;

// Backgrounds keep the hue of the user-supplied samples, lightened toward the established papers; accents remain contrast-derived.
const referenceThemes = [
  {id:'reference-cool',name:'冷白实验室',base:0,paper:'#f3faf6',warm:'#fafdfe',stone:'#e9f2f3'},
  {id:'reference-lilac',name:'柔紫灰',base:3,paper:'#fcf3f7',warm:'#fefbf9',stone:'#efecf6'},
  {id:'reference-cream',name:'暖白实验簿',base:2,paper:'#fbf7ef',warm:'#fefcf8',stone:'#f5f0e4'},
  {id:'reference-peach',name:'柔粉米白',base:1,paper:'#fff4f1',warm:'#fefbf9',stone:'#faede7'},
  {id:'reference-blue',name:'深蓝冷白',base:4,paper:'#f1f7fe',warm:'#FEFDF9',stone:'#e7f1f6'},
] as const;
export const systemThemes = [...establishedThemes,...referenceThemes.map(reference=>defineSystemTheme({
  ...establishedThemes[reference.base],id:reference.id,name:reference.name,
  description:'依据附件背景色取样并提亮，正文与操作色经对比度派生。',
  tokens:{...establishedThemes[reference.base].tokens,'--paper':reference.paper,'--warm':reference.warm,'--stone':reference.stone,...(reference.id==='reference-peach'?{'--moss':'#106b84','--action':'#106b84','--pale-sand':'#FDF4DF'}:reference.id==='reference-blue'?{'--moss':'#033167','--action':'#033167'}:reference.id==='reference-lilac'?{'--hairline':'#dde0e3'}:{})},
}))];

export type SystemThemeId = (typeof systemThemes)[number]["id"];

export function isSystemThemeId(value: string | null): value is SystemThemeId {
  return systemThemes.some((theme) => theme.id === value);
}

export function systemThemeCssText() {
  return systemThemes.map((theme, index) => {
    const selector = index === 0
      ? `:root,html[data-labnest-theme="${theme.id}"]`
      : `html[data-labnest-theme="${theme.id}"]`;
    const declarations = Object.entries(theme.tokens)
      .map(([property, value]) => `${property}:${value}`)
      .join(";");
    return `${selector}{${declarations}}`;
  }).join("");
}

/** Dark variants reuse scheme IDs and existing semantic tokens; charts and document paper are separate. */
export function resolvedThemeTokens(themeId:string,mode:'light'|'dark'):Record<string,string>{
 const index=Math.max(0,systemThemes.findIndex(theme=>theme.id===themeId));const theme=systemThemes[index];
 if(mode==='light')return {...theme.tokens,'--surface':'#ffffff','--warning':'#805b24','--warning-surface':'#faf0dc','--control-border':'#77848d','--success':'#276340','--success-surface':'#e9f5ec','--error':'#a12a39','--error-surface':'#fcebef'};
 // Each existing scheme has its own dark palette; IDs and user selections stay stable.
 const darkPalettes=[['#aac9e1','#e2b99d','#151d24'],['#89d5e8','#f2ada3','#132126'],['#80d6cc','#feb66d','#17221c'],['#dcabda','#8adb8d','#231b24'],['#9bbeff','#fec25d','#182033'],['#7ed49d','#f9919f','#17231d'],['#a0bdfe','#f8d64c','#1c2032']];
 const [accent,selection,paper]=darkPalettes[index < establishedThemes.length ? index : referenceThemes[index-establishedThemes.length].base];
 return {...theme.tokens,'--paper':paper,'--warm':'#1a242d','--stone':'#202c35','--sand-panel':'#283641','--surface':'#1c2730','--ink':'#edf2f5','--graphite':'#d0dce4','--muted':'#b3c2cd','--disabled':'#7d8a94','--moss':accent,'--moss-hover':'#d8e9f4','--action':accent,'--action-hover':'#d8e9f4','--sage':accent,'--moss-surface':'#263b46','--moss-surface-hover':'#304754','--moss-border':'#678493','--sage-surface':'#263b46','--action-surface':'#263b46','--action-surface-hover':'#304754','--action-border':'#678493','--fog':'#b4cedd','--fog-surface':'#263844','--pale-sand':'#3b302a','--clay':'#e2b99d','--hairline':'#455966','--border-strong':'#8aa2b1','--control-border':'#8aa2b1','--brand-mark-bg':accent,'--brand-mark-fg':'#15212a','--brand-mark-border':accent,'--ai':selection,'--ai-fg':'#251c16','--ai-hover':hoverShade(selection,'#251c16'),'--warning':'#f1ce92','--warning-surface':'#3b3020','--success':'#a6dfb3','--success-surface':'#203b2b','--error':'#ffb8bf','--error-surface':'#402b33','--info':'#b7d9e8','--info-surface':'#233844'};
}
export function appearanceThemeCssText(){
 return systemThemes.map(theme=>['light','dark'].map(mode=>{const tokens=resolvedThemeTokens(theme.id,mode as 'light'|'dark');const declarations=Object.entries(tokens).map(([key,value])=>`${key}:${value}`).join(';');const documentTokens=Object.entries(resolvedThemeTokens(theme.id,'light')).map(([key,value])=>`${key}:${value}`).join(';');return `html[data-labnest-theme="${theme.id}"][data-labnest-mode="${mode}"]{${declarations};color-scheme:${mode}}html[data-labnest-theme="${theme.id}"] :is(.document-a4-paper,.scientific-document-view,.tiptap.document-editor-content){${documentTokens};color-scheme:light}`;}).join('')).join('');
}
