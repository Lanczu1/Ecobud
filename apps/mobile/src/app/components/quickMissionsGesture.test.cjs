const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function reactHarness() {
  const refs = [], states = [];
  let index = 0, effects = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useRef: initial => refs[index++] ?? (refs[index - 1] = { current: initial }),
    useState: initial => { const i = index++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = value; }]; },
    useEffect: run => { effects.push(run); }, useCallback: fn => fn, useMemo: fn => fn(),
  };
  react.default = react;
  return { react, begin() { index = 0; effects = []; }, flush() { for (const effect of effects) effect(); }, refs };
}
const value = class { constructor(v) { this.v = v; } interpolate() { return this.v; } };
const animation = () => ({ start: callback => callback?.({ finished: true }) });
const Animated = { Value: value, spring: animation, timing: animation, parallel: animation, multiply: () => 1, View: 'AnimatedView' };
const native = {
  Animated, View: 'View', StyleSheet: { create: x => x, absoluteFill: {} },
  PanResponder: { create: handlers => ({ panHandlers: handlers }) },
  BackHandler: { addEventListener: () => ({ remove() {} }) },
  useWindowDimensions: () => ({ width: 410, height: 820 }),
};
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;

function harness({ delayedMeasure = false } = {}) {
  const buttonReact = reactHarness(), overlayReact = reactHarness();
  const opened = [], selected = [];
  let taps = 0, closed = 0, overlay, measured;
  const bounds = { x: 172, y: 770, width: 66, height: 66 };
  const model = { challenges: ['left', 'center', 'right'].map(id => ({ id, active: true, imageUrl: id, expReward: 100, ecoCoinReward: 20 })), openChallengeMission: mission => selected.push(mission.id) };
  const modules = {
    react: overlayReact.react, 'react-native': native,
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 24 }) },
    '@expo/vector-icons': { Ionicons: 'Icon' }, 'react-native-svg': { default: 'Svg', Path: 'Path', Circle: 'Circle', Line: 'Line', __esModule: true },
    '../../shared/accessibility/primitives': { Text: 'Text' }, '../../shared/ui/FastImage': { FastImage: 'Image' },
    '../utils/haptics': { triggerSelectionHaptic() {}, triggerSuccessHaptic() {} },
  };
  const overlayContext = { exports: {}, require: name => modules[name] ?? 'asset' };
  vm.runInNewContext(compile(fs.readFileSync(__dirname + '/QuickMissionsOverlay.tsx', 'utf8')), overlayContext);
  const renderOverlay = gesture => {
    if (!overlay) return;
    overlayReact.begin();
    overlayContext.exports.QuickMissionsOverlay({ model, anchorBounds: bounds, gesture, onClose: () => { closed++; } });
    overlayReact.flush();
  };
  const source = fs.readFileSync(__dirname + '/CommonComponents.tsx', 'utf8');
  const ast = ts.createSourceFile('component.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const functionSource = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'TabItem').getText(ast);
  const buttonContext = {
    React: buttonReact.react, useRef: buttonReact.react.useRef, Animated,
    useTheme: () => ({ theme: { colors: { primary: 'green', primaryDark: 'green' } }, isDark: false }),
    View: 'View', TouchableOpacity: 'Touchable', Text: 'Text', Ionicons: 'Icon', TextSizeMultiplierContext: { Provider: 'Provider' }, styles: {},
  };
  vm.createContext(buttonContext);
  vm.runInContext(compile(functionSource + '\nthis.TabItem = TabItem;'), buttonContext);
  buttonReact.begin();
  const tree = buttonContext.TabItem({ item: { key: 'challenges', label: 'Challenges', icon: 'trophy-outline' }, isActive: false, isCenterAction: true,
    onPress: () => { taps++; },
    onLongPress: anchor => { opened.push(anchor); overlay = true; renderOverlay(null); },
    onQuickMissionGesture: renderOverlay,
  });
  buttonReact.refs.find(ref => ref.current === null && buttonReact.refs.indexOf(ref) > 1).current = {
    measureInWindow: callback => { if (delayedMeasure) measured = callback; else callback(bounds.x, bounds.y, bounds.width, bounds.height); },
  };
  const event = (x, y) => ({ nativeEvent: { pageX: x, pageY: y } });
  return {
    opened, selected, closed: () => closed, taps: () => taps,
    start: () => tree.props.onTouchStart(), hold: () => tree.props.children[0].props.onLongPress(),
    move: (x, y) => tree.props.onTouchMove(event(x, y)), release: (x, y) => tree.props.onTouchEnd(event(x, y)),
    tap: () => tree.props.children[0].props.onPress(), cancel: () => tree.props.onTouchCancel(),
    finishMeasurement: () => measured(bounds.x, bounds.y, bounds.width, bounds.height),
  };
}

test('one hold, drag and release opens a mission once without navigating the tab', () => {
  const h = harness(); h.start(); h.hold(); h.move(205, 607); h.release(205, 607); h.tap();
  assert.equal(h.opened.length, 1); assert.deepEqual(h.selected, ['center']); assert.equal(h.closed(), 1); assert.equal(h.taps(), 0);
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
