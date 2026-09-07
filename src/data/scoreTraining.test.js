import test from 'node:test';
import assert from 'node:assert/strict';
import { getTrainingRows, selectTrainingIds } from './scoreTraining.js';
const questions = ['wrong', 'uncertain', 'due', 'new1', 'new2', 'fixed', 'unknown'].map((id) => ({ id, answer: id === 'unknown' ? '' : 'A' }));
const stats = {
  wrong: { attempts: 4, wrong: 3, answerHistory: [{ isCorrect: false, confidence: 5 }] },
  uncertain: { attempts: 1, answerHistory: [{ isCorrect: true, confidence: 1 }] },
  due: { attempts: 1, nextReviewDate: '2026-09-06', lastResult: 'correct' },
  fixed: { attempts: 3, wrong: 2, answerHistory: [{ isCorrect: false }, { isCorrect: true, confidence: 5 }] },
};
test('repair prioritizes confident errors, includes uncertain correct, and excludes repaired historical errors', () => {
  assert.deepEqual(getTrainingRows(questions, stats, '2026-09-07', 'repair').map((r) => r.q.id), ['wrong', 'uncertain']);
});
test('due and unseen queues respect schedule and exclude missing answers', () => {
  assert.deepEqual(getTrainingRows(questions, stats, '2026-09-07', 'due').map((r) => r.q.id), ['due']);
  assert.deepEqual(getTrainingRows(questions, stats, '2026-09-07', 'unseen').map((r) => r.q.id), ['new1', 'new2']);
});
test('smart batches include novel transfer questions, no duplicates, and respect small pools', () => {
  const rows = getTrainingRows(questions, stats, '2026-09-07');
  const ids = selectTrainingIds(rows, 3, 'smart');
  assert.deepEqual(ids, ['wrong', 'uncertain', 'new1']);
  assert.equal(new Set(selectTrainingIds(rows, 20, 'smart')).size, rows.length);
  assert.deepEqual(selectTrainingIds([], 5, 'smart'), []);
});
test('a manual answer makes an otherwise ungraded question eligible', () => {
  assert.equal(getTrainingRows([{ id: 'x', answer: '' }], { x: { correctAnswer: 'b' } }, '2026-09-07').length, 1);
});
