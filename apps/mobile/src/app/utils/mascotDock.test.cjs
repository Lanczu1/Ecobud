const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveMascotDock, getMascotDockCoordinates, resolveMascotPosition, isMascotEdgeDrop } = require('./mascotDock.ts');
const { parseMascotDock } = require('./mascotDock.ts');

test('a release tap immediately after docking cannot restore the mascot to bottom right', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const source = fs.readFileSync(path.join(__dirname, '../components/CommonComponents.tsx'), 'utf8');
  const start = source.indexOf('  const handleMascotPress = useCallback(');
  const end = source.indexOf('\n\n', start);
  let cleared = 0;
  const context = vm.createContext({
    useCallback: fn => fn,
    isDragging: { current: false },
    suppressPressUntilRef: { current: Date.now() + 10000 },
    dock: { side: 'right', verticalRatio: 0.35 },
    setDock: () => { cleared++; },
    onPress() {}, onPositionChange() {},
    animatedPosition: {}, getPositionCoords: () => ({}),
    Animated: { spring: () => ({ start() {} }) },
  });
  vm.runInContext(source.slice(start, end) + '\nhandleMascotPress();', context);
  assert.equal(cleared, 0);
  context.suppressPressUntilRef.current = 0;
  vm.runInContext('handleMascotPress();', context);
  assert.equal(cleared, 1);
});

test('saved dock restores the same side and height after a shell remount', () => {
  for (const side of ['left', 'right']) {
    const dock = { side, verticalRatio: 0.35 };
    const restored = parseMascotDock(JSON.stringify(dock));
    assert.deepEqual(restored, dock);
    assert.deepEqual(getMascotDockCoordinates(restored, 400, 100, 20, 700), getMascotDockCoordinates(dock, 400, 100, 20, 700));
  }
});

test('explicit undocking stays cleared and invalid saved data is ignored', () => {
  for (const raw of ['null', 'invalid', '{"side":"middle","verticalRatio":0.3}', '{"side":"left","verticalRatio":"0.3"}']) {
    assert.equal(parseMascotDock(raw), null);
  }
});

test('ordinary drops restore all six full mascot positions', () => {
  for (const [x, side] of [[100, 'left'], [300, 'right']]) {
    for (const [y, row] of [[100, 'top'], [450, 'center'], [800, 'bottom']]) {
      assert.equal(resolveMascotPosition(x, y, 400, 900), `${row}-${side}`);
      assert.equal(isMascotEdgeDrop(x, 400, 100), false);
    }
  }
});

test('only drops close to the screen edge dock the mascot', () => {
  assert.equal(isMascotEdgeDrop(10, 400, 100), true);
  assert.equal(isMascotEdgeDrop(390, 400, 100), true);
  assert.equal(isMascotEdgeDrop(60, 400, 100), false);
  assert.equal(isMascotEdgeDrop(340, 400, 100), false);
});

test('left docking keeps the face tab inside the screen', () => {
  const dock = resolveMascotDock(10, 300, 400, 100, 20, 700);
  const coords = getMascotDockCoordinates(dock, 400, 100, 20, 700);
  assert.equal(dock.side, 'left');
  assert.equal(coords.x, 0);
  assert.equal(coords.x + 100, 100);
  assert.equal(coords.y, 250);
});
test('right docking keeps the face tab inside the screen', () => {
  const dock = resolveMascotDock(390, 300, 400, 100, 20, 700);
  assert.equal(dock.side, 'right');
  assert.equal(getMascotDockCoordinates(dock, 400, 100, 20, 700).x, 300);
});
test('a drop chooses the nearest side even from the center', () => {
  assert.equal(resolveMascotDock(199, 300, 400, 100, 20, 700).side, 'left');
  assert.equal(resolveMascotDock(201, 300, 400, 100, 20, 700).side, 'right');
});
test('docking stays within the safe vertical range', () => {
  assert.equal(resolveMascotDock(0, -100, 400, 100, 20, 700).verticalRatio, 0);
  assert.equal(resolveMascotDock(0, 2000, 400, 100, 20, 700).verticalRatio, 1);
});
test('resizing keeps the same relative dock height and visible tab', () => {
  const dock = {side: 'right', verticalRatio: 0.5};
  assert.deepEqual(getMascotDockCoordinates(dock, 800, 160, 40, 900), {x: 640, y: 470});
});
test('small screens avoid division by zero or an inverted vertical range', () => {
  const dock = resolveMascotDock(0, 300, 100, 120, 20, 10);
  assert.equal(dock.verticalRatio, 0);
  assert.equal(getMascotDockCoordinates(dock, 100, 120, 20, 10).y, 20);
});
