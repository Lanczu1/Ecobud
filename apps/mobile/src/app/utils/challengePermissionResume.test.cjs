const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../components/AppOverlays.tsx'), 'utf8');
const start = source.indexOf('  React.useEffect(() => {', source.indexOf('// Sync step & reload attempts'));
const end = source.indexOf('  React.useEffect(() => {\n    if (processing)', start);
const effects = source.slice(start, end);

function setup() {
  let dependencies = [];
  let cursor = 0;
  let loads = 0;
  const state = {
    challenge: { id: 'one', progress: { status: 'not_started' } },
    submission: undefined,
    isRejectedSubmission: false,
    model: { session: { user: { id: 'member' } } },
    activeOperationRef: { current: 0 },
    attemptsChallengeIdRef: { current: null },
    setCapturedImage() {}, setMockResult() {}, setAttemptsLoaded() {}, setBeforeProofUrl() {},
    step: 'details',
    setStep(value) { state.step = value; },
    getInitialStep: () => 'details',
    loadChallengeAttempts: () => { loads++; },
    React: { useEffect(run, next) {
      const index = cursor++;
      if (!dependencies[index] || next.some((value, i) => value !== dependencies[index][i])) run();
      dependencies[index] = next;
    } },
  };
  const context = vm.createContext(state);
  return { state, loads: () => loads, render() { cursor = 0; vm.runInContext(effects, context); } };
}

test('session refresh during camera permission preserves the pending operation and capture step', () => {
  const app = setup();
  app.render();
  const operation = ++app.state.activeOperationRef.current;
  app.state.loadChallengeAttempts = () => {};
  app.render();
  assert.equal(app.state.activeOperationRef.current, operation);
  app.state.step = 'capture';
  app.state.loadChallengeAttempts = () => {};
  app.render();
  assert.equal(app.state.step, 'capture');
});

test('attempt sync still runs when credentials refresh', () => {
  const app = setup();
  app.render();
  assert.equal(app.loads(), 1);
  let refreshedLoads = 0;
  app.state.loadChallengeAttempts = () => { refreshedLoads++; };
  app.render();
  assert.equal(refreshedLoads, 1);
});

test('changing challenge, submission status, or account still resets the mission', () => {
  for (const change of [
    state => { state.challenge.id = 'two'; },
    state => { state.submission = { id: 'proof', status: 'approved_collection' }; },
    state => { state.model.session.user.id = 'other-member'; },
  ]) {
    const app = setup();
    app.render();
    app.state.step = 'capture';
    const operation = app.state.activeOperationRef.current;
    change(app.state);
    app.render();
    assert.equal(app.state.step, 'details');
    assert.equal(app.state.activeOperationRef.current, operation + 1);
  }
});
