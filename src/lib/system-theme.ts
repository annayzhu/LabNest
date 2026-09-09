export const systemThemeStorageKey = "labnest.system-theme";

type SystemThemeTokens = Readonly<Record<
  | "--paper" | "--warm" | "--stone" | "--sand-panel"
  | "--ink" | "--graphite" | "--muted" | "--disabled"
  | "--moss" | "--moss-hover" | "--moss-surface" | "--moss-surface-hover" | "--moss-border"
  | "--action" | "--action-hover" | "--action-surface" | "--action-surface-hover" | "--action-border"
  | "--contrast-action" | "--contrast-action-hover" | "--contrast-action-fg" | "--contrast-action-soft" | "--contrast-action-border"
  | "--sage" | "--sage-surface" | "--fog" | "--fog-surface"
  | "--clay" | "--pale-sand" | "--hairline" | "--border-strong"
  | "--brand-mark-bg" | "--brand-mark-fg" | "--brand-mark-border"
  | "--nav-active-bg" | "--nav-active-fg" | "--nav-active-border",
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
    colors: [theme.tokens["--paper"], theme.tokens["--sage"], theme.tokens["--clay"]] as const,
    navigation: {
      background: theme.tokens["--nav-active-bg"],
      foreground: theme.tokens["--nav-active-fg"],
    },
  } as const;
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
      "--contrast-action":"#a5441b","--contrast-action-hover":"#893614","--contrast-action-fg":"#ffffff","--contrast-action-soft":"#f6e9e2","--contrast-action-border":"#8d3716",
      "--sage":"#2a475f","--sage-surface":"#eaf1f5","--fog":"#526f83","--fog-surface":"#edf2f6",
      "--clay":"#a5441b","--pale-sand":"#f6e9e2","--hairline":"#dce4e9","--border-strong":"#c4d0d8",
      "--brand-mark-bg":"#2a475f","--brand-mark-fg":"#ffffff","--brand-mark-border":"#213a4e",
      "--nav-active-bg":"#a5441b","--nav-active-fg":"#ffffff","--nav-active-border":"#8d3716",
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
      "--contrast-action":"#bf4f42","--contrast-action-hover":"#a23f35","--contrast-action-fg":"#ffffff","--contrast-action-soft":"#f9e7e3","--contrast-action-border":"#a23f35",
      "--sage":"#30aecf","--sage-surface":"#e4f6fa","--fog":"#4a7f8c","--fog-surface":"#e8f4f6",
      "--clay":"#de7565","--pale-sand":"#f9e7e3","--hairline":"#d8e6e9","--border-strong":"#bdd3d8",
      "--brand-mark-bg":"#147d99","--brand-mark-fg":"#ffffff","--brand-mark-border":"#116b83",
      "--nav-active-bg":"#de7565","--nav-active-fg":"#2b1815","--nav-active-border":"#bd5d50",
    },
  }),
  defineSystemTheme({
    id: "celadon-pine", name: "青瓷松石", motif: "lotus",
    description: "青瓷与松石负责秩序，以槟榔棕作为温暖的选中撞色。",
    tokens: {
      "--paper":"#f5f8f2","--warm":"#fbfcf8","--stone":"#edf2e8","--sand-panel":"#e1e9dc",
      "--ink":"#222a25","--graphite":"#4b5a51","--muted":"#5d6d63","--disabled":"#a6afa9",
      "--moss":"#397978","--moss-hover":"#2e6665","--moss-surface":"#e2f1ef","--moss-surface-hover":"#d5eae7","--moss-border":"#b8d8d4",
      "--action":"#397978","--action-hover":"#2e6665","--action-surface":"#e2f1ef","--action-surface-hover":"#d5eae7","--action-border":"#b8d8d4",
      "--contrast-action":"#986524","--contrast-action-hover":"#7c5019","--contrast-action-fg":"#ffffff","--contrast-action-soft":"#f8eadb","--contrast-action-border":"#7c5019",
      "--sage":"#4a9d9c","--sage-surface":"#e5f3f1","--fog":"#5c7d78","--fog-surface":"#edf3ef",
      "--clay":"#c1651a","--pale-sand":"#f8eadb","--hairline":"#dde5da","--border-strong":"#c7d2c3",
      "--brand-mark-bg":"#397978","--brand-mark-fg":"#ffffff","--brand-mark-border":"#2e6665",
      "--nav-active-bg":"#986524","--nav-active-fg":"#ffffff","--nav-active-border":"#7c5019",
    },
  }),
  defineSystemTheme({
    id: "lotus-ink", name: "藕荷砚墨", motif: "linked-diamond",
    description: "藕荷紫与官绿相撞，保留温润纸感又有明确焦点。",
    tokens: {
      "--paper":"#faf6f4","--warm":"#fdfaf8","--stone":"#f3ecec","--sand-panel":"#ebe1e3",
      "--ink":"#2a2528","--graphite":"#5a4e54","--muted":"#6d5d65","--disabled":"#aea4a9",
      "--moss":"#75556b","--moss-hover":"#624659","--moss-surface":"#f1e8ee","--moss-surface-hover":"#eadee6","--moss-border":"#ddcbd7",
      "--action":"#75556b","--action-hover":"#624659","--action-surface":"#f1e8ee","--action-surface-hover":"#eadee6","--action-border":"#ddcbd7",
      "--contrast-action":"#587f3d","--contrast-action-hover":"#45672f","--contrast-action-fg":"#ffffff","--contrast-action-soft":"#edf3e6","--contrast-action-border":"#45672f",
      "--sage":"#75556b","--sage-surface":"#f3ebf0","--fog":"#796674","--fog-surface":"#f3edef",
      "--clay":"#7aa35a","--pale-sand":"#edf3e6","--hairline":"#e8dedf","--border-strong":"#d5c7ca",
      "--brand-mark-bg":"#75556b","--brand-mark-fg":"#ffffff","--brand-mark-border":"#624659",
      "--nav-active-bg":"#7aa35a","--nav-active-fg":"#15210f","--nav-active-border":"#638948",
    },
  }),
  defineSystemTheme({
    id: "indigo-xiangqi", name: "靛青缃绮", motif: "linked-diamond",
    description: "深靛蓝搭配明亮缃绮金，理性内容中带清晰行动焦点。",
    tokens: {
      "--paper":"#f6f8fc","--warm":"#fbfcff","--stone":"#eaf0f8","--sand-panel":"#dce5f1",
      "--ink":"#1f2937","--graphite":"#46566b","--muted":"#5c6b7e","--disabled":"#a4afbd",
      "--moss":"#1661ab","--moss-hover":"#0f4f91","--moss-surface":"#e4eefb","--moss-surface-hover":"#d7e6f8","--moss-border":"#b8d0ee",
      "--action":"#1661ab","--action-hover":"#0f4f91","--action-surface":"#e4eefb","--action-surface-hover":"#d7e6f8","--action-border":"#b8d0ee",
      "--contrast-action":"#8a5a12","--contrast-action-hover":"#6f470c","--contrast-action-fg":"#ffffff","--contrast-action-soft":"#fcf0dc","--contrast-action-border":"#6f470c",
      "--sage":"#1661ab","--sage-surface":"#eaf2fc","--fog":"#526b89","--fog-surface":"#edf2f8",
      "--clay":"#f8c471","--pale-sand":"#fcf0dc","--hairline":"#d9e2ef","--border-strong":"#bdcbe0",
      "--brand-mark-bg":"#1661ab","--brand-mark-fg":"#ffffff","--brand-mark-border":"#0f4f91",
      "--nav-active-bg":"#f8c471","--nav-active-fg":"#2f240e","--nav-active-border":"#d29b42",
    },
  }),
  defineSystemTheme({
    id: "palace-jasmine", name: "宫绿茉莉", motif: "lotus",
    description: "宫殿绿与草茉莉红形成鲜明互补，明快但不过量。",
    tokens: {
      "--paper":"#f7faf5","--warm":"#fbfdf9","--stone":"#edf4ea","--sand-panel":"#dfead9",
      "--ink":"#202b23","--graphite":"#46584b","--muted":"#5c6d60","--disabled":"#a5b0a7",
      "--moss":"#20894d","--moss-hover":"#176b3b","--moss-surface":"#e4f3e9","--moss-surface-hover":"#d7ebdf","--moss-border":"#b9d9c5",
      "--action":"#20894d","--action-hover":"#176b3b","--action-surface":"#e4f3e9","--action-surface-hover":"#d7ebdf","--action-border":"#b9d9c5",
      "--contrast-action":"#c92f46","--contrast-action-hover":"#aa2338","--contrast-action-fg":"#ffffff","--contrast-action-soft":"#fde9ed","--contrast-action-border":"#aa2338",
      "--sage":"#20894d","--sage-surface":"#edf4e7","--fog":"#5c7b63","--fog-surface":"#edf3ee",
      "--clay":"#ef475d","--pale-sand":"#fde9ed","--hairline":"#dce6d8","--border-strong":"#c4d2bf",
      "--brand-mark-bg":"#20894d","--brand-mark-fg":"#ffffff","--brand-mark-border":"#176b3b",
      "--nav-active-bg":"#ef475d","--nav-active-fg":"#2c1015","--nav-active-border":"#ca3347",
    },
  }),
  defineSystemTheme({
    id: "ganqing-buddha", name: "绀青佛手", motif: "huiwen",
    description: "清亮绀青配佛手黄，适合偏年轻、辨识度高的工作界面。",
    tokens: {
      "--paper":"#f7f9ff","--warm":"#fcfdff","--stone":"#edf1fb","--sand-panel":"#dfe6f5",
      "--ink":"#202a3a","--graphite":"#495a72","--muted":"#5d6d84","--disabled":"#a5afbe",
      "--moss":"#356fdc","--moss-hover":"#285bb9","--moss-surface":"#e6edff","--moss-surface-hover":"#d9e4ff","--moss-border":"#bdcdf5",
      "--action":"#356fdc","--action-hover":"#285bb9","--action-surface":"#e6edff","--action-surface-hover":"#d9e4ff","--action-border":"#bdcdf5",
      "--contrast-action":"#745b00","--contrast-action-hover":"#594600","--contrast-action-fg":"#ffffff","--contrast-action-soft":"#fff8cf","--contrast-action-border":"#594600",
      "--sage":"#4f84ff","--sage-surface":"#edf2ff","--fog":"#5a7199","--fog-surface":"#eff2f8",
      "--clay":"#fed71a","--pale-sand":"#fff8cf","--hairline":"#dce3f0","--border-strong":"#c5cede",
      "--brand-mark-bg":"#356fdc","--brand-mark-fg":"#ffffff","--brand-mark-border":"#285bb9",
      "--nav-active-bg":"#fed71a","--nav-active-fg":"#1f2a44","--nav-active-border":"#d8b400",
    },
  }),
] as const;

// User-supplied approximate background samples; accents remain contrast-derived.
const referenceThemes = [
  {id:'reference-cool',name:'冷白实验室',base:0,paper:'#EDF5F1',warm:'#F2F9FE',stone:'#DDE7E9'},
  {id:'reference-lilac',name:'柔紫灰',base:3,paper:'#EFE4E9',warm:'#F2EFED',stone:'#CECBDA'},
  {id:'reference-cream',name:'暖白实验簿',base:2,paper:'#F5F1E8',warm:'#FEFDF9',stone:'#F8F2E4'},
  {id:'reference-peach',name:'柔粉米白',base:1,paper:'#FAEBE6',warm:'#FEF0E3',stone:'#FDF6E9'},
  {id:'reference-blue',name:'深蓝冷白',base:4,paper:'#E2EEFD',warm:'#FEFDF9',stone:'#DDE7E9'},
] as const;
export const systemThemes = [...establishedThemes,...referenceThemes.map(reference=>defineSystemTheme({
  ...establishedThemes[reference.base],id:reference.id,name:reference.name,
  description:'依据附件近似背景色取样，正文与操作色经对比度派生。',
  tokens:{...establishedThemes[reference.base].tokens,'--paper':reference.paper,'--warm':reference.warm,'--stone':reference.stone,...(reference.id==='reference-peach'?{'--moss':'#106b84','--action':'#106b84'}:{})},
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
 if(mode==='light')return {...theme.tokens,...(themeId==='palace-jasmine'?{'--moss':'#1b7d45','--action':'#1b7d45'}:{}),'--surface':'#ffffff','--warning':'#805b24','--warning-surface':'#faf0dc','--control-border':'#77848d','--success':'#276340','--success-surface':'#e9f5ec','--error':'#a12a39','--error-surface':'#fcebef'};
 // Each existing scheme has its own dark palette; IDs and user selections stay stable.
 const darkPalettes=[['#aac9e1','#e2b99d','#151d24'],['#89d5e8','#f2ada3','#132126'],['#a7d2b4','#e4c29b','#17221c'],['#d6b9df','#b9d6a2','#231b24'],['#aacbff','#f2d294','#182033'],['#97d5af','#f2aebe','#17231d'],['#b4c9ff','#efda86','#1c2032']];
 const [accent,selection,paper]=darkPalettes[index < establishedThemes.length ? index : referenceThemes[index-establishedThemes.length].base];
 return {...theme.tokens,'--paper':paper,'--warm':'#1a242d','--stone':'#202c35','--sand-panel':'#283641','--surface':'#1c2730','--ink':'#edf2f5','--graphite':'#d0dce4','--muted':'#b3c2cd','--disabled':'#7d8a94','--moss':accent,'--moss-hover':'#d8e9f4','--action':accent,'--action-hover':'#d8e9f4','--sage':accent,'--moss-surface':'#263b46','--moss-surface-hover':'#304754','--moss-border':'#678493','--sage-surface':'#263b46','--action-surface':'#263b46','--action-surface-hover':'#304754','--action-border':'#678493','--fog':'#b4cedd','--fog-surface':'#263844','--pale-sand':'#3b302a','--clay':'#e2b99d','--hairline':'#455966','--border-strong':'#8aa2b1','--control-border':'#8aa2b1','--brand-mark-bg':accent,'--brand-mark-fg':'#15212a','--brand-mark-border':accent,'--nav-active-bg':selection,'--nav-active-fg':'#251c16','--nav-active-border':selection,'--contrast-action':'#e2b99d','--contrast-action-hover':'#efd0b9','--contrast-action-fg':'#251c16','--contrast-action-soft':'#3b302a','--contrast-action-border':'#e2b99d','--warning':'#f1ce92','--warning-surface':'#3b3020','--success':'#a6dfb3','--success-surface':'#203b2b','--error':'#ffb8bf','--error-surface':'#402b33','--info':'#b7d9e8','--info-surface':'#233844'};
}
export function appearanceThemeCssText(){
 return systemThemes.map(theme=>['light','dark'].map(mode=>{const tokens=resolvedThemeTokens(theme.id,mode as 'light'|'dark');const declarations=Object.entries(tokens).map(([key,value])=>`${key}:${value}`).join(';');const documentTokens=Object.entries(resolvedThemeTokens(theme.id,'light')).map(([key,value])=>`${key}:${value}`).join(';');return `html[data-labnest-theme="${theme.id}"][data-labnest-mode="${mode}"]{${declarations};color-scheme:${mode}}html[data-labnest-theme="${theme.id}"] :is(.document-a4-paper,.scientific-document-view,.tiptap.document-editor-content){${documentTokens};color-scheme:light}`;}).join('')).join('');
}
