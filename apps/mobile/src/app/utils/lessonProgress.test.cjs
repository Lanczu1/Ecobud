const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getVideoLessonProgress, getQuizLessonProgress } = require('./lessonProgress.ts');

test('video timestamp maps to the same percentage when restored', () => {
  const checkpoint = JSON.parse(JSON.stringify({ timestamp: 325, duration: 370 }));
  assert.equal(getVideoLessonProgress(checkpoint.timestamp, checkpoint.duration, true), 70);
  assert.equal(getVideoLessonProgress(185, 370, true), 40);
  assert.equal(getVideoLessonProgress(370, 370, true), 80);
  assert.equal(getVideoLessonProgress(369, 370, true), 79);
});

test('quiz continues from 80 and reserves 100 for confirmed completion', () => {
  assert.equal(getQuizLessonProgress(0, 2), 80);
  assert.equal(getQuizLessonProgress(1, 2), 90);
  assert.equal(getQuizLessonProgress(2, 2), 99);
  assert.equal(getVideoLessonProgress(370, 370, false), 99);
});

test('invalid duration and out-of-range times remain bounded', () => {
  assert.equal(getVideoLessonProgress(11, 0, true), 0);
  assert.equal(getVideoLessonProgress(11, NaN, true), 0);
  assert.equal(getVideoLessonProgress(-5, 100, true), 0);
  assert.equal(getVideoLessonProgress(200, 100, true), 80);
  assert.equal(getQuizLessonProgress(0, 0), 80);
});
