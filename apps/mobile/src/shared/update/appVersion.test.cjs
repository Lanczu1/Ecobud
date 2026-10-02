const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    require(id) {
      if (!(id in mocks)) throw new Error(`Unexpected dependency: ${id}`);
      return mocks[id];
    },
    ...globals,
  }, { filename: file });
  return module.exports;
}

const release = { latestVersion: '1.0.8', minimumVersion: '1.0.8', updateUrl: 'https://example.test/update.apk' };
const settle = () => new Promise(resolve => setImmediate(resolve));

function setup() {
  let appListener;
  let netListener;
  let tick;
  let calls = 0;
  let refreshes = 0;
  let stateIndex = 0;
  let result = null;
  const pending = [];
  const states = [null, true];
  const removed = [];
  const cleanups = [];
  const react = {
    useState(initial) {
      const index = stateIndex++;
      return [initial, value => { states[index] = value; }];
    },
    useEffect(effect) { cleanups.push(effect()); },
    createElement: () => ({}),
  };
  const gate = load('UpdateRequiredGate.tsx', {
    react,
    'react-native': {
      AppState: { currentState: 'active', addEventListener(_event, listener) {
        appListener = listener;
        return { remove: () => removed.push('app') };
      } },
      BackHandler: {}, Linking: {}, View: {}, StyleSheet: { create: styles => styles },
    },
    '@react-native-community/netinfo': {
      addEventListener(listener) { netListener = listener; return () => removed.push('net'); },
      refresh() { refreshes++; return Promise.resolve(); },
    },
    '../accessibility/primitives': {},
    'expo-status-bar': {},
    '../theme/ecoTheme': { useTheme: () => ({ theme: { colors: {} }, isDark: false }) },
    './appVersion': {
      getInstalledAppVersion: () => '1.0.7',
      checkAppVersion() {
        calls++;
        return new Promise(resolve => pending.push(() => resolve(result)));
      },
    },
  }, {
    setInterval(callback, delay) { assert.equal(delay, 300000); tick = callback; return 42; },
    clearInterval(id) { assert.equal(id, 42); removed.push('timer'); },
  });
  gate.UpdateRequiredGate({ children: {} });
  return {
    states, removed,
    calls: () => calls,
    refreshes: () => refreshes,
    app: state => appListener(state),
    network: (connected, reachable = connected) => netListener({ isConnected: connected, isInternetReachable: reachable }),
    tick: () => tick(),
    async resolve(...values) { result = values.length ? values[0] : null; assert.ok(pending.length); pending.shift()(); await settle(); },
    cleanup: () => cleanups.forEach(cleanup => cleanup?.()),
  };
}

test('checks on startup and detects a mandatory release after foreground resume', async () => {
  const app = setup();
  assert.equal(app.calls(), 1);
  await app.resolve();
  assert.equal(app.states[1], false);
  app.app('background');
  assert.equal(app.calls(), 1);
  app.app('active');
  assert.equal(app.calls(), 2);
  assert.equal(app.refreshes(), 1);
  await app.resolve(release);
  assert.equal(app.states[0], release);
});

test('polls every five minutes only while active and online', async () => {
  const app = setup();
  await app.resolve();
  app.network(true);
  app.tick();
  assert.equal(app.calls(), 2);
  await app.resolve();
  app.app('background');
  app.tick();
  app.network(false);
  app.network(true);
  assert.equal(app.calls(), 2);
  app.app('active');
  await app.resolve();
  app.network(false);
  app.tick();
  assert.equal(app.calls(), 3);
});

test('retries on internet recovery without duplicate checks for unchanged connectivity', async () => {
  const app = setup();
  await app.resolve(undefined);
  app.network(false);
  app.network(true, false);
  assert.equal(app.calls(), 1);
  app.network(true, true);
  assert.equal(app.calls(), 2);
  app.network(true, true);
  assert.equal(app.calls(), 2);
  await app.resolve(release);
  assert.equal(app.states[0], release);
});

test('coalesces resume and reconnect events during an in-flight check into one follow-up', async () => {
  const app = setup();
  app.app('inactive');
  app.app('active');
  app.network(false);
  app.network(true);
  app.tick();
  assert.equal(app.calls(), 1);
  await app.resolve();
  assert.equal(app.calls(), 2);
  await app.resolve(release);
  assert.equal(app.calls(), 2);
});

test('does not run the queued follow-up while backgrounded', async () => {
  const app = setup();
  app.tick();
  app.app('background');
  await app.resolve();
  assert.equal(app.calls(), 1);
  app.app('active');
  assert.equal(app.calls(), 2);
  await app.resolve();
});

test('failed and invalid checks preserve the confirmed update requirement', async () => {
  const app = setup();
  await app.resolve(release);
  app.tick();
  await app.resolve(undefined);
  assert.equal(app.states[0], release);
  assert.equal(app.states[1], false);
  app.tick();
  await app.resolve(null);
  assert.equal(app.states[0], null);
});

test('unmount removes subscriptions and timer and ignores late requests', async () => {
  const app = setup();
  app.tick();
  app.cleanup();
  assert.deepEqual(app.removed, ['app', 'net', 'timer']);
  await app.resolve(release);
  assert.deepEqual(app.states, [null, true]);
  assert.equal(app.calls(), 1);
});

function versionCheck(fetchAppVersion, installed = '1.0.7') {
  return load('appVersion.ts', {
    'expo-constants': { expoConfig: { version: installed } },
    '../api/ecobudApi': { ecobudApi: { fetchAppVersion } },
    './versionComparison': load('versionComparison.ts', {}),
  });
}

test('minimum version determines mandatory updates, latest alone remains optional', async () => {
  assert.equal(await versionCheck(async () => release).checkAppVersion(), release);
  assert.equal(await versionCheck(async () => ({ ...release, minimumVersion: '1.0.7' })).checkAppVersion(), null);
});

test('API failure is unknown rather than a supported version', async () => {
  const check = versionCheck(async () => { throw new Error('timeout'); });
  assert.equal(await check.checkAppVersion(), undefined);
  assert.equal(await check.checkForMandatoryUpdate(), null);
});

test('malformed server responses cannot clear a confirmed requirement', async () => {
  for (const response of [null, {}, { ...release, minimumVersion: 'invalid' }, { ...release, latestVersion: 'invalid' }, { ...release, updateUrl: '' }]) {
    assert.equal(await versionCheck(async () => response).checkAppVersion(), undefined);
  }
});

test('unknown installed version does not call the API', async () => {
  let calls = 0;
  const check = versionCheck(async () => { calls++; return release; }, 'invalid');
  assert.equal(await check.checkAppVersion(), undefined);
  assert.equal(calls, 0);
});
