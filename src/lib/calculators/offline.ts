export type OfflineFailure = 'environment'|'registration'|'resource'|'quota'|'timeout';
export class OfflineError extends Error { constructor(public kind:OfflineFailure, detail:string){super(detail);} }
function limit<T>(promise:Promise<T>, ms=15000):Promise<T>{return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new OfflineError('timeout','Offline preparation timed out')),ms);promise.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});}
async function activeWorker(){
 if(!window.isSecureContext||!('serviceWorker' in navigator))throw new OfflineError('environment',`${location.protocol}; secure=${window.isSecureContext}`);
 let registration:ServiceWorkerRegistration;
 try{registration=await limit(navigator.serviceWorker.register('/tools/calculator/worker.js',{scope:'/'}));}catch(error){if(error instanceof OfflineError)throw error;throw new OfflineError('registration',String(error));}
 const worker=registration.installing??registration.waiting??registration.active;
 if(!worker)throw new OfflineError('registration','No worker');
 if(worker.state!=='activated')await new Promise<void>((resolve,reject)=>{const finish=(error?:Error)=>{clearTimeout(timer);worker.removeEventListener('statechange',changed);if(error)reject(error);else resolve();};const changed=()=>{if(worker.state==='activated')finish();else if(worker.state==='redundant')finish(new OfflineError('registration','Worker redundant'));};const timer=setTimeout(()=>finish(new OfflineError('timeout','Worker activation timeout')),15000);worker.addEventListener('statechange',changed);changed();});
 return worker;
}
async function message(type:string, payload:Record<string,unknown>={}){
 const worker=await activeWorker();
 return new Promise<{ok:boolean;pages?:string[];kind?:OfflineFailure;detail?:string}>((resolve,reject)=>{const channel=new MessageChannel();const done=()=>{clearTimeout(timer);channel.port1.close();channel.port2.close();};const timer=setTimeout(()=>{done();reject(new OfflineError('timeout','Worker acknowledgement timeout'));},45000);channel.port1.onmessage=event=>{done();resolve(event.data);};try{worker.postMessage({type,...payload},[channel.port2]);}catch(error){done();reject(error);}});
}
export async function offlineStatus(){return message('CALCULATOR_STATUS');}
export async function clearOfflineTools(){return message('CLEAR_CALCULATOR');}
export async function prepareOffline(onStage:(stage:string)=>void){
 onStage('documents');
 const pages=[...new Set(['/tools/calculator',location.pathname+location.search])];
 const resources=new Set<string>();
 for(const path of pages){
  const response=await limit(fetch(path,{cache:'no-store',redirect:'error'}));
  if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw new OfflineError('resource',`Invalid document ${path}: ${response.status}`);
  const html=await limit(response.text());
  if(!html.includes('/_next/'))throw new OfflineError('resource',`Unexpected page ${path}`);
  const doc=new DOMParser().parseFromString(html,'text/html');
  // Explicitly selected Run snapshots can include immutable attachment images.
  for(const meta of doc.querySelectorAll('meta[name=labnest-offline-image]')){const value=meta.getAttribute('content');if(value&&/^\/api\/attachments\/[^/?]+(?:\?inline=1)?$/.test(value))resources.add(value);}
  for(const img of doc.querySelectorAll('img[src]')){const url=new URL(img.getAttribute('src')!,location.origin);if(url.origin===location.origin&&/^\/api\/attachments\/[^/]+$/.test(url.pathname)&&url.searchParams.get('inline')==='1')resources.add(url.pathname+url.search);}
  for(const node of doc.querySelectorAll('script[src],link[rel=stylesheet][href],link[rel=preload][href]')){const value=node.getAttribute('src')??node.getAttribute('href');if(value){const url=new URL(value,location.origin);if(url.origin===location.origin&&url.pathname.startsWith('/_next/static/'))resources.add(url.pathname);}}
 }
 // The current route has hydrated. Its executed lazy imports supplement the explicit HTML dependency list.
 for(const item of performance.getEntriesByType('resource')){const url=new URL(item.name);if(url.origin===location.origin&&url.pathname.startsWith('/_next/static/'))resources.add(url.pathname);}
 const manifest=await limit(fetch('/icons/lab-soft-v1/resources.json',{cache:'no-store'}));
 if(!manifest.ok)throw new OfflineError('resource','Icon manifest unavailable');
 for(const path of await limit(manifest.json()) as string[])resources.add(path);
 onStage('resources');const result=await message('CACHE_CALCULATOR',{pages,resources:[...resources]});
 if(!result.ok)throw new OfflineError(result.kind??'resource',result.detail??'Incomplete cache');
 return result;
}
