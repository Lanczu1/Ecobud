const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(name, mocks) {
  const source = fs.readFileSync(path.join(__dirname, name), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, setTimeout, clearTimeout, require: id => mocks[id] || require(id) });
  return module.exports;
}
function primitives(preferences) {
  const native = React.forwardRef((props, _ref) => React.createElement('span', { 'data-style': JSON.stringify(props.style), 'data-hit': JSON.stringify(props.hitSlop), 'data-animation': props.animationType, 'data-lines': props.numberOfLines }, props.children));
  native.State = {};
  const flatten = style => Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flatten)) : style || {};
  const rn = { Text: native, TextInput: native, TouchableOpacity: native, Pressable: React.forwardRef((props, ref) => React.createElement(native, { ...props, style: typeof props.style === 'function' ? props.style({ pressed: false }) : props.style, ref })), Modal: native, StyleSheet: { flatten } };
  return load('primitives.tsx', { 'react-native': rn, './AccessibilityContext': { useAccessibility: () => ({ preferences }) } });
}
const defaults = { size: 'Small', bold: false, performance: false, largeTargets: false };
test('larger tap areas default off and old settings migrate without losing other preferences', () => {
  for (const [saved, expected] of [
    [null, false],
    [JSON.stringify({ size: 'Large', contrast: true, bold: true, performance: true, largeTargets: true }), false],
    [JSON.stringify({ largeTargets: true, largeTargetsDefaultVersion: 1 }), true],
    [JSON.stringify({ largeTargets: false, largeTargetsDefaultVersion: 1 }), false],
  ]) {
    const mockReact = { ...React, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useRef: value => ({ current: value }), useEffect() {} };
    const storage = { getItemSync: () => saved };
    const { AccessibilityProvider, defaultPreferences } = load('AccessibilityContext.tsx', { react: mockReact, '../storage/mobileStorage': { mobileStorage: storage } });
    assert.equal(defaultPreferences.largeTargets, false);
    const preferences = AccessibilityProvider({ children: null }).props.value.preferences;
    assert.equal(preferences.largeTargets, expected);
    if (saved && !JSON.parse(saved).largeTargetsDefaultVersion) {
      assert.equal(preferences.size, 'Large');
      assert.equal(preferences.contrast, true);
      assert.equal(preferences.bold, true);
      assert.equal(preferences.performance, true);
    }
  }
});
function markup(Component, props) { return renderToStaticMarkup(React.createElement(Component, props)); }
test('all three sizes scale explicit text and input fonts and line heights', () => {
  for (const [size, multiplier] of [['Small', 1], ['Medium', 1.15], ['Large', 1.35]]) {
    const { Text, TextInput } = primitives({ ...defaults, size });
    for (const Component of [Text, TextInput]) {
      const html = markup(Component, { style: { fontSize: 20, lineHeight: 30 } });
      assert.ok(html.includes(`fontSize&quot;:${20 * multiplier}`), html);
      assert.ok(html.includes(`lineHeight&quot;:${30 * multiplier}`), html);
    }
  }
});
test('large text can wrap and bold text applies to inputs as well as labels', () => {
  const { Text, TextInput } = primitives({ ...defaults, size: 'Large', bold: true });
  assert.ok(!markup(Text, { numberOfLines: 1 }).includes('data-lines'));
  assert.ok(markup(TextInput, {}).includes('fontWeight&quot;:&quot;700'));
});
test('larger tap areas work for both touchable and pressable controls and can be disabled', () => {
  for (const enabled of [true, false]) {
    const components = primitives({ ...defaults, largeTargets: enabled });
    for (const name of ['TouchableOpacity', 'Pressable']) {
      assert.equal(markup(components[name], {}).includes('minHeight&quot;:48'), enabled);
    }
  }
});
test('performance mode removes native modal animation', () => {
  for (const performance of [true, false]) {
    const { Modal } = primitives({ ...defaults, performance });
    assert.ok(markup(Modal, { animationType: 'slide' }).includes(`data-animation="${performance ? 'none' : 'slide'}"`));
  }
});
test('compact photo control keeps its visual size while its touch area expands', () => {
  const { TouchableOpacity } = primitives({ ...defaults, largeTargets: true });
  const html = markup(TouchableOpacity, { preserveVisualSize: true, style: { width: 20, height: 20 }, hitSlop: { left: 20 } });
  assert.ok(html.includes('width&quot;:20'));
  assert.ok(!html.includes('minHeight'));
  assert.ok(html.includes('top&quot;:14'));
  assert.ok(html.includes('left&quot;:20'));
});
test('nested text inherits its parent font size instead of multiplying it twice', () => {
  const { Text } = primitives({ ...defaults, size: 'Large' });
  const html = markup(Text, { style: { fontSize: 20 }, children: React.createElement(Text, {}, 'Coins') });
  assert.equal((html.match(/fontSize/g) || []).length, 2);
  assert.ok(html.includes('fontSize&quot;:27'));
  assert.ok(html.includes('data-style="[null,{}]"'));
});
test('Challenges can keep normal text and input sizes while other pages use Large', () => {
  const { Text, TextInput, TextSizeMultiplierContext } = primitives({ ...defaults, size: 'Large' });
  for (const Component of [Text, TextInput]) {
    const html = markup(TextSizeMultiplierContext.Provider, { value: 1, children: React.createElement(Component, { style: { fontSize: 20 }, numberOfLines: 1 }) });
    assert.ok(!html.includes('fontSize&quot;:27'));
    assert.ok(html.includes('fontSize&quot;:20'));
  }
  assert.ok(markup(Text, { style: { fontSize: 20 } }).includes('fontSize&quot;:27'));
});
test('preferences validate stored values and persist all settings', async () => {
  let slots = [];
  let effects = [];
  let index = 0;
  let written;
  const mockReact = {
    ...React,
    useState(initial) { const id = index++; if (!(id in slots)) slots[id] = typeof initial === 'function' ? initial() : initial; return [slots[id], value => slots[id] = value]; },
    useRef(value) { const id = index++; if (!(id in slots)) slots[id] = { current: value }; return slots[id]; },
    useEffect(effect) { effects.push(effect); },
  };
  const saved = JSON.stringify({ size: 'Large', performance: true, contrast: true, bold: true, largeTargets: false });
  const storage = { getItemSync: () => saved, getItem: async () => saved, setItemSync: (_key, value) => written = value, setItem: async (_key, value) => written = value };
  const { AccessibilityProvider } = load('AccessibilityContext.tsx', { react: mockReact, '../storage/mobileStorage': { mobileStorage: storage } });
  const tree = AccessibilityProvider({ children: null });
  assert.equal(tree.props.value.preferences.size, 'Large');
  assert.equal(tree.props.value.preferences.performance, true);
  tree.props.value.update({ size: 'Small', bold: false });
  assert.deepEqual(JSON.parse(written), { size: 'Small', performance: true, contrast: true, bold: false, largeTargets: false, largeTargetsDefaultVersion: 1 });
  slots = []; index = 0; effects = [];
  storage.getItemSync = () => '{invalid';
  const fallback = AccessibilityProvider({ children: null });
  assert.equal(fallback.props.value.preferences.size, 'Medium');
  await Promise.resolve();
});
test('performance mode completes transitions, suppresses loops, and lets new loops start when disabled', async () => {
  let preferences = { performance: true };
  let listener;
  let starts = 0;
  let stops = 0;
  const composite = () => ({ start: () => starts++, stop: () => stops++, reset() {} });
  const native = { timing: composite, spring: composite, loop: composite, createAnimatedComponent: value => value, delay: ms => ({ duration: ms }) };
  const { Animated } = load('animations.ts', { 'react-native': { Animated: native }, './primitives': { Text: 'span' }, './AccessibilityContext': { getAccessibilityPreferences: () => preferences, subscribeAccessibility: fn => { listener = fn; } } });
  let target = 0;
  let completed = false;
  Animated.timing({ setValue: value => target = value }, { toValue: 1 }).start(result => completed = result.finished);
  assert.equal(target, 1);
  assert.equal(completed, false);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(completed, true);
  const loop = Animated.loop(composite());
  loop.start();
  assert.equal(starts, 0);
  preferences = { performance: false }; listener();
  loop.start();
  assert.equal(starts, 1);
  preferences = { performance: true }; listener();
  assert.equal(stops, 1);
  loop.stop();
  preferences = { performance: false }; listener();
  assert.equal(starts, 1);
  assert.equal(Animated.delay(500).duration, 500);
  preferences = { performance: true };
  assert.equal(Animated.delay(500).duration, 0);
});
test('performance transitions yield between chained callbacks and can be stopped', async () => {
  const native = { createAnimatedComponent: value => value, timing() { throw new Error('Should skip native animation'); } };
  const { Animated } = load('animations.ts', { 'react-native': { Animated: native }, './primitives': { Text: 'span' }, './AccessibilityContext': { getAccessibilityPreferences: () => ({ performance: true }), subscribeAccessibility() {} } });
  let count = 0;
  let depth = 0;
  let maxDepth = 0;
  let current;
  const value = { setValue() {} };
  await new Promise(resolve => {
    const next = () => {
      depth++;
      maxDepth = Math.max(maxDepth, depth);
      current = Animated.timing(value, { toValue: 1 });
      current.start(({ finished }) => {
        if (finished && ++count < 25) next();
        else resolve();
      });
      depth--;
    };
    next();
    assert.equal(count, 0);
  });
  assert.equal(count, 25);
  assert.equal(maxDepth, 1);
  let result;
  current = Animated.timing(value, { toValue: 1 });
  current.start(completion => result = completion.finished);
  current.stop();
  assert.equal(result, false);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(result, false);
});
test('normal mode preserves native loop iterations and stops native playback when performance mode turns on', () => {
  let performance = false;
  let listener;
  let config;
  let ended;
  let stopped = false;
  const native = {
    createAnimatedComponent: value => value,
    timing: (_value, options) => { config = options; return { start: callback => ended = callback, stop: () => { stopped = true; ended({ finished: false }); }, reset() {} }; },
    loop: () => { throw new Error('Native loops should not repeat through JavaScript'); },
  };
  const { Animated } = load('animations.ts', { 'react-native': { Animated: native }, './primitives': { Text: 'span' }, './AccessibilityContext': { getAccessibilityPreferences: () => ({ performance }), subscribeAccessibility: fn => listener = fn } });
  const value = { setValue() {} };
  Animated.loop(Animated.timing(value, { toValue: 1, useNativeDriver: true }), { iterations: 3 }).start();
  assert.equal(config.iterations, 3);
  assert.equal(config.useNativeDriver, true);
  performance = true; listener();
  assert.equal(stopped, true);
});
