/* Only explicit read-only snapshots; no general API caching or write replay. Atomic preparation retains the last usable generation. */
const prefix='labnest-calculator-shell-',metaName=prefix+'metadata-v5',metaUrl='/tools/calculator/__offline_manifest';
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
const attachment=path=>/^\/api\/attachments\/[^/]+$/.test(path);
const allowed=path=>attachment(path)||path.startsWith('/tools/calculator')||/^\/experiments\/[^/]+\/run$/.test(path)||path.startsWith('/_next/static/')||path.startsWith('/icons/lab-soft-v1/');
async function manifest(){return (await (await caches.open(metaName)).match(metaUrl))?.json();}
async function fetchRequired(path,document=false){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const response=await fetch(path,{signal:controller.signal,cache:'no-store',redirect:'error'});if(!response.ok||response.type==='opaque'||(document&&!response.headers.get('content-type')?.includes('text/html')))throw new Error(`Required resource ${path}: ${response.status}`);const pathname=new URL(path,self.location.origin).pathname,mime=response.headers.get('content-type')||'';if((pathname.endsWith('.js')&&!/(javascript|ecmascript)/.test(mime))||(pathname.endsWith('.css')&&!mime.includes('text/css'))||(pathname.endsWith('.png')&&!mime.startsWith('image/')))throw new Error(`Unexpected resource type ${path}: ${mime}`);if(attachment(new URL(path,self.location.origin).pathname)&&!response.headers.get('content-type')?.startsWith('image/'))throw new Error(`Unexpected attachment ${path}`);if(document&&!(await response.clone().text()).includes('/_next/'))throw new Error(`Unexpected document ${path}`);await response.clone().arrayBuffer();return response;}finally{clearTimeout(timer);}}
let preparations=Promise.resolve();
self.addEventListener('message',event=>{const type=event.data?.type;if(!['CACHE_CALCULATOR','CALCULATOR_STATUS','CLEAR_CALCULATOR'].includes(type))return;event.waitUntil(preparations=preparations.then(async()=>{let staging;try{
 if(type==='CLEAR_CALCULATOR'){for(const name of await caches.keys())if(name.startsWith(prefix))await caches.delete(name);event.ports[0]?.postMessage({ok:true});return;}
 const old=await manifest();
 if(type==='CALCULATOR_STATUS'){const cache=old&&await caches.open(old.cache);const complete=cache&&await Promise.all(old.urls.map(url=>cache.match(url))).then(values=>values.every(Boolean));event.ports[0]?.postMessage({ok:Boolean(complete),pages:complete?old.pages:[]});return;}
 const sanitize=values=>[...new Set(values)].filter(value=>{try{const u=new URL(value,self.location.origin);return u.origin===self.location.origin&&allowed(u.pathname)&&!u.searchParams.has('_rsc');}catch{return false;}});
 const pages=sanitize(event.data.pages||[]),resources=sanitize(event.data.resources||[]);if(!pages.length||!resources.length)throw new Error('Empty preparation manifest');
 staging=prefix+'v5-'+crypto.randomUUID();const cache=await caches.open(staging);
 // Copy only an already prepared generation. All requested documents/resources are refreshed atomically below.
 if(old){const previous=await caches.open(old.cache);for(const request of await previous.keys()){const response=await previous.match(request);if(response)await cache.put(request,response);}}
 for(const path of pages)await cache.put(path,await fetchRequired(path,true));
 for(const path of resources)await cache.put(path,await fetchRequired(path));
 const mergedPages=[...new Set([...(old?.pages||[]),...pages])];const urls=(await cache.keys()).map(r=>r.url);
 await (await caches.open(metaName)).put(metaUrl,new Response(JSON.stringify({cache:staging,pages:mergedPages,urls}),{headers:{'Content-Type':'application/json'}}));
 // Do not delete an old worker's cache until the complete replacement is published.
 for(const name of await caches.keys())if(name.startsWith(prefix)&&name!==metaName&&name!==staging)await caches.delete(name);
 event.ports[0]?.postMessage({ok:true,pages:mergedPages});
 }catch(error){if(staging)await caches.delete(staging);event.ports[0]?.postMessage({ok:false,kind:error.name==='QuotaExceededError'?'quota':error.name==='AbortError'?'timeout':'resource',detail:String(error)});}}));});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!allowed(url.pathname)||event.request.headers.get('RSC')==='1'||url.searchParams.has('_rsc'))return;
 event.respondWith((async()=>{const meta=await manifest(),cache=meta&&await caches.open(meta.cache);const hit=cache&&await cache.match(event.request);if(attachment(url.pathname)&&!hit)return fetch(event.request);if(hit&&(url.pathname.startsWith('/_next/static/')||url.pathname.startsWith('/icons/')||attachment(url.pathname)))return hit;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),1500);try{const response=await fetch(event.request,{signal:controller.signal});if(response.ok)return response;if(hit)return hit;return response;}catch{if(hit)return hit;return new Response('此页面尚未准备离线使用 / This page is not prepared for offline use',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}finally{clearTimeout(timer);}})());});
