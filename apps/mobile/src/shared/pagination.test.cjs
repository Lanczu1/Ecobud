const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CursorFeed } = require('./ui/cursorFeed.ts');
const { mergeMessages } = require('../features/giveAndGet/messagePaging.ts');
const { affectedHomeResources, HOME_REFRESH_INTERVAL_MS } = require('../app/utils/homeRefreshPolicy.ts');

test('Home refreshes affected resources and uses a one-minute fallback', () => {
  assert.equal(HOME_REFRESH_INTERVAL_MS, 60_000);
  assert.deepEqual(affectedHomeResources('tracker', 'habit-check-in'), ['habits', 'dashboard', 'leaderboard']);
  assert.deepEqual(affectedHomeResources('events', 'event-joined'), ['events', 'dashboard', 'leaderboard']);
  assert.deepEqual(affectedHomeResources('notifications', 'lesson'), ['lessons', 'dashboard', 'leaderboard']);
  assert.deepEqual(affectedHomeResources('notifications', 'swap'), []);
});

test('feed deduplicates overlapping pages and makes one concurrent request', async () => {
  const calls = [];
  const feed = new CursorFeed(async cursor => {
    calls.push(cursor);
    return cursor ? { items: [{ id: 'b', value: 2 }, { id: 'c' }], nextCursor: null } : { items: [{ id: 'a' }, { id: 'b', value: 1 }], nextCursor: 'older' };
  });
  await feed.refresh();
  const first = feed.loadMore();
  assert.equal(feed.loadMore(), first);
  await first;
  assert.deepEqual(feed.state.items, [{ id: 'a' }, { id: 'b', value: 2 }, { id: 'c' }]);
  await feed.loadMore();
  assert.deepEqual(calls, [undefined, 'older']);
});

test('failed older page retains items and cursor and retries that same page', async () => {
  let fail = true;
  const calls = [];
  const feed = new CursorFeed(async cursor => {
    calls.push(cursor);
    if (cursor && fail) throw Error('offline');
    return { items: [{ id: cursor ? 'b' : 'a' }], nextCursor: cursor ? null : 'older' };
  });
  await feed.refresh();
  await feed.loadMore();
  assert.deepEqual(feed.state.items, [{ id: 'a' }]);
  assert.equal(feed.state.nextCursor, 'older');
  assert.ok(feed.state.error);
  fail = false;
  await feed.retry();
  assert.deepEqual(feed.state.items.map(item => item.id), ['a', 'b']);
  assert.deepEqual(calls, [undefined, 'older', 'older']);
});

test('unsubscribed feed ignores responses from the previous account or filter', async () => {
  let resolve;
  const feed = new CursorFeed(() => new Promise(done => { resolve = done; }));
  const states = [];
  const unsubscribe = feed.subscribe(state => states.push(state));
  const pending = feed.refresh();
  await Promise.resolve();
  unsubscribe();
  resolve({ items: [{ id: 'private-old-account' }], nextCursor: null });
  await pending;
  assert.equal(states.length, 2);
  assert.deepEqual(feed.state.items, []);
});

test('realtime refresh received during a request runs after that request', async () => {
  let resolve;
  let calls = 0;
  const feed = new CursorFeed(() => ++calls === 1 ? new Promise(done => { resolve = done; }) : Promise.resolve({ items: [{ id: 'new' }], nextCursor: null }));
  const pending = feed.refresh();
  await Promise.resolve();
  void feed.refresh();
  resolve({ items: [{ id: 'old' }], nextCursor: null });
  await pending;
  await new Promise(done => setImmediate(done));
  assert.equal(calls, 2);
  assert.deepEqual(feed.state.items, [{ id: 'new' }]);
});

test('chat merging retains older history and optimistic messages while updating read receipts', () => {
  const message = (id, second, read = false) => ({ id, timestamp: `2026-10-04T00:00:0${second}.000Z`, read, text: id });
  const current = [message('old', 1), message('latest', 3), message('temp_1', 5)];
  const next = mergeMessages(current, [message('latest', 3, true), message('middle', 2), message('latest', 3, true)]);
  assert.deepEqual(next.map(item => item.id), ['old', 'middle', 'latest', 'temp_1']);
  assert.equal(next[2].read, true);
  assert.equal(mergeMessages(next, []), next);
});
