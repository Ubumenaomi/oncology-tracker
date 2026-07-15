import test from 'node:test';
import assert from 'node:assert/strict';
import { studyPlan100, trialRegistry } from './studyPlan100.js';
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

test('reviewed plans support Golden-only, Related-only, mixed, and empty trial days', () => {
  const day14 = studyPlan100.find((task) => task.id === 14);
  const day15 = studyPlan100.find((task) => task.id === 15);
  const day28 = studyPlan100.find((task) => task.id === 28);
  const day12 = studyPlan100.find((task) => task.id === 12);
  assert.deepEqual(day14.goldenTrials, ['TAILORx', 'RxPONDER']);
  assert.deepEqual(day14.relatedTrials, []);
  assert.deepEqual(day15.goldenTrials, ['TAILORx']);
  assert.deepEqual(day15.relatedTrials, ['MINDACT']);
  assert.deepEqual(day28.goldenTrials, []);
  assert.deepEqual(day28.relatedTrials, ['VELOUR', 'RAISE', 'SUNLIGHT']);
  assert.deepEqual(day12.goldenTrials, []);
  assert.deepEqual(day12.relatedTrials, []);
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
