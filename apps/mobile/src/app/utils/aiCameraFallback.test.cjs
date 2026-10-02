const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.createSourceFile('AppOverlays.tsx', fs.readFileSync(path.join(__dirname, '../components/AppOverlays.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function handler(name, scope) {
  let expression;
  function visit(node) {
    if (!expression && ts.isVariableDeclaration(node) && node.name.getText(source) === name) expression = node.initializer.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(expression, name);
  const code = ts.transpileModule(`module.exports = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, console: { warn() {} }, ...scope });
  return module.exports;
}
function fixture(step = 'capture') {
  const calls = [];
  const scope = {
    step, processing: false, captureBusyRef: { current: false }, activeOperationRef: { current: 0 },
    nativeCameraFallback: false, isCameraReady: true, cameraFacing: 'back',
    cameraRef: { current: { takePictureAsync: async () => ({ uri: 'embedded.jpg' }) } },
    handleNativeCamera: async () => calls.push('fallback'),
    processImage: async uri => calls.push(['before', uri]),
    processAfterImage: async uri => calls.push(['after', uri]),
    setNativeCameraFallback() {}, setIsCameraReady() {},
    Alert: { alert: () => calls.push('alert') }, Linking: { openSettings() {} },
    setTimeout: resolve => resolve(),
    ImagePicker: { requestCameraPermissionsAsync: async () => ({ granted: true }), launchCameraAsync: async () => ({ canceled: false, assets: [{ uri: 'phone.jpg' }] }), CameraType: { front: 'front', back: 'back' } },
  };
  return { scope, calls };
}
test('embedded capture preserves Before recognition and After preview routing', async () => {
  for (const [step, expected] of [['capture', 'before'], ['capture_after', 'after']]) {
    const { scope, calls } = fixture(step);
    await handler('handleCapture', scope)();
    assert.deepEqual(calls, [[expected, 'embedded.jpg']]);
  }
});
test('camera capture failure or missing readiness uses fallback once', async () => {
  for (const ready of [true, false]) {
    const { scope, calls } = fixture();
    scope.isCameraReady = ready;
    scope.cameraRef.current.takePictureAsync = async () => { throw new Error('Camera failed'); };
    await handler('handleCapture', scope)();
    assert.deepEqual(calls, ['fallback']);
  }
});
test('native fallback routes both photo stages through their existing handlers', async () => {
  for (const [step, expected] of [['capture', 'before'], ['capture_after', 'after']]) {
    const { scope, calls } = fixture(step);
    await handler('handleNativeCamera', scope)();
    assert.deepEqual(calls, [[expected, 'phone.jpg']]);
    assert.equal(scope.captureBusyRef.current, false);
  }
});
test('canceling phone camera never processes a photo or consumes an AI attempt', async () => {
  const { scope, calls } = fixture();
  scope.ImagePicker.launchCameraAsync = async () => ({ canceled: true, assets: null });
  await handler('handleNativeCamera', scope)();
  assert.deepEqual(calls, []);
});
test('leaving the challenge discards late phone-camera results', async () => {
  const { scope, calls } = fixture();
  scope.ImagePicker.launchCameraAsync = async () => { scope.activeOperationRef.current++; return { canceled: false, assets: [{ uri: 'late.jpg' }] }; };
  await handler('handleNativeCamera', scope)();
  assert.deepEqual(calls, []);
});
test('an already active capture prevents a second phone camera from opening', async () => {
  const { scope, calls } = fixture();
  scope.captureBusyRef.current = true;
  await handler('handleNativeCamera', scope)();
  assert.deepEqual(calls, []);
});
