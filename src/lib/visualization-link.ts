/** No session, research data or credentials are appended to the independent URL. */
export function visualizationStudioUrl(value:string|undefined):string|null {
 if(!value?.trim())return null;
 try{const url=new URL(value.trim());if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)return null;return url.href;}catch{return null;}
}
export const legacyVisualizationKeys=['labnest:visualization-studio:palette','labnest:visualization-studio:custom-palettes'] as const;
export function legacyVisualizationExport(values:Record<string,string|null>) {
 const preferences:Record<string,unknown>={};
 for(const key of legacyVisualizationKeys) {const text=values[key];if(text!==null&&text!==undefined)preferences[key]=JSON.parse(text);}
 return {format:'visualization-studio-preferences',schemaVersion:1,source:'LabNest embedded',preferences};
}
