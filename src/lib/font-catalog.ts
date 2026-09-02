export type LabNestFontCatalogEntry = {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  family: string;
};

export const cjkFontCatalog = [
  { id: "source-han-sans", name: "思源黑体", nameEn: "Source Han Sans", description: "清晰、克制，适合导航与表单", descriptionEn: "Clear and restrained for navigation and forms", family: '"LabNest CJK Source Han Sans", sans-serif' },
  { id: "pingfang", name: "苹方", nameEn: "PingFang SC", description: "轻盈现代，适合 macOS", descriptionEn: "Light and modern on macOS", family: '"LabNest CJK PingFang", sans-serif' },
  { id: "system-sans", name: "系统黑体", nameEn: "System sans", description: "跟随当前设备，加载最稳定", descriptionEn: "Uses the most stable font on this device", family: '"LabNest CJK System Sans", sans-serif' },
  { id: "source-han-serif", name: "思源宋体", nameEn: "Source Han Serif", description: "清楚舒展，适合长文与标题", descriptionEn: "Open and readable for body text and headings", family: '"LabNest CJK Source Han Serif", serif' },
  { id: "songti", name: "华文宋体", nameEn: "Songti SC", description: "温润传统，适合中文文档", descriptionEn: "A warm, traditional Chinese serif", family: '"LabNest CJK Songti", serif' },
  { id: "simsun", name: "中易宋体", nameEn: "SimSun", description: "兼容性好，接近传统科研文稿", descriptionEn: "Compatible with traditional research documents", family: '"LabNest CJK SimSun", serif' },
  { id: "microsoft-yahei", name: "微软雅黑", nameEn: "Microsoft YaHei", description: "Windows 常用中文界面字体", descriptionEn: "Common Windows Chinese UI font", family: '"Microsoft YaHei", "微软雅黑", sans-serif' },
  { id: "dengxian", name: "等线", nameEn: "DengXian", description: "Windows 现代中文正文字体", descriptionEn: "Modern Windows Chinese text font", family: 'DengXian, "等线", sans-serif' },
  { id: "heiti-sc", name: "黑体-简", nameEn: "Heiti SC", description: "macOS 兼容中文黑体", descriptionEn: "Compatible macOS Chinese sans", family: '"Heiti SC", STHeiti, sans-serif' },
  { id: "hiragino-sans-gb", name: "冬青黑体", nameEn: "Hiragino Sans GB", description: "macOS 中文无衬线字体", descriptionEn: "macOS Chinese sans serif", family: '"Hiragino Sans GB", "冬青黑体简体中文", sans-serif' },
  { id: "kaiti-sc", name: "楷体-简", nameEn: "Kaiti SC", description: "中文楷体", descriptionEn: "Chinese Kai style", family: '"Kaiti SC", KaiTi, STKaiti, serif' },
  { id: "fangsong", name: "仿宋", nameEn: "FangSong", description: "中文仿宋体", descriptionEn: "Chinese FangSong style", family: 'FangSong, STFangsong, serif' },
] as const satisfies readonly LabNestFontCatalogEntry[];

export const latinFontCatalog = [
  { id: "arial", name: "Arial", nameEn: "Arial", description: "英文无衬线，适合界面与表单", descriptionEn: "Sans serif for interface text and forms", family: 'Arial, "Helvetica Neue", Helvetica' },
  { id: "times-new-roman", name: "Times New Roman", nameEn: "Times New Roman", description: "经典英文衬线字体", descriptionEn: "Classic serif for English text", family: '"Times New Roman", Times' },
  { id: "courier-new", name: "Courier New", nameEn: "Courier New", description: "等宽字体，适合编号与原始数据", descriptionEn: "Monospaced type for identifiers and raw data", family: '"Courier New", Courier, monospace' },
  { id: "helvetica", name: "Helvetica", nameEn: "Helvetica", description: "macOS 常用无衬线", descriptionEn: "Common macOS sans serif", family: 'Helvetica, "Helvetica Neue", Arial, sans-serif' },
  { id: "calibri", name: "Calibri", nameEn: "Calibri", description: "Microsoft Office 常用正文", descriptionEn: "Common Microsoft Office body font", family: 'Calibri, Carlito, Arial, sans-serif' },
  { id: "verdana", name: "Verdana", nameEn: "Verdana", description: "屏幕可读性良好", descriptionEn: "Highly readable on screen", family: 'Verdana, Geneva, sans-serif' },
  { id: "tahoma", name: "Tahoma", nameEn: "Tahoma", description: "紧凑无衬线", descriptionEn: "Compact sans serif", family: 'Tahoma, Verdana, sans-serif' },
  { id: "trebuchet-ms", name: "Trebuchet MS", nameEn: "Trebuchet MS", description: "人文无衬线", descriptionEn: "Humanist sans serif", family: '"Trebuchet MS", Arial, sans-serif' },
  { id: "georgia", name: "Georgia", nameEn: "Georgia", description: "屏幕衬线字体", descriptionEn: "Screen-optimized serif", family: 'Georgia, "Times New Roman", serif' },
  { id: "cambria", name: "Cambria", nameEn: "Cambria", description: "Microsoft Office 常用衬线", descriptionEn: "Common Microsoft Office serif", family: 'Cambria, "Times New Roman", serif' },
  { id: "garamond", name: "Garamond", nameEn: "Garamond", description: "经典出版衬线", descriptionEn: "Classic editorial serif", family: 'Garamond, "EB Garamond", serif' },
  { id: "palatino", name: "Palatino", nameEn: "Palatino", description: "宽松易读衬线", descriptionEn: "Open readable serif", family: 'Palatino, "Palatino Linotype", serif' },
] as const satisfies readonly LabNestFontCatalogEntry[];

export const documentFontCatalog = [...cjkFontCatalog, ...latinFontCatalog] as const;
