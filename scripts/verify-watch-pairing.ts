/** Run only against a disposable PostgreSQL database after `prisma db push`.
 * DATABASE_URL=postgresql://...@127.0.0.1:55440/labnest_watch_pairing_test npx tsx scripts/verify-watch-pairing.ts
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/db';
import { createWatchPairing, claimWatchPairing, authorizeWatch, revokeWatchPairings, WatchPairingRateLimitError } from '../src/lib/watch-execution.server';
import { POST } from '../src/app/api/watch/pair/route';

const database = new URL(process.env.DATABASE_URL!);
assert(['localhost', '127.0.0.1'].includes(database.hostname) && database.pathname === '/labnest_watch_pairing_test', 'Disposable test database required');
const hash = (code: string) => createHash('sha256').update(code).digest('hex');
const reset = () => prisma.activityLog.deleteMany();
const claim = (code: string) => claimWatchPairing(code, randomUUID());

async function main() {
  const experiment = await prisma.experiment.create({ data: { runCode: `WATCH-QA-${randomUUID()}`, title: 'Synthetic pairing verification' } });
  const other = await prisma.experiment.create({ data: { runCode: `WATCH-QA-${randomUUID()}`, title: 'Synthetic second experiment' } });
  await reset();
  const codes = await Promise.all(Array.from({ length: 20 }, (_, i) => createWatchPairing(i % 2 ? other.id : experiment.id)));
  assert.equal(new Set(codes.map(pair => pair.code)).size, codes.length, 'Concurrent codes must be unique');
  assert(codes.every(pair => /^[0-9]{4}$/.test(pair.code) && Date.parse(pair.expiresAt) > Date.now()));
  const claims = await Promise.allSettled([claim(codes[0].code), claim(codes[0].code)]);
  assert.equal(claims.filter(result => result.status === 'fulfilled').length, 1, 'Only one concurrent claimant wins');
  const grant = claims.find(result => result.status === 'fulfilled')!;
  assert(grant.status === 'fulfilled');
  assert.equal(grant.value.experimentId, experiment.id);
  await authorizeWatch(grant.value.token, experiment.id);
  await assert.rejects(authorizeWatch(grant.value.token, other.id));
  await revokeWatchPairings(experiment.id);
  await assert.rejects(authorizeWatch(grant.value.token, experiment.id));
  await assert.rejects(claim(codes[2].code), /失效/);

  await reset();
  // Fill all but one code: allocation must find the sole free value, including its leading zero.
  await prisma.activityLog.createMany({ data: Array.from({ length: 10_000 }, (_, i) => String(i).padStart(4, '0')).filter(code => code !== '0007').map(code => ({
    action: 'watch_pairing_created', targetType: 'experiment', targetId: other.id,
    metadataJson: { codeHash: hash(code), expiresAt: new Date(Date.now() + 600_000).toISOString() },
  })) });
  const last = await createWatchPairing(experiment.id);
  assert.equal(last.code, '0007');
  assert.equal((await claim(last.code)).experimentId, experiment.id);
  await assert.rejects(createWatchPairing(other.id), /用完/, 'Used codes remain reserved until expiry');

  await reset();
  const expired = await createWatchPairing(experiment.id);
  await prisma.activityLog.updateMany({ where: { action: 'watch_pairing_created' }, data: { metadataJson: { codeHash: hash(expired.code), expiresAt: new Date(0).toISOString() } } });
  await assert.rejects(claim(expired.code), /失效/);
  assert.equal(await prisma.activityLog.count({ where: { action: 'watch_pairing_failed' } }), 1, 'Failed attempt must survive transaction commit');
  await reset();
  const valid = await createWatchPairing(experiment.id);
  const wrong = valid.code === '9999' ? '9998' : '9999';
  for (let attempt = 0; attempt < 5; attempt++) await assert.rejects(claim(wrong), /失效/);
  await assert.rejects(claim(valid.code), WatchPairingRateLimitError, 'Changing device IDs must not bypass limit');
  const response = await POST(new Request('http://localhost/api/watch/pair', { method: 'POST', body: JSON.stringify({ code: valid.code, deviceId: randomUUID() }) }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '600');
  await prisma.activityLog.updateMany({ where: { action: 'watch_pairing_failed' }, data: { createdAt: new Date(Date.now() - 601_000) } });
  assert.equal((await claim(valid.code)).experimentId, experiment.id, 'Pairing resumes after failure window');
  for (const code of ['123', '12345', 'A123', '１２３４', 'A1B2C3D4E5F6']) await assert.rejects(claim(code));
  assert((await prisma.activityLog.findMany()).every(row => !('code' in (row.metadataJson as object))), 'Never store plaintext codes');
  console.log('PASS numeric codes, leading zero, concurrent allocation/claim, collision exhaustion, scope, expiry, revocation, persistent throttling and HTTP 429');
}

main().finally(() => prisma.$disconnect());
