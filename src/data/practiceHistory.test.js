import test from 'node:test';
import assert from 'node:assert/strict';
import { preservePracticeHistory, restoreHistoryFromAnswers, getPracticeHistory } from './practiceHistory.js';
const old = { attemptId: 'old', createdAt: '2026-09-07T01:00:00Z', submittedAt: '2026-09-07T01:10:00Z', questionIds: ['a'], practiceDrafts: { a: { selected: 'B' } }, gradingResults: [{ questionId: 'a', selected: 'B', isCorrect: false }] };
const fresh = { attemptId: 'new', createdAt: '2026-09-08T01:00:00Z', questionIds: ['b'], practiceDrafts: {} };
test('new paper preserves previous question IDs, answers and results', () => {
  const state = preservePracticeHistory({ sessions: { 'score-training': old } }, { sessions: { 'score-training': fresh } });
  assert.equal(state.sessions['score-training'].attemptId, 'new');
  assert.deepEqual(state.sessions['history:old'].practiceDrafts, old.practiceDrafts);
  assert.deepEqual(getPracticeHistory(state.sessions).map((row) => row.attemptId), ['new', 'old']);
  assert.equal(getPracticeHistory(preservePracticeHistory(state, state).sessions).length, 2);
});
test('editing archived paper does not switch active paper and same-attempt edits reach active alias', () => {
  const state = preservePracticeHistory({ sessions: { 'score-training': old } }, { sessions: { 'score-training': fresh } });
  const edited = { ...state.sessions['history:old'], updatedAt: '2026-09-09', reviewPage: 3, reviewedQuestions: { a: { completed: true } } };
  const next = preservePracticeHistory(state, { ...state, sessions: { ...state.sessions, 'history:old': edited } });
  assert.equal(next.sessions['score-training'].attemptId, 'new');
  assert.equal(next.sessions['history:old'].reviewPage, 3);
  const same = preservePracticeHistory({}, { sessions: { '2026-09-07': old, 'history:old': edited } });
  assert.equal(same.sessions['2026-09-07'].reviewPage, 3);
});
test('migration restores available papers from answer history without inventing missing questions', () => {
  const state = { stats: { a: { answerHistory: [{ attemptId: 'lost', selected: 'C', isCorrect: true, date: '2026-09-07', mode: 'daily' }] }, b: { answerHistory: [{ selected: 'A' }] } }, sessions: {} };
  const sessions = restoreHistoryFromAnswers(state);
  assert.deepEqual(sessions['history:lost'].questionIds, ['a']);
  assert.equal(sessions['history:lost'].recoveredFromAnswers, true);
  assert.equal(Object.keys(sessions).length, 1);
});
test('mock exams are retained in the shared archive beyond the recent-exams list', () => {
  const mock = { id: 'mock1', startedAt: '2026-09-07', scoredAt: '2026-09-08', results: old.gradingResults };
  const state = preservePracticeHistory({ mockExams: [mock] }, { mockExams: [], sessions: {} });
  assert.equal(state.sessions['history:mock1'].practiceSource, 'mock');
  assert.deepEqual(state.sessions['history:mock1'].questionIds, ['a']);
});

test('repeated mock synchronization retains archived review progress and corrections', () => {
  const mock = { id: 'mock1', startedAt: '2026-09-07', scoredAt: '2026-09-08', results: old.gradingResults };
  const state = preservePracticeHistory({}, { mockExams: [mock], sessions: {} });
  state.sessions['history:mock1'] = { ...state.sessions['history:mock1'], updatedAt: '2026-09-09', reviewPage: 2, reviewedQuestions: { a: { completed: true, updatedAt: '2026-09-09' } } };
  const next = preservePracticeHistory(state, state);
  assert.equal(next.sessions['history:mock1'].reviewPage, 2);
  assert.equal(next.sessions['history:mock1'].reviewedQuestions.a.completed, true);
});
