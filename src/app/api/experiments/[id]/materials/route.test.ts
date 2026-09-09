import { expect, it, vi } from 'vitest';
// An invalid action is a read-free probe of the public endpoint's origin gate.
vi.mock('@/lib/db', () => ({ prisma: {} }));
import { POST } from './route';
it('accepts the browser LAN origin when Next binds to an internal address', async () => {
  const response = await POST(new Request('http://0.0.0.0:3000/api/experiments/test/materials', {
    method: 'POST', headers: { host: '172.17.72.251:3000', origin: 'http://172.17.72.251:3000', 'content-type': 'application/json' }, body: JSON.stringify({action:'invalid'})
  }), {params: Promise.resolve({id:'test'})});
  expect(response.status).toBe(400);
});
it.each([
  {origin:'https://evil.example', host:'labnest.local:3000'},
  {origin:'http://evil.example', host:'labnest.local:3000', 'x-forwarded-host':'evil.example'},
  {origin:'null', host:'labnest.local:3000'},
  {origin:'https://labnest.local:3000', host:'labnest.local:3000', 'x-forwarded-proto':'https'},
])('rejects untrusted origins and client-supplied proxy claims: %j', async headers => {
  const response = await POST(new Request('http://0.0.0.0:3000/api/experiments/test/materials', {
    method:'POST', headers:Object.fromEntries(Object.entries(headers).filter((entry): entry is [string,string] => typeof entry[1] === 'string')), body:JSON.stringify({action:'invalid'})
  }), {params:Promise.resolve({id:'test'})});
  expect(response.status).toBe(403);
});
