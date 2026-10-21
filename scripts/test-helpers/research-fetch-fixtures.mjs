/** Preload only in the disposable research acceptance server. Production app code keeps its real service URLs. */
import assert from 'node:assert/strict';
const database = new URL(process.env.DATABASE_URL ?? '');
assert(['localhost', '127.0.0.1'].includes(database.hostname) && database.pathname === '/labnest_protocol_ai_extraction_20261009', 'Only the isolated research acceptance database is allowed.');
const manual = new URL(process.env.LABNEST_MANUAL_SEARCH_URL ?? '');
const literature = new URL(process.env.LABNEST_EUROPE_PMC_BASE ?? '');
assert(manual.hostname === '127.0.0.1' && literature.hostname === '127.0.0.1', 'Fixtures must stay on this machine.');
const originalFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  let target;
  if (url.hostname === 'api.tavily.com' && url.pathname === '/search') target = manual.toString();
  else if (url.hostname === 'www.ebi.ac.uk' && url.pathname.startsWith('/europepmc/')) target = new URL(url.pathname + url.search, literature).toString();
  else assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), `Unexpected outside request in acceptance: ${url.hostname}`);
  return originalFetch(target ? input instanceof Request ? new Request(target, input) : target : input, init);
};
