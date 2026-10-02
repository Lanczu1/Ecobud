const { test } = require('node:test');
const assert = require('node:assert/strict');
const { HOME_DASHBOARD_ROWS, areHomeDashboardRowsEqual } = require('./homeDashboardRows.ts');

const base = {
  dashboard: { ecoPoints: 315 }, session: { user: { points: 315 } },
  lessons: [], challenges: [], events: [], todaysCompletedHabits: 0,
  userDisplayName: 'Member', notificationCount: 0, hasUsableInternet: true,
  setActiveOverlay() {}, setActiveTab() {}, setProgressBarLayout() {},
  openLesson() {}, openChallengeMission() {},
};
const changedRows = update => HOME_DASHBOARD_ROWS.filter(section =>
  !areHomeDashboardRowsEqual({ model: base, section }, { model: { ...base, ...update }, section }));

test('rows retain the dashboard order', () => assert.deepEqual(HOME_DASHBOARD_ROWS, [0, 1, 2, 3]));
test('chat typing and layout measurements do not rerender Home rows', () => {
  assert.deepEqual(changedRows({ assistantInput: 'hello', progressBarLayout: { x: 1, y: 2, width: 100, height: 8 } }), []);
});
test('notification updates only rerender the header', () => assert.deepEqual(changedRows({ notificationCount: 2 }), [0]));
test('points updates only rerender the progress row', () => assert.deepEqual(changedRows({ dashboard: { ecoPoints: 400 } }), [2]));
test('announcement push destinations rerender the feed even when its data is unchanged', () => {
  assert.deepEqual(changedRows({ notificationDestination: { type: 'announcement', id: 'new' } }), [3]);
});

test('lesson updates only rerender the feed', () => assert.deepEqual(changedRows({ lessons: [{ id: 'new' }] }), [3]));
test('habit completion updates actions and feed emphasis', () => assert.deepEqual(changedRows({ todaysCompletedHabits: 1 }), [1, 3]));
test('replacement navigation callbacks refresh all consumers', () => {
  assert.deepEqual(changedRows({ setActiveOverlay() {} }), [0, 1, 2, 3]);
  assert.deepEqual(changedRows({ setActiveTab() {} }), [0, 1, 3]);
  assert.deepEqual(changedRows({ openLesson() {} }), [3]);
  assert.deepEqual(changedRows({ openChallengeMission() {} }), [3]);
  assert.deepEqual(changedRows({ setProgressBarLayout() {} }), [2]);
});
test('loading completion updates every skeleton-dependent row', () => {
  const loading = { ...base, dashboard: null, initializing: true };
  const loaded = { ...loading, initializing: false };
  for (const section of [1, 2, 3]) {
    assert.equal(areHomeDashboardRowsEqual({ model: loading, section }, { model: loaded, section }), false);
  }
});
test('avatar, connectivity, and display name update the header', () => {
  for (const update of [{ profile: { profile: { avatarUrl: 'new.png' } } }, { hasUsableInternet: false }, { userDisplayName: 'New name' }]) {
    assert.deepEqual(changedRows(update), [0]);
  }
});
test('section changes and full-dashboard consumers are never skipped', () => {
  assert.equal(areHomeDashboardRowsEqual({ model: base, section: 1 }, { model: base, section: 2 }), false);
  assert.equal(areHomeDashboardRowsEqual({ model: base }, { model: { ...base } }), false);
});
