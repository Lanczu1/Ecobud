const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
vm.runInNewContext(compile(fs.readFileSync(__dirname + '/profileSnapshot.ts', 'utf8')), context);
const { decodeProfileSnapshot, profileSnapshotKey } = context.exports;
const profile = { id: 'resident', email: 'resident@example.test', profile: { displayName: 'Resident', city: 'Yukos' }, badges: [], eventHistory: [], recentLogs: [], progress: { lessonsCompleted: 1, activeChallenges: 2 } };
const hook = fs.readFileSync(__dirname + '/../hooks/useHomeDashboard.ts', 'utf8');

test('profile cache is scoped to its account and corrupt or incomplete data is rejected', () => {
  const raw = JSON.stringify(profile);
  assert.equal(decodeProfileSnapshot(raw, 'resident').profile.city, 'Yukos');
  assert.equal(decodeProfileSnapshot(raw, 'other'), null);
  for (const raw of [null, '{broken', '{}', JSON.stringify({ id: 'resident' })]) assert.equal(decodeProfileSnapshot(raw, 'resident'), null);
  assert.notEqual(profileSnapshotKey('resident'), profileSnapshotKey('other'));
});

test('cached profile appears synchronously and a late disk read cannot replace freshly fetched data', async () => {
  const anchor = hook.indexOf('    const userId = session?.user.id;', hook.indexOf('const [profile, setProfile]'));
  const start = hook.lastIndexOf('  useEffect(() => {', anchor);
  const end = hook.indexOf('  useEffect(() => {', anchor);
  let visible = null, resolve;
  const state = {
    session: { user: { id: 'resident' } }, decodeProfileSnapshot, profileSnapshotKey,
    useEffect: run => run(),
    setProfile: update => { visible = update(visible); },
    mobileStorage: { getItemSync: () => JSON.stringify(profile), getItem: () => new Promise(done => { resolve = done; }) },
  };
  vm.runInNewContext(compile(hook.slice(start, end)), state);
  assert.equal(visible.profile.city, 'Yukos');
  visible = { ...profile, profile: { ...profile.profile, city: 'Abo' } };
  resolve(JSON.stringify(profile)); await Promise.resolve(); await Promise.resolve();
  assert.equal(visible.profile.city, 'Abo');
});

function prefetch(fetchProfile, initialProfile = null) {
  const anchor = hook.indexOf('    void refresh(true);');
  const start = hook.lastIndexOf('  useEffect(() => {', anchor);
  const end = hook.indexOf('  useEffect(() => {', anchor);
  const session = { token: 'token', user: { id: 'resident', city: 'Yukos', displayName: 'Resident' } };
  let visible = initialProfile, cleanup, calls = 0, saved;
  const state = {
    session, presence: { hasUsableInternet: true }, isHydrating: true,
    AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
    currentSessionTokenRef: { current: 'token' }, latestSessionRef: { current: session },
    lastSecondaryRefreshAtRef: { current: { profile: 0 } }, SECONDARY_REFRESH_INTERVAL_MS: 60000,
    homeService: { getProfile: token => { calls++; return fetchProfile(token); } },
    setProfile: value => { visible = value; }, setSession: value => { saved = value; }, persistSession: async value => { saved = value; },
    useEffect: run => { cleanup = run(); }, setInterval: () => 1, clearInterval() {}, console: { warn() {} },
  };
  vm.runInNewContext(compile(hook.slice(start, end)), state);
  return { state, calls: () => calls, visible: () => visible, saved: () => saved, dispose: () => cleanup(), flush: async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); } };
}

test('profile request starts immediately while Home is still loading', async () => {
  const h = prefetch(async () => profile);
  assert.equal(h.calls(), 1);
  await h.flush(); assert.equal(h.visible(), profile);
});
test('failed background request preserves the cached profile', async () => {
  const h = prefetch(async () => { throw new Error('offline'); }, profile);
  await h.flush(); assert.equal(h.visible(), profile);
});
test('a response from a replaced session cannot overwrite the new account profile', async () => {
  let resolve;
  const h = prefetch(() => new Promise(done => { resolve = done; }));
  h.dispose(); h.state.currentSessionTokenRef.current = 'new-token'; resolve(profile);
  await h.flush(); assert.equal(h.visible(), null); assert.equal(h.saved(), undefined);
});
test('barangay refresh preserves newer session fields', async () => {
  let resolve;
  const h = prefetch(() => new Promise(done => { resolve = done; }));
  h.state.latestSessionRef.current = { ...h.state.session, user: { ...h.state.session.user, displayName: 'Updated' } };
  resolve({ ...profile, profile: { ...profile.profile, city: 'Abo' } });
  await h.flush(); assert.equal(h.saved().user.city, 'Abo'); assert.equal(h.saved().user.displayName, 'Updated');
});

test('concurrent profile requests share the network call and failures can retry', async () => {
  const exports = {}; let calls = 0, resolve;
  vm.runInNewContext(compile(fs.readFileSync(__dirname + '/../services/homeService.ts', 'utf8')), {
    exports, require: () => ({ ecobudApi: { fetchProfile: () => { calls++; return calls === 1 ? new Promise(done => { resolve = done; }) : Promise.reject(new Error('offline')); } } }),
  });
  const service = exports.homeService;
  const first = service.getProfile('token'); assert.equal(service.getProfile('token'), first); assert.equal(calls, 1);
  resolve(profile); assert.equal(await first, profile);
  await assert.rejects(service.getProfile('token'), /offline/);
  await assert.rejects(service.getProfile('token'), /offline/); assert.equal(calls, 3);
});
