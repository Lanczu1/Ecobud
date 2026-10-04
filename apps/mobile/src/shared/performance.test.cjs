const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { createImagePrefetcher } = require('./ui/imagePrefetch.ts');

function hooks() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  return {
    react: {
      ...React,
      forwardRef: render => render,
      useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
        return [slots[index], value => { slots[index] = value; }];
      },
      useMemo(factory, deps) {
        const index = cursor++;
        if (!same(slots[index]?.deps, deps)) slots[index] = { deps, value: factory() };
        return slots[index].value;
      },
      useImperativeHandle(ref, factory) { ref.current = factory(); },
      useEffect(effect, deps) {
        const index = cursor++;
        if (!same(slots[index]?.deps, deps)) {
          effects.push(() => { slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; });
        }
      },
    },
    begin() { cursor = 0; effects = []; },
    flush() { effects.forEach(effect => effect()); },
  };
}

function load(file, mocks, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { ...globals, module, exports: module.exports, require: id => mocks[id] || require(id) });
  return module.exports;
}

test('Tracker level updates render current points and level without scheduling animation frames', () => {
  const runtime = hooks();
  let frames = 0;
  const { LevelCard } = load('../app/components/LevelCard.tsx', {
    react: runtime.react,
    'react-native': { View: 'View', StyleSheet: { create: styles => styles } },
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon', Ionicons: 'Icon' },
    '../../shared/accessibility/primitives': { Text: 'Text', TouchableOpacity: 'Touchable' },
    'expo-linear-gradient': { LinearGradient: 'Gradient' },
    '../../app/utils/responsive': { responsiveFontSize: x => x, moderateScale: x => x, scale: x => x, verticalScale: x => x },
    '../utils/haptics': { triggerImpactLight() {} },
  }, { requestAnimationFrame: () => { frames++; return frames; }, cancelAnimationFrame() {} });
  function textContent(node) {
    if (Array.isArray(node)) return node.flatMap(textContent);
    if (typeof node === 'string' || typeof node === 'number') return [node];
    return node?.props ? textContent(node.props.children) : [];
  }
  const render = points => { runtime.begin(); const tree = LevelCard({ ecoPoints: points, animatePoints: false }); runtime.flush(); return textContent(tree); };
  render(90);
  const texts = render(310);
  assert.ok(texts.includes(310));
  assert.ok(texts.includes('Eco Advocate'));
  assert.equal(frames, 0);
});

test('optimized floating mascot pauses during scrolling and resumes when idle', () => {
  const runtime = hooks();
  const calls = [];
  const { HomeMascotAnimation } = load('../app/components/HomeMascotAnimation.tsx', {
    react: { ...runtime.react, memo: component => component },
    'react-native': { Platform: { OS: 'android' } },
    '../../shared/accessibility/AccessibleLottie': 'Lottie',
    './HomeAnimationVisibility': { useHomeAnimationVisibility: () => ({ visible: true }) },
    '../utils/homeAnimationVisibility': require('../app/utils/homeAnimationVisibility.ts'),
    '../../../assets/Ecobud Mascot/New Lottie files/HomeWave.lottie': 'optimized-wave',
  });
  const render = animated => {
    runtime.begin();
    const tree = HomeMascotAnimation({ size: 90, animated });
    tree.props.ref.current = { play: () => calls.push('play'), pause: () => calls.push('pause'), resume: () => calls.push('resume') };
    runtime.flush();
    return tree;
  };
  const tree = render(true);
  assert.equal(tree.props.source, 'optimized-wave');
  tree.props.onAnimationLoaded();
  assert.equal(calls.at(-1), 'play');
  render(false);
  assert.equal(calls.at(-1), 'pause');
  render(true);
  assert.equal(calls.at(-1), 'resume');
});

test('Tracker calendar starts no looping or JS-driven animations and defers leaderboard entrance until selected', () => {
  const runtime = hooks();
  const ast = ts.createSourceFile('AppViews.tsx', fs.readFileSync(path.join(__dirname, '../app/components/AppViews.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'TrackerView');
  const configs = [];
  const bindings = {};
  function collect(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (ts.isIdentifier(node.tagName)) bindings[node.tagName.text] = node.tagName.text;
    }
    ts.forEachChild(node, collect);
  }
  collect(component);
  const animation = (_, config) => { configs.push(config); return { start() {}, stop() {} }; };
  const context = { ...bindings, exports: {}, React: runtime.react, ...runtime.react,
    useTheme: () => ({ theme: { colors: {} }, isDark: false }), useScreenActive: () => true,
    Animated: { Value: class { setValue() {} interpolate() { return 0; } }, View: 'AnimatedView', spring: animation, timing: animation,
      parallel: () => ({ start() {}, stop() {} }) },
    getPhMonthKey: () => '2026-10', buildCalendarCells: () => [], getDisplayStreak: () => 0,
    formatMonthLabel: x => x, moderateScale: x => x, verticalScale: x => x,
    trackerStyles: {}, styles: {}, setInterval: () => 1, clearInterval() {},
  };
  const code = ts.transpileModule(component.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  vm.runInNewContext(code, context);
  let requests = 0;
  const model = { tracker: { points: 90, completedDays: [] }, loadLeaderboard: () => { requests++; } };
  runtime.begin();
  const tree = context.exports.TrackerView({ model });
  runtime.flush();
  assert.equal(configs.length, 1);
  assert.ok(configs.every(config => config.useNativeDriver && config.isInteraction === false));
  function findLeaderboard(node) {
    if (Array.isArray(node)) return node.map(findLeaderboard).find(Boolean);
    if (!node?.props) return null;
    if (node.type === 'TouchableOpacity' && node.props.children?.props?.children?.[1]?.props?.children === 'Leaderboard') return node;
    return findLeaderboard(node.props.children);
  }
  findLeaderboard(tree).props.onPress();
  assert.equal(requests, 1);
  runtime.begin();
  context.exports.TrackerView({ model });
  runtime.flush();
  assert.equal(configs.length, 4);
  assert.ok(configs.every(config => config.useNativeDriver && config.isInteraction === false));
});

function lottie() {
  const runtime = hooks();
  const preferences = { performance: false };
  const appState = { currentState: 'active' };
  const screen = { visible: true };
  const calls = [];
  const native = {
    play: (...frames) => calls.push(['play', ...frames]),
    resume: () => calls.push(['resume']), pause: () => calls.push(['pause']), reset: () => calls.push(['reset']),
  };
  const component = load('accessibility/AccessibleLottie.tsx', {
    react: runtime.react,
    'react-native': { AppState: appState },
    'lottie-react-native': 'lottie',
    './AccessibilityContext': { useAccessibility: () => ({ preferences }), getAccessibilityPreferences: () => preferences },
    '../ui/ScreenActivity': { useScreenActive: () => screen.visible && appState.currentState === 'active' },
  }).default;
  const ref = { current: null };
  return {
    preferences, appState, screen, calls, ref,
    render(props) {
      runtime.begin();
      const tree = component(props, ref);
      tree.props.ref.current = native;
      runtime.flush();
      return tree;
    },
  };
}

test('retained hidden Lottie pauses and defers imperative playback until the tab returns', () => {
  const player = lottie();
  const props = { source: 'retained', autoPlay: true, loop: true };
  player.render(props).props.onAnimationLoaded();
  player.screen.visible = false;
  player.render(props);
  const count = player.calls.length;
  player.ref.current.play(4, 12);
  player.ref.current.resume();
  assert.equal(player.calls.length, count);
  assert.deepEqual(player.calls.at(-1), ['pause']);
  player.screen.visible = true;
  player.render(props);
  assert.deepEqual(player.calls.at(-1), ['play', 4, 12]);
});

test('Lottie loaded in background waits, resumes its position, and respects an explicit pause', () => {
  const fixture = lottie();
  const props = { source: 1, autoPlay: true, loop: true };
  fixture.appState.currentState = 'background';
  fixture.render(props).props.onAnimationLoaded();
  assert.equal(fixture.calls.some(call => call[0] === 'play'), false);
  fixture.appState.currentState = 'active'; fixture.render(props);
  fixture.appState.currentState = 'background'; fixture.render(props);
  fixture.appState.currentState = 'active'; fixture.render(props);
  assert.deepEqual(fixture.calls.filter(call => call[0] !== 'pause'), [['play'], ['resume']]);
  fixture.ref.current.pause();
  fixture.appState.currentState = 'background'; fixture.render(props);
  fixture.appState.currentState = 'active'; fixture.render(props);
  assert.equal(fixture.calls.filter(call => call[0] === 'resume').length, 1);
});

test('a deferred frame range plays when performance mode is disabled', () => {
  const fixture = lottie();
  const props = { source: 1, autoPlay: false, loop: true };
  fixture.preferences.performance = true;
  fixture.render(props).props.onAnimationLoaded();
  fixture.ref.current.play(5, 25);
  assert.equal(fixture.calls.some(call => call[0] === 'play'), false);
  fixture.preferences.performance = false; fixture.render(props);
  assert.deepEqual(fixture.calls.filter(call => call[0] === 'play'), [['play', 5, 25]]);
});

test('finished one-shot Lottie does not replay on foreground and a new source can play', () => {
  const fixture = lottie();
  const props = { source: 1, autoPlay: true, loop: false };
  const tree = fixture.render(props);
  tree.props.onAnimationLoaded(); tree.props.onAnimationFinish(false);
  fixture.appState.currentState = 'background'; fixture.render(props);
  fixture.appState.currentState = 'active'; fixture.render(props);
  assert.equal(fixture.calls.filter(call => call[0] === 'play').length, 1);
  fixture.render({ ...props, source: 2 }).props.onAnimationLoaded();
  assert.equal(fixture.calls.filter(call => call[0] === 'play').length, 2);
});

test('prefetch deduplicates URLs, limits concurrent downloads, and reuses successful results', async () => {
  const releases = [];
  const calls = [];
  const prefetch = createImagePrefetcher(url => {
    calls.push(url);
    return new Promise(resolve => releases.push(resolve));
  }, () => true);
  const first = prefetch(['a', 'a', 'b', 'c', 'd']);
  await Promise.resolve();
  assert.deepEqual(calls, ['a', 'b']);
  assert.equal(await prefetch(['other']), false);
  releases.splice(0).forEach(resolve => resolve(true));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['a', 'b', 'c', 'd']);
  releases.splice(0).forEach(resolve => resolve(true));
  assert.equal(await first, true);
  assert.equal(await prefetch(['a', 'b']), true);
  assert.equal(calls.length, 4);
});

test('failed prefetch can retry and backgrounding prevents the next pair of downloads', async () => {
  let allowed = true;
  let succeeds = false;
  const calls = [];
  const prefetch = createImagePrefetcher(async url => { calls.push(url); return succeeds; }, () => allowed);
  assert.equal(await prefetch(['a']), false);
  succeeds = true;
  assert.equal(await prefetch(['a']), true);
  assert.deepEqual(calls, ['a', 'a']);
  allowed = false;
  assert.equal(await prefetch(['b']), false);
  assert.equal(calls.length, 2);
  allowed = true;
  const background = createImagePrefetcher(async url => { calls.push(url); allowed = false; return true; }, () => allowed);
  assert.equal(await background(['c', 'd', 'e', 'f']), false);
  assert.deepEqual(calls, ['a', 'a', 'c', 'd']);
});

test('FastImage recovers for a replacement source and keeps equivalent source objects stable', () => {
  const runtime = hooks();
  const preferences = { performance: false };
  const device = { lowEnd: false };
  const { FastImage } = load('ui/FastImage.tsx', {
    react: runtime.react,
    'react-native': { View: 'view', AppState: { currentState: 'active' } },
    'expo-image': { Image: 'image' },
    '../accessibility/AccessibilityContext': { useAccessibility: () => ({ preferences }), getAccessibilityPreferences: () => preferences },
    '../../app/utils/appUtils': { resolveMediaUrl: url => url },
    '../api/ecobudApi': { ecobudApiOrigin: 'https://example.test' },
    './imagePrefetch': { createImagePrefetcher },
    '../performance/deviceTier': { isLowEndDevice: () => device.lowEnd },
  });
  const render = source => {
    runtime.begin(); const tree = FastImage({ source }); runtime.flush(); return tree;
  };
  const first = render({ uri: 'a' });
  assert.equal(render({ uri: 'a' }).props.source, first.props.source);
  first.props.onError(new Error('failed'));
  assert.equal(render({ uri: 'a' }), null);
  assert.equal(render({ uri: 'b' }).props.source.uri, 'b');
  preferences.performance = true;
  const reduced = render({ uri: 'b' });
  assert.equal(reduced.props.cachePolicy, 'disk');
  assert.equal(reduced.props.transition, 0);
  assert.equal(reduced.props.priority, 'normal');
  preferences.performance = false;
  assert.ok(render({ uri: 'b' }).props.placeholder);
  device.lowEnd = true;
  const lowEnd = render({ uri: 'b' });
  assert.equal(lowEnd.props.cachePolicy, 'memory-disk');
  assert.equal(lowEnd.props.transition, 0);
  assert.equal(lowEnd.props.placeholder, undefined);
});

test('budget Android hardware is detected from OS version and panel resolution only', () => {
  const { detectLowEndDevice } = load('performance/deviceTier.ts', {
    'react-native': {}, '../accessibility/AccessibilityContext': {},
  });
  assert.equal(detectLowEndDevice({ os: 'android', version: 28, shortSidePx: 1080 }), true);
  assert.equal(detectLowEndDevice({ os: 'android', version: 34, shortSidePx: 720 }), true);
  assert.equal(detectLowEndDevice({ os: 'android', version: 34, shortSidePx: 800 }), true);
  assert.equal(detectLowEndDevice({ os: 'android', version: 34, shortSidePx: 1080 }), false);
  assert.equal(detectLowEndDevice({ os: 'android', version: 34, shortSidePx: 0 }), false);
  assert.equal(detectLowEndDevice({ os: 'ios', version: '17.0', shortSidePx: 750 }), false);
  assert.equal(detectLowEndDevice({ os: 'web', version: 0, shortSidePx: 600 }), false);
});

test('animation consumers share one foreground listener and the last unmount removes it', () => {
  let attached = 0;
  let removed = 0;
  let changed;
  const appState = {
    currentState: 'active',
    addEventListener(_event, listener) { attached++; changed = listener; return { remove() { removed++; } }; },
  };
  const { useAppActive } = load('accessibility/useAppActive.ts', {
    react: { useSyncExternalStore: (subscribe, snapshot) => ({ subscribe, snapshot }) },
    'react-native': { AppState: appState },
  });
  const first = useAppActive();
  const second = useAppActive();
  const snapshots = [];
  const stopFirst = first.subscribe(() => snapshots.push(first.snapshot()));
  const stopSecond = second.subscribe(() => snapshots.push(second.snapshot()));
  assert.equal(attached, 1);
  appState.currentState = 'background'; changed('background');
  assert.deepEqual(snapshots, [false, false]);
  stopFirst(); assert.equal(removed, 0);
  stopSecond(); assert.equal(removed, 1);
  const stopThird = first.subscribe(() => {});
  assert.equal(attached, 2);
  stopThird(); assert.equal(removed, 2);
});

test('login video pauses in performance mode and background, and resumes when both permit playback', () => {
  const runtime = hooks();
  const preferences = { performance: false };
  let active = true;
  const calls = [];
  const player = { play: () => calls.push('play'), pause: () => calls.push('pause') };
  const { AuthBackgroundVideo } = load('../features/auth/AuthBackgroundVideo.tsx', {
    react: { ...runtime.react, memo: component => component },
    'react-native': { View: 'view', StyleSheet: { absoluteFill: {} } },
    '../../shared/accessibility/AccessibilityContext': { useAccessibility: () => ({ preferences }) },
    '../../shared/accessibility/useAppActive': { useAppActive: () => active },
    '../../shared/platform/VideoCompat': { VideoView: 'video', useVideoPlayer: (_source, setup) => { setup(player); return player; } },
    '../../../assets/mobile-bg.mp4': 1,
  });
  const render = () => { runtime.begin(); AuthBackgroundVideo(); runtime.flush(); };
  render(); assert.equal(calls.at(-1), 'play');
  preferences.performance = true; render(); assert.equal(calls.at(-1), 'pause');
  active = false; preferences.performance = false; render(); assert.equal(calls.at(-1), 'pause');
  active = true; render(); assert.equal(calls.at(-1), 'play');
  assert.equal(player.timeUpdateEventInterval, 0);
});
