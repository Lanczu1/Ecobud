const { test } = require('node:test');
const assert = require('node:assert/strict');
const { takeUnseenBadges } = require('./badgeUnlockQueue.ts');

test('claim and rewards refresh enqueue the same badge only once in either order', () => {
  for (const firstSource of ['claim', 'refresh']) {
    const seen = new Set();
    const first = { id: 'badge', source: firstSource };
    assert.deepEqual(takeUnseenBadges([first], seen), [first]);
    assert.deepEqual(takeUnseenBadges([{ id: 'badge', source: 'other' }], seen), []);
  }
});

test('a displayed and dismissed badge cannot be automatically queued again', () => {
  const seen = new Set();
  takeUnseenBadges([{ id: 'badge' }], seen);
  assert.deepEqual(takeUnseenBadges([{ id: 'badge' }], seen), []);
});

test('distinct badges keep their order and duplicate entries are removed', () => {
  assert.deepEqual(takeUnseenBadges([{ id: 'one' }, { id: 'one' }, { id: 'two' }], new Set()), [{ id: 'one' }, { id: 'two' }]);
});

test('clearing the account state allows another account to celebrate the same badge', () => {
  const seen = new Set();
  takeUnseenBadges([{ id: 'badge' }], seen);
  seen.clear();
  assert.deepEqual(takeUnseenBadges([{ id: 'badge' }], seen), [{ id: 'badge' }]);
});
