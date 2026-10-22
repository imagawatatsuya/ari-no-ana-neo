import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSupabaseAvailability } from './scripts/check-supabase.mjs';

const config = { url: 'https://project.example.test', anonKey: 'public-test-key' };

test('availability probe calls only the public list RPC, never posts a work', async () => {
  let called = 0;
  const result = await checkSupabaseAvailability({ ...config, fetchImpl: async (url, options) => {
    called += 1;
    assert.equal(url.href, 'https://project.example.test/rest/v1/rpc/list_public_novels');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { p_offset: 0, p_limit: 1, p_search: null, p_is_ryuseigai: false });
    assert.equal(options.headers.apikey, config.anonKey);
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json([{ id: 'public', title: '公開作品' }]);
  } });
  assert.deepEqual(result, { sampleCount: 1 });
  assert.equal(called, 1);
});

test('availability probe accepts a genuinely empty list', async () => {
  assert.deepEqual(await checkSupabaseAvailability({ ...config, fetchImpl: async () => Response.json([]) }), { sampleCount: 0 });
});

test('network/DNS errors surface an actionable message without leaking credentials', async () => {
  await assert.rejects(checkSupabaseAvailability({ ...config, fetchImpl: async () => { throw new Error(config.anonKey); } }), (error) => {
    assert.match(error.message, /project status, DNS/);
    assert.ok(!error.message.includes(config.anonKey));
    return true;
  });
});

test('unavailable and unauthorized APIs fail the deployment probe', async () => {
  for (const status of [401, 403, 404, 503]) {
    await assert.rejects(checkSupabaseAvailability({ ...config, fetchImpl: async () => new Response('', { status }) }), new RegExp(`HTTP ${status}`));
  }
});

test('malformed successful responses are not mistaken for recovery', async () => {
  for (const body of [{ error: 'not rows' }, [null], [{ id: 'n' }]]) {
    await assert.rejects(checkSupabaseAvailability({ ...config, fetchImpl: async () => Response.json(body) }), /unexpected response/);
  }
  await assert.rejects(checkSupabaseAvailability({ ...config, fetchImpl: async () => new Response('invalid json') }), /invalid JSON/);
});

test('missing or unsafe configuration fails without making a request', async () => {
  for (const overrides of [{ url: '' }, { anonKey: '' }, { url: 'http://project.example.test' }, { url: 'https://user:password@project.example.test' }]) {
    await assert.rejects(checkSupabaseAvailability({ ...config, ...overrides, fetchImpl: () => assert.fail('must not fetch') }));
  }
});
