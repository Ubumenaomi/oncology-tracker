import test from 'node:test';
import assert from 'node:assert/strict';
import { isPlanTaskComplete, normalizePlanProgress, studyPlan100, trialRegistry } from './studyPlan100.js';
import { normalizeTrialName, reconcileTrialRegistryWithPlan, trialRegistryCandidates } from './trialRegistry.js';

test('registry candidates have valid, unique canonical identities', () => {
  const validCancers = new Set(['Breast', 'GI', 'GU', 'GYN', 'Head & Neck', 'Heme', 'Lung', 'Other']);
  const identities = trialRegistryCandidates.map((record) => `${record.cancer}:${normalizeTrialName(record.canonicalName)}`);
  assert.equal(new Set(identities).size, identities.length);
  trialRegistryCandidates.forEach((record) => {
    assert.ok(record.name);
    assert.ok(record.canonicalName);
    assert.ok(validCancers.has(record.cancer));
    assert.ok(['golden', 'related'].includes(record.classification));
    assert.ok(['approved', 'pending'].includes(record.reviewStatus));
    assert.ok(Array.isArray(record.aliases));
    assert.ok(Array.isArray(record.assignedDayIds));
  });
});

test('approved Daily Plan references resolve to matching approved registry records', () => {
  studyPlan100.forEach((task) => {
    [...task.goldenTrials, ...task.relatedTrials].forEach((name) => {
      const record = trialRegistry.find((candidate) => candidate.canonicalName === name);
      assert.ok(record, `${task.day}: ${name} is missing from registry`);
      assert.equal(record.reviewStatus, 'approved');
      assert.ok(record.assignedDayIds.includes(task.id));
    });
  });
});

test('the active final sprint has 40 stable, collision-free tasks', () => {
  assert.equal(studyPlan100.length, 40);
  assert.equal(new Set(studyPlan100.map((task) => task.key)).size, 40);
  assert.equal(new Set(studyPlan100.map((task) => task.id)).size, 40);
  assert.equal(studyPlan100[0].key, 'final-sprint-2026-d01');
  assert.equal(studyPlan100[0].id, 101);
  assert.equal(studyPlan100.at(-1).key, 'final-sprint-2026-d40');
  assert.equal(studyPlan100.at(-1).id, 140);
});

test('the redesigned plan keeps trial-bearing and trial-free days explicit', () => {
  const breastClosure = studyPlan100.find((task) => task.id === 101);
  const giDay = studyPlan100.find((task) => task.id === 104);
  const mockDay = studyPlan100.find((task) => task.id === 124);
  assert.deepEqual(breastClosure.goldenTrials, ['TAILORx', 'RxPONDER', 'KATHERINE', 'KEYNOTE-522', 'OlympiA', 'monarchE']);
  assert.deepEqual(giDay.goldenTrials, ['KEYNOTE-177', 'BEACON CRC', 'BREAKWATER']);
  assert.deepEqual(mockDay.goldenTrials, []);
  assert.deepEqual(mockDay.relatedTrials, []);
});

test('retired numeric progress is preserved without completing new sprint tasks', () => {
  const normalized = normalizePlanProgress({ 1: true, 'lung-nsclc-foundation': true });
  assert.equal(normalized[1], true);
  assert.equal(normalized['lung-nsclc-foundation'], true);
  assert.equal(isPlanTaskComplete(normalized, studyPlan100[0]), false);
});

test('aliases reconcile without creating a duplicate trial', () => {
  const result = reconcileTrialRegistryWithPlan([{ id: 41, cancer: 'GU', goldenTrials: ['EV-302'] }]);
  const ev302 = result.records.find((record) => record.canonicalName === 'EV-302/KEYNOTE-A39');
  assert.equal(ev302.reviewStatus, 'approved');
  assert.deepEqual(ev302.assignedDayIds, [41]);
  assert.equal(result.tasks[0].goldenTrials.filter((name) => name === 'EV-302/KEYNOTE-A39').length, 1);
});

test('reviewed Related Trial decisions override their former Daily Plan classification', () => {
  const result = reconcileTrialRegistryWithPlan([{ id: 15, cancer: 'Breast', goldenTrials: ['MINDACT'] }]);
  const mindact = result.records.find((record) => record.canonicalName === 'MINDACT');
  assert.equal(mindact.classification, 'related');
  assert.equal(mindact.reviewStatus, 'approved');
  assert.deepEqual(result.tasks[0].goldenTrials, []);
  assert.deepEqual(result.tasks[0].relatedTrials, ['MINDACT']);
});
