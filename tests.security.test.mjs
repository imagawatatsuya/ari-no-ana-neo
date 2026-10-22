import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSecurity } from './scripts/check-security.mjs';
import { contentSecurityPolicy } from './scripts/security-policy.mjs';

const config = { url: 'https://project.example.test', anonKey: 'public-test-key' };
test('security probe accepts only an explicit healthy baseline and never reads records', async () => {
  assert.equal(await checkSecurity({ ...config, fetchImpl: async (url, options) => {
    assert.equal(url.href, `${config.url}/rest/v1/rpc/security_health`);
    assert.equal(options.body, '{}');
    assert.equal(options.method, 'POST');
    return Response.json(true);
  } }), true);
  for (const value of [false, null, {}, [], 'true', 1]) {
    await assert.rejects(checkSecurity({ ...config, fetchImpl: async () => Response.json(value) }), /baseline/);
  }
});
test('missing migration, network, invalid JSON and config fail closed without credentials', async () => {
  for (const status of [401, 403, 404, 500]) {
    await assert.rejects(checkSecurity({ ...config, fetchImpl: async () => new Response('', { status }) }), new RegExp(`HTTP ${status}`));
  }
  await assert.rejects(checkSecurity({ ...config, fetchImpl: async () => { throw new Error(config.anonKey); } }), e => !e.message.includes(config.anonKey));
  await assert.rejects(checkSecurity({ ...config, fetchImpl: async () => new Response('oops') }), /Invalid/);
  await assert.rejects(checkSecurity({ ...config, url: 'http://example.test', fetchImpl: () => assert.fail() }));
});
test('production CSP restricts scripts, connections, framing and form actions', () => {
  const policy = contentSecurityPolicy(config.url);
  assert.match(policy, /script-src 'self';/);
  assert.ok(!policy.includes('unsafe-eval'));
  assert.ok(!policy.includes("script-src 'self' 'unsafe-inline'"));
  assert.match(policy, /connect-src 'self' https:\/\/project.example.test wss:\/\/project.example.test;/);
  assert.match(policy, /form-action 'none'; frame-src 'none'/);
  assert.throws(() => contentSecurityPolicy('http://example.test'));
});
