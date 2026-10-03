const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function harness() {
  let effect, cleanup, interval, pushListener, refIndex = 0;
  const refs = [], registrations = [], removals = [];
  let resolveRegistration, delay = false, fail = false;
  const api = {
    notifications: async () => ({ unreadCount: 0 }),
    registerPush: async (auth, token) => {
      registrations.push([auth, token]);
      if (fail) { fail = false; throw new Error('offline'); }
      if (delay) { delay = false; await new Promise(resolve => { resolveRegistration = resolve; }); }
    },
    unregisterPush: async (auth, token) => { removals.push([auth, token]); },
  };
  const subscription = () => ({ remove() {} });
  const notifications = {
    AndroidImportance: { HIGH: 4 }, setNotificationHandler() {},
    setNotificationChannelAsync: async () => {},
    getPermissionsAsync: async () => ({ granted: true }),
    getDevicePushTokenAsync: async () => ({ data: 'device-token' }),
    addNotificationReceivedListener: subscription,
    addNotificationResponseReceivedListener: subscription,
    addPushTokenListener: fn => { pushListener = fn; return subscription(); },
    getLastNotificationResponseAsync: async () => null,
  };
  const modules = {
    react: { useState: () => [0, () => {}], useEffect: fn => { effect = fn; }, useRef: initial => refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }) },
    'react-native': { Platform: { OS: 'android' }, AppState: { currentState: 'active', addEventListener: subscription }, DeviceEventEmitter: { addListener: subscription, emit() {} } },
    expo: { isRunningInExpoGo: () => false },
    'expo-constants': { default: { executionEnvironment: 'standalone' }, ExecutionEnvironment: { StoreClient: 'store' }, __esModule: true },
    'expo-notifications': notifications,
    '../../shared/api/ecobudApi': { ecobudApi: api },
  };
  const context = { exports: {}, require: name => modules[name], console: { warn() {} }, setInterval: fn => { interval = fn; return 1; }, clearInterval() {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(__dirname + '/useNotifications.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, context);
  return {
    registrations, removals,
    render(auth, enabled = true) { if (cleanup) cleanup(); refIndex = 0; context.exports.useNotifications(auth, enabled); cleanup = effect(); },
    flush: async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); },
    delayNext: () => { delay = true; }, resolve: () => resolveRegistration(),
    failNext: () => { fail = true; }, tick: () => interval(), rotate: token => pushListener({ data: token }),
  };
}
test('auth refresh cannot unregister the replacement session', async () => {
  const h = harness(); h.delayNext(); h.render('old-auth'); await h.flush();
  h.render('new-auth'); h.resolve(); await h.flush();
  assert.deepEqual(h.registrations, [['old-auth', 'device-token'], ['new-auth', 'device-token']]);
  assert.deepEqual(h.removals, []);
});
test('disabling push unregisters the device after effect restart', async () => {
  const h = harness(); h.render('auth'); await h.flush();
  h.render('auth', false); await h.flush();
  assert.deepEqual(h.removals, [['auth', 'device-token']]);
});
test('temporary registration failure retries while active', async () => {
  const h = harness(); h.failNext(); h.render('auth'); await h.flush();
  h.tick(); await h.flush(); assert.equal(h.registrations.length, 2);
});
test('token rotation during registration queues the new token', async () => {
  const h = harness(); h.delayNext(); h.render('auth'); await h.flush();
  h.rotate('rotated-token'); h.resolve(); await h.flush();
  assert.deepEqual(h.registrations, [['auth', 'device-token'], ['auth', 'rotated-token']]);
});
