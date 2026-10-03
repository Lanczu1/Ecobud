const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
vm.runInNewContext(compile(fs.readFileSync(__dirname + '/registeredBarangay.ts', 'utf8')), context);
const { getRegisteredBarangay } = context.exports;
const session = { token: 'saved-token', user: { id: 'resident', city: ' Yukos ' } };

test('saved session barangay is immediately available without a profile fetch', () => {
  assert.equal(getRegisteredBarangay(null, JSON.parse(JSON.stringify(session))), 'Yukos');
  assert.equal(getRegisteredBarangay(null, { ...session, token: 'refreshed-token' }), 'Yukos');
});
test('older session snapshots can use the nested saved barangay', () => {
  assert.equal(getRegisteredBarangay(null, { user: { id: 'resident', profile: { city: 'Abo' } } }), 'Abo');
});
test('the latest loaded profile overrides a stale saved barangay including removal', () => {
  assert.equal(getRegisteredBarangay({ id: 'resident', profile: { city: 'Abo' } }, session), 'Abo');
  assert.equal(getRegisteredBarangay({ id: 'resident', profile: { city: null } }, session), '');
  assert.equal(getRegisteredBarangay({ id: 'resident', profile: null }, session), '');
});
test('a different account cannot inherit the previous account barangay', () => {
  assert.equal(getRegisteredBarangay({ id: 'other', profile: { city: 'Abo' } }, session), 'Yukos');
  assert.equal(getRegisteredBarangay({ id: 'other', profile: { city: 'Abo' } }, null), '');
});
test('confirmed empty session city is not replaced by an older nested value', () => {
  assert.equal(getRegisteredBarangay(null, { user: { id: 'resident', city: null, profile: { city: 'Abo' } } }), '');
});

function missionAction(profile, currentSession) {
  const source = fs.readFileSync(__dirname + '/../hooks/useHomeDashboard.ts', 'utf8');
  const start = source.indexOf('  const openChallengeMission = useCallback(');
  const end = source.indexOf('  const handleCompleteLesson', start);
  const opened = [], alerts = [];
  const state = {
    profile, session: currentSession, getRegisteredBarangay, useCallback: callback => callback,
    Alert: { alert: (...args) => alerts.push(args) },
    setSelectedChallenge: challenge => opened.push(challenge.id),
    setRecentViewedMission() {}, setViewedMissionIds: update => update([]),
    setActiveOverlayState() {}, RECENT_VIEWED_KEY: 'recent', VIEWED_MISSIONS_KEY: 'viewed',
    mobileStorage: { setItem: async () => {} },
  };
  vm.createContext(state);
  vm.runInContext(compile(source.slice(start, end) + '\nopenChallengeMission({ id: "mission" });'), state);
  return { opened, alerts };
}
test('quick mission opens immediately on resume even before the profile fetch finishes', () => {
  const result = missionAction(null, session);
  assert.deepEqual(result.opened, ['mission']);
  assert.equal(result.alerts.length, 0);
});
test('the required barangay prompt remains for users with genuinely missing barangay', () => {
  const result = missionAction({ id: 'resident', profile: { city: null } }, session);
  assert.deepEqual(result.opened, []);
  assert.equal(result.alerts[0][0], 'Barangay Location Required');
});
