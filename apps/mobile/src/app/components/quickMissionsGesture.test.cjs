const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { TabPressActivation } = require('../utils/tabPressActivation.ts');

function reactHarness() {
  const refs = [], states = [], memos = [], effectSlots = [];
  let index = 0, effects = [], stateUpdates = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useRef: initial => refs[index++] ?? (refs[index - 1] = { current: initial }),
    useState: initial => {
      const i = index++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], value => { const next = typeof value === 'function' ? value(states[i]) : value; if (!Object.is(states[i], next)) { states[i] = next; stateUpdates++; } }];
    },
    useEffect: (run, deps) => {
      const i = index++, previous = effectSlots[i];
      if (!same(previous?.deps, deps)) effects.push(() => {
        previous?.cleanup?.();
        effectSlots[i] = { deps, cleanup: run() };
      });
    },
    useMemo: (fn, deps) => {
      const i = index++;
      if (!same(memos[i]?.deps, deps)) memos[i] = { deps, value: fn() };
      return memos[i].value;
    },
  };
  react.useCallback = (fn, deps) => react.useMemo(() => fn, deps);
  react.default = react;
  return { react, begin() { index = 0; effects = []; }, flush() { for (const effect of effects) effect(); }, refs,
    stateUpdates: () => stateUpdates, unmount() { for (const effect of effectSlots) effect?.cleanup?.(); },
  };
}
const value = class { constructor(v) { this.v = v; } setValue(v) { this.v = v; } interpolate() { return this.v; } };
const animation = () => ({ start: callback => callback?.({ finished: true }), stop() {} });
const Animated = {
  Value: value, spring: animation, timing: animation, multiply: () => 1, View: 'AnimatedView',
  createAnimatedComponent: component => component,
  parallel: children => ({
    start(callback) {
      let remaining = children.length, finished = true;
      if (!remaining) return callback?.({ finished });
      children.forEach(child => child.start(result => {
        finished = finished && result.finished;
        if (--remaining === 0) callback?.({ finished });
      }));
    },
    stop() { children.forEach(child => child.stop()); },
  }),
};
const native = {
  Animated, Easing: { out: easing => easing, in: easing => easing, cubic: 'cubic', quad: 'quad' }, View: 'View', StyleSheet: { create: x => x, absoluteFill: {} },
  PanResponder: { create: handlers => ({ panHandlers: handlers }) },
  BackHandler: { addEventListener: () => ({ remove() {} }) },
  useWindowDimensions: () => ({ width: 410, height: 820 }),
};
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;

function harness({ delayedMeasure = false, delayedMount = false, performance = false } = {}) {
  const buttonReact = reactHarness(), overlayReact = reactHarness();
  const animationConfigs = [];
  const trackedAnimated = { ...Animated,
    timing: (value, config) => { animationConfigs.push(config); return animation(); },
    spring: (value, config) => { animationConfigs.push(config); return animation(); },
  };
  const animationContext = { exports: {}, setTimeout, clearTimeout, require: name => ({
    'react-native': { Animated: trackedAnimated },
    './AccessibilityContext': { getAccessibilityPreferences: () => ({ performance }), subscribeAccessibility() {} },
    './primitives': { Text: 'Text' },
  })[name] };
  vm.runInNewContext(compile(fs.readFileSync(__dirname + '/../../shared/accessibility/animations.ts', 'utf8')), animationContext);
  const accessibleAnimated = animationContext.exports.Animated;
  const channelContext = { exports: {} };
  vm.runInNewContext(compile(fs.readFileSync(__dirname + '/../utils/quickMissionGesture.ts', 'utf8')), channelContext);
  const gestureChannel = channelContext.exports.createQuickMissionGestureChannel();
  const opened = [], selected = [];
  let taps = 0, closed = 0, overlay, measured;
  const bounds = { x: 172, y: 770, width: 66, height: 66 };
  const model = { challenges: ['left', 'center', 'right'].map(id => ({ id, active: true, imageUrl: id, expReward: 100, ecoCoinReward: 20 })), openChallengeMission: mission => selected.push(mission.id) };
  const modules = {
    react: overlayReact.react, 'react-native': native,
    '../../shared/accessibility/animations': { Animated: accessibleAnimated },
    '../../shared/accessibility/AccessibilityContext': { useAccessibility: () => ({ preferences: { performance } }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 24 }) },
    '@expo/vector-icons': { Ionicons: 'Icon' }, 'react-native-svg': { default: 'Svg', Path: 'Path', Circle: 'Circle', Line: 'Line', __esModule: true },
    '../../shared/accessibility/primitives': { Text: 'Text' }, '../../shared/ui/FastImage': { FastImage: 'Image' },
    '../utils/haptics': { triggerSelectionHaptic() {}, triggerSuccessHaptic() {} },
  };
  const overlayContext = { exports: {}, require: name => modules[name] ?? 'asset' };
  vm.runInNewContext(compile(fs.readFileSync(__dirname + '/QuickMissionsOverlay.tsx', 'utf8')), overlayContext);
  const renderOverlay = () => {
    if (!overlay) return;
    overlayReact.begin();
    overlayContext.exports.QuickMissionsOverlay({ model, anchorBounds: bounds, gestureChannel, onClose: () => { closed++; } });
    overlayReact.flush();
  };
  const source = fs.readFileSync(__dirname + '/CommonComponents.tsx', 'utf8');
  const ast = ts.createSourceFile('component.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const functionSource = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'TabItem').getText(ast);
  const buttonContext = {
    TabPressActivation, setTimeout, clearTimeout,
    React: buttonReact.react, useRef: buttonReact.react.useRef, Animated: accessibleAnimated, Easing: native.Easing,
    useTheme: () => ({ theme: { colors: { primary: 'green', primaryDark: 'green' } }, isDark: false }),
    View: 'View', TouchableOpacity: 'Touchable', Text: 'Text', Ionicons: 'Icon', TextSizeMultiplierContext: { Provider: 'Provider' }, styles: {},
  };
  vm.createContext(buttonContext);
  vm.runInContext(compile(functionSource + '\nthis.TabItem = TabItem;'), buttonContext);
  buttonReact.begin();
  const tree = buttonContext.TabItem({ item: { key: 'challenges', label: 'Challenges', icon: 'trophy-outline' }, isActive: false, isCenterAction: true,
    onPress: () => { taps++; },
    onLongPress: anchor => { opened.push(anchor); gestureChannel.reset(); overlay = true; if (!delayedMount) renderOverlay(); },
    onQuickMissionGesture: gestureChannel.emit,
  });
  const findCircle = node => {
    if (!node?.props) return null;
    if (node.props.collapsable === false) return node;
    return node.props.children.map(findCircle).find(Boolean);
  };
  findCircle(tree).props.ref.current = {
    measureInWindow: callback => { if (delayedMeasure) measured = callback; else callback(bounds.x, bounds.y, bounds.width, bounds.height); },
  };
  const event = (x, y) => ({ nativeEvent: { pageX: x, pageY: y } });
  return {
    opened, selected, closed: () => closed, taps: () => taps, animationConfigs, gestureChannel,
    stateUpdates: overlayReact.stateUpdates, renderOverlay, unmount: overlayReact.unmount,
    pressIn: () => tree.props.children[0].props.onPressIn(), pressOut: () => tree.props.children[0].props.onPressOut(),
    start: () => { tree.props.onTouchStart(); tree.props.children[0].props.onPressIn(); }, hold: () => tree.props.children[0].props.onLongPress(),
    move: (x, y) => tree.props.onTouchMove(event(x, y)), release: (x, y) => tree.props.onTouchEnd(event(x, y)),
    tap: () => tree.props.children[0].props.onPress(), cancel: () => tree.props.onTouchCancel(),
    finishMeasurement: () => measured(bounds.x, bounds.y, bounds.width, bounds.height),
  };
}

test('Challenges opens on touch-down and hold, drag and release selects a mission without navigating twice', () => {
  const h = harness(); h.start(); h.hold(); h.move(205, 607); h.release(205, 607); h.tap();
  assert.equal(h.opened.length, 1); assert.deepEqual(h.selected, ['center']); assert.equal(h.closed(), 1); assert.equal(h.taps(), 1);
});
test('release back on the trophy dismisses without selecting', () => {
  const h = harness(); h.start(); h.hold(); h.move(205, 607); h.release(205, 803);
  assert.deepEqual(h.selected, []); assert.equal(h.closed(), 1);
});
test('cancelled touch dismisses without selecting', () => {
  const h = harness(); h.start(); h.hold(); h.move(205, 607); h.cancel();
  assert.deepEqual(h.selected, []); assert.equal(h.closed(), 1);
});
test('quick tap keeps ordinary Challenges navigation', () => {
  const h = harness(); h.start(); h.release(205, 803); h.tap();
  assert.equal(h.taps(), 1); assert.equal(h.opened.length, 0);
});
test('release before native measurement completes cannot leave a stuck menu', () => {
  const h = harness({ delayedMeasure: true }); h.start(); h.hold(); h.release(205, 803); h.finishMeasurement();
  assert.equal(h.opened.length, 0);
});

test('releases received before the menu mounts are replayed exactly once', () => {
  const h = harness({ delayedMount: true }); h.start(); h.hold(); h.release(205, 607); h.renderOverlay();
  assert.deepEqual(h.selected, ['center']); assert.equal(h.closed(), 1);
  h.cancel(); h.release(205, 607);
  assert.equal(h.selected.length, 1);
});
test('repeated drag samples in the same mission do not schedule additional renders', () => {
  const h = harness(); h.start(); h.hold();
  const before = h.stateUpdates();
  for (let i = 0; i < 1000; i++) h.move(205, 607);
  assert.equal(h.stateUpdates() - before, 1);
  h.renderOverlay();
  const animated = h.animationConfigs.length;
  for (let i = 0; i < 1000; i++) h.move(205, 607);
  assert.equal(h.animationConfigs.length, animated);
  h.release(205, 607);
  assert.deepEqual(h.selected, ['center']);
});
test('menu animations use native transforms and never hold an interaction lock', () => {
  const h = harness(); h.start(); h.hold(); h.pressIn(); h.pressOut(); h.move(205, 607); h.renderOverlay(); h.release(205, 607);
  assert.ok(h.animationConfigs.length > 0);
  for (const config of h.animationConfigs) {
    assert.equal(config.useNativeDriver, true);
    assert.equal(config.isInteraction, false);
  }
});
test('unmount removes the gesture listener so late releases cannot open a mission', () => {
  const h = harness(); h.start(); h.hold(); h.unmount(); h.release(205, 607);
  assert.deepEqual(h.selected, []); assert.equal(h.closed(), 0);
});

test('Performance Mode keeps hold-and-release selection working without native animation', async () => {
  const h = harness({ performance: true }); h.start(); h.pressIn(); h.hold(); h.move(205, 607); h.renderOverlay(); h.pressOut(); h.release(205, 607);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(h.selected, ['center']); assert.equal(h.closed(), 1);
  assert.equal(h.animationConfigs.length, 0);
  h.unmount();
});
test('cancellation before mounting is replayed and cannot turn into selection', () => {
  const h = harness({ delayedMount: true }); h.start(); h.hold(); h.cancel(); h.release(205, 607); h.renderOverlay();
  assert.deepEqual(h.selected, []); assert.equal(h.closed(), 1);
});
test('a new hold clears the previous release before a subscriber attaches', () => {
  const { gestureChannel } = harness();
  gestureChannel.emit({ phase: 'release', x: 205, y: 607 });
  gestureChannel.reset();
  const events = [];
  const unsubscribe = gestureChannel.subscribe(event => events.push(event.phase));
  assert.deepEqual(events, []);
  gestureChannel.emit({ phase: 'move', x: 205, y: 607 });
  gestureChannel.emit({ phase: 'cancel', x: 0, y: 0 });
  gestureChannel.emit({ phase: 'release', x: 205, y: 607 });
  assert.deepEqual(events, ['move', 'cancel']);
  unsubscribe();
});
