import {expect,it,vi} from 'vitest';
vi.mock('@/lib/db',()=>({prisma:{}}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
import {POST as copy} from '@/app/api/experiments/[id]/copy/route';
import {PATCH as reorder} from '@/app/api/experiments/[id]/steps/order/route';
// Invalid input probes the actual route origin boundary without creating database records.
it.each([['copy','POST',copy],['steps/order','PATCH',reorder]] as const)('accepts the visible LAN origin for %s behind the container port',async(path,method,handler)=>{
 const r=await handler(new Request(`http://0.0.0.0:3000/api/experiments/test/${path}`,{method,headers:{host:'172.17.68.235:3001',origin:'http://172.17.68.235:3001','content-type':'application/json'},body:'{}'}),{params:Promise.resolve({id:'test'})});
 expect(r.status).toBe(409);
});
it.each([['copy','POST',copy],['steps/order','PATCH',reorder]] as const)('rejects foreign Origin for %s even with a spoofed forwarded host',async(path,method,handler)=>{
 const r=await handler(new Request(`http://0.0.0.0:3000/api/experiments/test/${path}`,{method,headers:{host:'172.17.68.235:3001',origin:'https://foreign.example','x-forwarded-host':'foreign.example','content-type':'application/json'},body:'{}'}),{params:Promise.resolve({id:'test'})});
 expect(r.status).toBe(403);
});
