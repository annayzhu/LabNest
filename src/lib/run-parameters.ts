/** Same placeholder grammar as renderProtocolTemplate; only the immutable experiment snapshot defines editable keys. */
export function runParameterKeys(snapshot:unknown):string[]{return [...new Set([...JSON.stringify(snapshot??{}).matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)].map(match=>match[1]))].sort();}
export function validateRunParameters(snapshot:unknown,input:unknown):Record<string,string>{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid parameter values');
 const allowed=new Set(runParameterKeys(snapshot));const result:Record<string,string>={};
 for(const [key,value] of Object.entries(input)){if(!allowed.has(key)||typeof value!=='string'||value.length>500)throw new Error('Invalid parameter name or value');if(value.trim())result[key]=value.trim();}
 return result;
}
