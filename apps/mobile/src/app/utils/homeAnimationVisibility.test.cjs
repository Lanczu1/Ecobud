const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHomeAnimationVisibilityStore, createLottiePlaybackController } = require('./homeAnimationVisibility.ts');

function viewport() {
  const store = createHomeAnimationVisibilityStore();
  store.setViewport(24, 700);
  store.setScreenVisible(true);
  return store;
}

test('streak pauses fully outside either edge and stays animated when partly visible', () => {
  const store = viewport();
  assert.equal(store.isVisible(store.captureBounds(730, 36)), false);
  assert.equal(store.isVisible(store.captureBounds(710, 36)), true);
  assert.equal(store.isVisible(store.captureBounds(-12, 36)), false);
  assert.equal(store.isVisible(store.captureBounds(0, 36)), true);
});
test('scrolling pauses and resumes the flame using its measured bounds', () => {
  const store = viewport();
  const flame = store.captureBounds(620, 36);
  assert.equal(store.isVisible(flame), true);
  store.setOffset(650);
  assert.equal(store.isVisible(flame), false);
  store.setOffset(0);
  assert.equal(store.isVisible(flame), true);
});
test('bounds measured while scrolled remain correct', () => {
  const store = viewport();
  store.setOffset(500);
  const flame = store.captureBounds(620, 36);
  assert.equal(store.isVisible(flame), true);
  store.setOffset(0);
  assert.equal(store.isVisible(flame), false);
});
test('covered or background Home pauses both floating and measured animations', () => {
  const store = viewport();
  const flame = store.captureBounds(620, 36);
  store.setScreenVisible(false);
  assert.equal(store.isVisible(), false);
  assert.equal(store.isVisible(flame), false);
  store.setScreenVisible(true);
  assert.equal(store.isVisible(), true);
  assert.equal(store.isVisible(flame), true);
});
test('unmeasured flames wait rather than autoplay offscreen', () => {
  const store = viewport();
  assert.equal(store.isVisible(null), false);
  assert.equal(store.isVisible({top: 620, height: 0}), false);
});
test('scrolling does not pause the floating mascot while Home remains visible', () => {
  const store = viewport();
  store.setOffset(2000);
  assert.equal(store.isVisible(), true);
});
test('visibility subscriptions clean up and skip unchanged values', () => {
  const store = viewport();
  let updates = 0;
  const unsubscribe = store.subscribe(() => updates++);
  store.setOffset(0);
  store.setScreenVisible(true);
  assert.equal(updates, 0);
  store.setOffset(10);
  assert.equal(updates, 1);
  unsubscribe();
  store.setOffset(20);
  assert.equal(updates, 1);
});
test('Lottie loads once, pauses while hidden, and resumes without restarting', () => {
  const calls = [];
  const playback = createLottiePlaybackController(() => ({
    play: () => calls.push('play'), pause: () => calls.push('pause'), resume: () => calls.push('resume'),
  }));
  playback.setVisible(true);
  assert.deepEqual(calls, []);
  playback.onLoaded();
  playback.setVisible(true);
  playback.setVisible(false);
  playback.setVisible(false);
  playback.setVisible(true);
  assert.deepEqual(calls, ['play', 'pause', 'resume']);
});
test('an animation loaded in the background stays paused until Home is exposed', () => {
  const calls = [];
  const playback = createLottiePlaybackController(() => ({
    play: () => calls.push('play'), pause: () => calls.push('pause'), resume: () => calls.push('resume'),
  }));
  playback.onLoaded();
  assert.deepEqual(calls, []);
  playback.setVisible(true);
  assert.deepEqual(calls, ['play']);
});
