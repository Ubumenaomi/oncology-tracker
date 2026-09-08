import test from 'node:test';
import assert from 'node:assert/strict';
import { STUDY_SECTIONS, getStudySection, getStudyNextStep } from './studyNavigation.js';
import { selectTrainingIds } from './scoreTraining.js';
test('each destination has one home and legacy exams belong to the same workspace', () => {
  const ids = STUDY_SECTIONS.flatMap((section) => section.items.map(([id]) => id));
  assert.equal(ids.length, new Set(ids).size);
  for (const tab of ['training', 'today', 'mock']) assert.equal(getStudySection(tab).id, 'practice');
  assert.equal(STUDY_SECTIONS[0].items.length, 1);
});
test('recommendations prioritize unfinished work and link its exact attempt', () => {
  const pending = { key: 'history:old', questionIds: ['a'], submittedAt: 'yesterday' };
  const draft = { key: 'history:new', questionIds: ['b'] };
  assert.equal(getStudyNextStep([pending, draft], 10).historyKey, draft.key);
  assert.equal(getStudyNextStep([pending], 10).historyKey, pending.key);
  assert.equal(getStudyNextStep([{ ...pending, reviewedQuestions: { a: { completed: true } } }], 10).tab, 'review');
  assert.equal(getStudyNextStep([], 0).action, null);
});
test('mixed tests honor available pool and do not duplicate questions or mutate it', () => {
  const rows = Array.from({ length: 9 }, (_, i) => ({ q: { id: String(i) } }));
  const before = JSON.stringify(rows);
  const ids = selectTrainingIds(rows, 80, 'mixed');
  assert.equal(ids.length, 9);
  assert.equal(new Set(ids).size, 9);
  assert.equal(JSON.stringify(rows), before);
});

test('timed mixed results enter assessment once and timer survives returning later', async () => {
  const { getAssessmentExams, getTestRemainingSeconds } = await import('./studyNavigation.js');
  const session = { attemptId: 'one', trainingMode: 'mixed', timerMinutes: 30, createdAt: '2026-09-08T00:00:00Z', submittedAt: '2026-09-08T00:20:00Z', gradingResults: [{ isCorrect: true }, { isCorrect: false }] };
  assert.equal(getAssessmentExams({ sessions: { active: session, 'history:one': session } }).length, 1);
  assert.equal(getAssessmentExams({ sessions: { active: session } })[0].score, 50);
  assert.equal(getTestRemainingSeconds(session, Date.parse('2026-09-08T00:10:00Z')), 1200);
  assert.equal(getTestRemainingSeconds(session, Date.parse('2026-09-08T01:00:00Z')), 0);
});
