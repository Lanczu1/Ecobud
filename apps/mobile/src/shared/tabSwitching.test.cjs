const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { retainTabs, warmTab, nextWarmTab } = require('../app/utils/retainedTabs.ts');
const { TabPressActivation } = require('../app/utils/tabPressActivation.ts');

function load(file, mocks, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { ...globals, module, exports: module.exports, require: id => {
    if (id in mocks) return mocks[id];
    throw Error('Missing mock: ' + id);
  } });
  return module.exports;
}

test('returning to a retained tab keeps its key and evicts the least recent page at the limit', () => {
  let tabs = ['home'];
  tabs = retainTabs(tabs, 'learn', 3);
  tabs = retainTabs(tabs, 'challenges', 3);
  assert.deepEqual(tabs, ['home', 'learn', 'challenges']);
  tabs = retainTabs(tabs, 'home', 3);
  assert.deepEqual(tabs, ['learn', 'challenges', 'home']);
  assert.equal(retainTabs(tabs, 'home', 3), tabs);
  assert.deepEqual(retainTabs(tabs, 'profile', 3), ['challenges', 'home', 'profile']);
});

test('performance mode caps mounted pages at two and transient chat/profile pages are released', () => {
  let tabs = ['home'];
  for (const tab of ['learn', 'challenges', 'marketplace', 'home', 'profile', 'tracker', 'learn']) {
    tabs = retainTabs(tabs, tab, 2);
    assert.ok(tabs.length <= 2);
    assert.equal(tabs.at(-1), tab);
    assert.ok(tabs.slice(0, -1).every(value => ['home', 'learn', 'challenges'].includes(value)));
  }
  assert.deepEqual(retainTabs(['home', 'learn', 'challenges'], 'challenges', 2), ['learn', 'challenges']);
});

test('warming prepares pages without changing the selected tab or exceeding the memory budget', () => {
  let tabs = ['home'];
  tabs = warmTab(tabs, 'home', nextWarmTab(tabs, 3), 3);
  assert.deepEqual(tabs, ['learn', 'home']);
  tabs = warmTab(tabs, 'home', nextWarmTab(tabs, 3), 3);
  assert.deepEqual(tabs, ['learn', 'challenges', 'home']);
  assert.equal(nextWarmTab(tabs, 3), undefined);
  assert.equal(warmTab(tabs, 'home', 'learn', 3), tabs);
  assert.deepEqual(warmTab(['learn', 'home'], 'home', 'challenges', 2), ['challenges', 'home']);
  assert.deepEqual(warmTab(['home'], 'home', 'learn', 1), ['home']);
  assert.deepEqual(warmTab(['home'], 'home', 'marketplace', 3), ['home']);
});

test('touch-down switches immediately and release does not navigate twice', () => {
  const press = new TabPressActivation();
  let navigations = 0;
  press.begin(() => navigations++);
  assert.equal(navigations, 1);
  press.commit(() => navigations++, false);
  assert.equal(navigations, 1);
  press.begin(() => navigations++);
  press.commit(() => navigations++, true);
  assert.equal(navigations, 2);
});

test('accessibility activation works without touch-down and after a cancelled gesture', () => {
  const press = new TabPressActivation();
  let navigations = 0;
  press.commit(() => navigations++, false);
  assert.equal(navigations, 1);
  press.begin(() => navigations++);
  press.cancel();
  press.commit(() => navigations++, false);
  assert.equal(navigations, 3);
});

test('idle warming waits for hydration, respects background/overlay state and stops after memory pressure', () => {
  let tabs;
  let warning;
  let idle;
  let cleanup;
  const allowed = { current: true };
  const appState = { currentState: 'active', addEventListener: (_, callback) => {
    warning = callback; return { remove() {} };
  } };
  const react = { ...React,
    useRef: () => allowed,
    useState: initial => { tabs ??= initial; return [tabs, value => { tabs = typeof value === 'function' ? value(tabs) : value; }]; },
    useEffect: effect => { const result = effect(); if (result) cleanup = result; },
  };
  const { RetainedTabHost } = load('../app/components/RetainedTabHost.tsx', {
    react, 'react-native': { View: 'View', AppState: appState },
    '../utils/retainedTabs': { retainTabs, warmTab, nextWarmTab },
    '../../shared/ui/ScreenActivity': { ScreenActivityContext: { Provider: 'activity' } },
  }, { requestIdleCallback: callback => { idle = callback; return 1; }, cancelIdleCallback: () => { idle = null; } });
  const props = { model: { activeTab: 'home', isHydrating: true }, limit: 3, exposed: true, render: () => null };
  RetainedTabHost(props);
  assert.equal(idle, undefined);
  props.model.isHydrating = false;
  props.exposed = false;
  RetainedTabHost(props);
  assert.equal(idle, undefined);
  props.exposed = true;
  appState.currentState = 'background';
  RetainedTabHost(props);
  assert.equal(idle, undefined);
  appState.currentState = 'active';
  RetainedTabHost(props);
  assert.deepEqual(Array.from(tabs), ['home']);
  idle();
  assert.deepEqual(tabs, ['learn', 'home']);
  RetainedTabHost(props);
  const pending = idle;
  cleanup();
  pending();
  assert.deepEqual(tabs, ['learn', 'home']);
  RetainedTabHost(props);
  const pressurePending = idle;
  warning();
  pressurePending();
  assert.deepEqual(Array.from(tabs), ['home']);
  idle = null;
  RetainedTabHost(props);
  assert.equal(idle, null);
});

test('hidden pages ignore model updates, leave the accessibility tree and update on activation', () => {
  const { RetainedTabPage } = load('../app/components/RetainedTabHost.tsx', {
    react: React, 'react-native': { View: 'View', StyleSheet: { absoluteFill: { position: 'absolute', inset: 0 } } },
    '../utils/retainedTabs': { retainTabs, warmTab, nextWarmTab },
    '../../shared/ui/ScreenActivity': { ScreenActivityContext: { Provider: 'activity' } },
  });
  const previous = { tab: 'learn', visible: false, exposed: true, model: { lessons: [] }, render: () => 'content' };
  assert.equal(RetainedTabPage.compare(previous, { ...previous, model: { lessons: ['new'] } }), true);
  assert.equal(RetainedTabPage.compare(previous, { ...previous, visible: true }), false);
  const hidden = RetainedTabPage.type(previous);
  assert.equal(hidden.props.style[0].position, 'absolute');
  assert.equal(hidden.props.style[1].opacity, 0);
  assert.equal(hidden.props.pointerEvents, 'none');
  assert.equal(hidden.props.importantForAccessibility, 'no-hide-descendants');
  assert.equal(hidden.props.children.props.value, false);
  const active = RetainedTabPage.type({ ...previous, visible: true });
  assert.equal(active.props.style[1].opacity, 1);
  assert.equal(active.props.children.props.value, true);
  assert.equal(active.props.pointerEvents, 'auto');
});

test('a memory warning releases retained inactive pages', () => {
  let tabs;
  let warning;
  const react = { ...React,
    useState: initial => { tabs ??= initial; return [tabs, value => { tabs = typeof value === 'function' ? value(tabs) : value; }]; },
    useRef: value => ({ current: value }),
    useEffect: effect => effect(),
  };
  const { RetainedTabHost } = load('../app/components/RetainedTabHost.tsx', {
    react, 'react-native': { View: 'View', AppState: { addEventListener: (name, callback) => { assert.equal(name, 'memoryWarning'); warning = callback; return { remove() {} }; } } },
    '../utils/retainedTabs': { retainTabs, warmTab, nextWarmTab },
    '../../shared/ui/ScreenActivity': { ScreenActivityContext: { Provider: 'activity' } },
  });
  for (const activeTab of ['home', 'learn', 'challenges']) RetainedTabHost({ model: { activeTab, isHydrating: true }, limit: 3, exposed: true, render: () => null });
  assert.equal(tabs.length, 3);
  warning();
  assert.deepEqual(tabs, ['challenges']);
});

test('skeleton animation stops while hidden and resumes on activation', () => {
  let active = true;
  let effectSlot;
  let starts = 0;
  let stops = 0;
  const react = { ...React, useRef: value => ({ current: value }), useEffect: (effect, deps) => {
    effectSlot?.cleanup?.(); effectSlot = { cleanup: effect() };
  } };
  const animated = {
    Value: class {}, View: 'AnimatedView', sequence: value => value, timing: () => ({}),
    loop: () => ({ start: () => starts++, stop: () => stops++ }),
  };
  const { SkeletonBox } = load('ui/SkeletonLoaders.tsx', {
    react, 'react-native': { View: 'View', StyleSheet: { create: styles => styles }, Easing: { inOut: value => value, sin: () => {} } },
    '../accessibility/animations': { Animated: animated }, './ScreenActivity': { useScreenActive: () => active },
    '../../app/utils/responsive': { moderateScale: x => x, responsiveFontSize: x => x, scale: x => x, verticalScale: x => x },
    '../theme/ecoTheme': { useTheme: () => ({ theme: { colors: { surfaceMuted: '#eee' } }, isDark: false }) },
  });
  SkeletonBox({});
  assert.equal(starts, 1);
  active = false;
  SkeletonBox({});
  assert.equal(stops, 1);
  assert.equal(starts, 1);
  active = true;
  SkeletonBox({});
  assert.equal(starts, 2);
});
