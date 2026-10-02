const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SwapReadCache } = require('./swapReadCache.ts');

test('overlapping refreshes share a request, show cache, and fetch fresh data next time', async () => {
  const cache = new SwapReadCache();
  cache.setScope('account-a');
  let calls = 0;
  let resolve;
  const load = () => { calls++; return new Promise(done => { resolve = done; }); };
  const first = cache.fetch('browse:all', load);
  assert.equal(cache.fetch('browse:all', load), first);
  await Promise.resolve();
  resolve(['old']);
  await first;
  assert.equal(calls, 1);
  assert.deepEqual(cache.get('browse:all'), ['old']);
  const refresh = cache.fetch('browse:all', async () => ['new']);
  assert.deepEqual(cache.get('browse:all'), ['old']);
  await refresh;
  assert.deepEqual(cache.get('browse:all'), ['new']);
});

test('network failure preserves cached data and allows retry', async () => {
  const cache = new SwapReadCache();
  await cache.fetch('mine', async () => ['saved']);
  await assert.rejects(cache.fetch('mine', async () => { throw new Error('offline'); }), /offline/);
  assert.deepEqual(cache.get('mine'), ['saved']);
  await cache.fetch('mine', async () => []);
  assert.deepEqual(cache.get('mine'), []);
});

test('account changes clear cache and ignore old requests completing afterwards', async () => {
  const cache = new SwapReadCache();
  cache.setScope('account-a');
  await cache.fetch('chats', async () => ['private-a']);
  let resolve;
  const old = cache.fetch('chats', () => new Promise(done => { resolve = done; }));
  await Promise.resolve();
  cache.setScope('account-b');
  assert.equal(cache.get('chats'), undefined);
  await cache.fetch('chats', async () => ['private-b']);
  resolve(['late-private-a']);
  await old;
  assert.deepEqual(cache.get('chats'), ['private-b']);
});

test('filter results stay separate and the cache has a bounded size', async () => {
  const cache = new SwapReadCache();
  for (let i = 0; i < 31; i++) await cache.fetch(`filter-${i}`, async () => [i]);
  assert.equal(cache.get('filter-0'), undefined);
  assert.deepEqual(cache.get('filter-30'), [30]);
  assert.deepEqual(cache.get('filter-1'), [1]);
});
