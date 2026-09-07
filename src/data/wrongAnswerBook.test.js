import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { getWrongAnswerRows, gradeWrongAnswerBatch } from './wrongAnswerBook.js';

const questions = [{ id: 'a', cancer: 'Lung', stem: 'EGFR', answer: 'A' }, { id: 'b', cancer: 'GI', stem: 'colon', answer: 'B' }, { id: 'c', cancer: 'GI', stem: 'new' }];
const stats = { a: { wrong: 2, lastResult: 'correct', answerHistory: [{ isCorrect: false, date: '2026-09-06' }, { isCorrect: true, date: '2026-09-07' }] }, b: { wrong: 1, lastResult: 'wrong', lastAttemptAt: '2026-09-07' } };
test('wrong book retains corrected questions and filters actual wrong date', () => {
  assert.deepEqual(getWrongAnswerRows(questions, stats).map(({ q }) => q.id), ['b', 'a']);
  assert.deepEqual(getWrongAnswerRows(questions, stats, { status: 'corrected' }).map(({ q }) => q.id), ['a']);
  assert.deepEqual(getWrongAnswerRows(questions, stats, { period: '1', today: '2026-09-07' }).map(({ q }) => q.id), ['b']);
  assert.equal(getWrongAnswerRows(questions, stats, { cancer: 'Lung', query: 'colon' }).length, 0);
});
test('grading honors edited answers and keeps unknown answers ungraded', () => {
  const result = gradeWrongAnswerBatch(questions, { a: { selected: 'B' }, b: { selected: 'B', correctAnswer: 'A' }, c: { selected: 'A' } }, { a: { correctAnswer: 'B' } }, 'now');
  assert.deepEqual(result.map((r) => r.isCorrect), [true, false, null]);
});

// Exercise the actual app accounting and merge functions without mounting React.
const source = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
const context = vm.createContext({ TODAY: '2026-09-07', FLASHCARD_RATINGS: { Good: {}, Again: {}, Hard: {}, Easy: {} }, ERROR_TYPE_REMEDIATION: {}, addDays: () => '2026-09-08' });
function load(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n}\n', start) + 2;
  vm.runInContext(source.slice(start, end), context);
}
['emptyStat', 'getRemediationForErrorType', 'getAnkiIntervalDays', 'nextIntervalByRating', 'getMasteryDeltaByRating', 'applyBatchQuestionResults', 'regradeBatchQuestionResult', 'getSessionFreshness', 'mergeDailySession', 'getStatAttemptScore', 'getAnswerEventMergeKey', 'mergeAnswerEvents', 'getAnswerEventTime', 'getQuestionStatFreshness', 'getMergedAttemptCounts', 'recoverSubmittedQuestionStats', 'getRemediationMergeKey', 'mergeRemediationTasks', 'mergeQuestionStats'].forEach(load);
test('repeated rounds count separately; duplicate submission and regrading do not inflate attempts', () => {
  const row = { questionId: 'a', selected: 'B', correctAnswer: 'A', isCorrect: false, confidence: 3 };
  let value = context.applyBatchQuestionResults({}, [row], 'wrong-book', 'one');
  value = context.applyBatchQuestionResults(value, [row], 'wrong-book', 'one');
  assert.equal(value.a.attempts, 1);
  value = context.applyBatchQuestionResults(value, [{ ...row, selected: 'A', isCorrect: true }], 'wrong-book', 'two');
  assert.equal(value.a.attempts, 2);
  assert.equal(value.a.wrongRetestCorrect, 1);
  value = context.regradeBatchQuestionResult(value, { ...row, selected: 'A', isCorrect: true, rating: 'Easy' }, 'wrong-book', 'two');
  assert.equal(value.a.attempts, 2);
  assert.equal(value.a.wrong, 1);
});
test('cloud merge never resurrects a submitted round over a fresh retry', () => {
  const old = { attemptId: 'old', createdAt: '2026-09-06', submittedAt: '2026-09-06', questionIds: ['a', 'b'], practiceDrafts: { a: { selected: 'B' } }, completed: true };
  const fresh = { attemptId: 'new', createdAt: '2026-09-07', questionIds: ['a'], practiceDrafts: {} };
  assert.equal(context.mergeDailySession(old, fresh), fresh);
  assert.equal(context.mergeDailySession(fresh, old), fresh);
  assert.equal(context.mergeDailySession({ ...old, attemptId: undefined }, fresh), fresh);
});
test('Notion link removal survives a device with more answer attempts', () => {
  const cloud = { a: { attempts: 10, notionLinks: ['https://notion.so/old'], notionLinksUpdatedAt: '2026-09-06' } };
  const local = { a: { attempts: 1, notionLinks: [], notionLinksUpdatedAt: '2026-09-07' } };
  assert.equal(context.mergeQuestionStats(cloud, local).a.notionLinks.length, 0);
  assert.equal(context.mergeQuestionStats(local, cloud).a.notionLinks.length, 0);
});
test('Daily Practice generation ignores Day Plan and respects chosen years/cancers', () => {
  const pool = [{ id: 'a', year: 114, cancer: 'Lung' }, { id: 'b', year: 113, cancer: 'GI' }, { id: 'c', year: 114, cancer: 'Lung' }];
  Object.assign(context, {
    getQuestionPool: () => pool,
    getQuestionWithOverride: (id) => pool.find((q) => q.id === id),
    getPracticeModeConfig: () => ({ total: 2, newCount: 1, topicCount: 1, dueCount: 0, weaknessCount: 0, highYieldCount: 0 }),
    getRankedHighYieldTopics: (_state, task) => { assert.equal(task, null); return []; },
    getTodayPlanTask: () => { throw new Error('Daily Practice must not read Day Plan'); },
    getQuestionContentText: () => '', daysBetween: () => 1,
    shuffleStable: (items) => items,
  });
  ['getStat', 'wrongRate', 'scoreQuestionForTask', 'generateDailyQuestionIds'].forEach(load);
  const state = { stats: {}, settings: { preferredYears: [114], preferredCancers: ['Lung'] }, planProgress: { 'day-1': false } };
  assert.equal(JSON.stringify(context.generateDailyQuestionIds(state)), '["a","c"]');
  assert.equal(JSON.stringify(context.generateDailyQuestionIds({ ...state, planProgress: { 'day-1': true } })), '["a","c"]');
  assert.equal(JSON.stringify(context.generateDailyQuestionIds(state, null, ['a'])), '["c"]');
});

test('submitted unknown answers persist and grading later does not remove another attempt', () => {
  const row = { questionId: 'a', selected: 'A', correctAnswer: '', isCorrect: null, confidence: 5, submittedAt: '2026-09-01T10:00:00Z' };
  let value = context.applyBatchQuestionResults({}, [{ ...row, isCorrect: false, correctAnswer: 'B' }], 'daily', 'old');
  value = context.applyBatchQuestionResults(value, [row], 'daily', 'pending');
  value = context.applyBatchQuestionResults(value, [row], 'daily', 'pending');
  assert.equal(value.a.ungradedAttempts, 1);
  assert.equal(value.a.attempts, 1);
  assert.equal(value.a.lastAttemptAt, '2026-09-01');
  value = context.regradeBatchQuestionResult(value, { ...row, correctAnswer: 'A', isCorrect: true }, 'daily', 'pending');
  assert.equal(value.a.ungradedAttempts, 0);
  assert.equal(value.a.attempts, 2);
  assert.equal(value.a.wrong, 1);
  assert.equal(value.a.correct, 1);
  assert.equal(value.a.highConfidenceWrong, 1);
});

test('device merge counts distinct attempts and prefers the latest correction', () => {
  const row = { questionId: 'a', selected: 'A', correctAnswer: 'A', isCorrect: true, confidence: 3 };
  const cloud = context.applyBatchQuestionResults({}, [{ ...row, submittedAt: '2026-09-01' }], 'daily', 'cloud');
  const local = context.applyBatchQuestionResults({}, [{ ...row, submittedAt: '2026-09-02' }], 'daily', 'local');
  const merged = context.mergeQuestionStats(cloud, local);
  assert.equal(merged.a.attempts, 2);
  assert.equal(merged.a.correct, 2);
  assert.equal(context.mergeQuestionStats(merged, local).a.attempts, 2);
  const corrected = context.regradeBatchQuestionResult(cloud, { ...row, correctAnswer: 'B', isCorrect: false }, 'daily', 'cloud');
  assert.equal(context.mergeQuestionStats(cloud, corrected).a.wrong, 1);
  assert.equal(context.mergeQuestionStats(corrected, cloud).a.correct, 0);
});

test('bounded histories remain stable after repeated synchronization', () => {
  const events = Array.from({ length: 60 }, (_, i) => ({ questionId: 'a', attemptId: `id-${String(i).padStart(3, '0')}`, submittedAt: `2026-09-01T00:00:${String(i).padStart(2, '0')}Z`, selected: 'A', isCorrect: true }));
  const cloud = { a: { attempts: 50, correct: 50, answerHistory: events.slice(0, 50) } };
  const local = { a: { attempts: 60, correct: 60, answerHistory: events.slice(10) } };
  let merged = context.mergeQuestionStats(cloud, local);
  for (let i = 0; i < 3; i++) merged = context.mergeQuestionStats(cloud, merged);
  assert.equal(merged.a.attempts, 60);
  assert.equal(merged.a.correct, 60);
  assert.equal(merged.a.answerHistory.length, 50);
});

test('recover stored submissions once, keep original date, and never turn drafts into attempts', () => {
  const row = { questionId: 'a', selected: 'A', correctAnswer: 'A', isCorrect: true, confidence: 3 };
  const state = { stats: {}, sessions: { '2026-09-01': { attemptId: 'saved', submittedAt: '2026-09-01T12:00:00Z', gradingResults: [row] }, draft: { practiceDrafts: { b: { selected: 'B' } } } } };
  const recovered = context.recoverSubmittedQuestionStats(state);
  assert.equal(recovered.a.attempts, 1);
  assert.equal(recovered.a.lastAttemptAt, '2026-09-01');
  assert.equal(recovered.b, undefined);
  assert.equal(context.recoverSubmittedQuestionStats({ ...state, stats: recovered }).a.attempts, 1);
  const legacy = { a: { attempts: 60, correct: 60, answerHistory: [] } };
  assert.equal(context.recoverSubmittedQuestionStats({ ...state, stats: legacy }).a.attempts, 60);
});

test('save flushes every changed storage slice even when given state field names', () => {
  const disk = new Map();
  const storageContext = vm.createContext({
    normalizeState: (state) => state,
    defaultState: {},
    localStorage: { setItem: (key, value) => disk.set(key, value) },
    STORAGE_KEY: 'marker', STORAGE_VERSION: 3,
    STORAGE_SLICE_KEYS: Object.fromEntries(['app', 'activity', 'sessions', 'progress', 'quest', 'questionRecords', 'questionEdits', 'flashcards', 'flashcardStats', 'game'].map((key) => [key, key])),
    lastSavedStorageSlices: {},
  });
  for (const name of ['buildStorageSlices', 'saveState']) {
    const start = source.indexOf(`function ${name}(`);
    vm.runInContext(source.slice(start, source.indexOf('\n}\n', start) + 2), storageContext);
  }
  storageContext.saveState({ stats: {}, sessions: {} });
  const state = { stats: { a: { attempts: 1, correct: 1 } }, sessions: { today: { submittedAt: 'now' } } };
  storageContext.saveState(state, ['stats', 'sessions']);
  assert.equal(JSON.parse(disk.get('questionRecords')).stats.a.correct, 1);
  const next = { ...state, stats: { a: { attempts: 2, correct: 2 } }, game: { xp: 20 } };
  storageContext.saveState(next, ['game']);
  assert.equal(JSON.parse(disk.get('questionRecords')).stats.a.attempts, 2);
  assert.equal(JSON.parse(disk.get('game')).game.xp, 20);
});
