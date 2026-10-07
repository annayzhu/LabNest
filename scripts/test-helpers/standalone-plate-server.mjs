import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';

// Serve committed independent assets outside LabNest's integration route.
// This origin also supports a real localhost service-worker/offline test.
export async function startStandalonePlateServer(){
 const root=resolve('public/tools/free-plate-layout');
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
 const server=createServer(async(req,res)=>{
  try{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const path=resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
   if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
   res.setHeader('Content-Type',mime[extname(path)]??'application/octet-stream');
   res.end(await readFile(path));
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise((done,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',done);});
 return {base:`http://127.0.0.1:${server.address().port}`,close:async()=>{server.closeAllConnections();await new Promise(done=>server.close(done));}};
}
