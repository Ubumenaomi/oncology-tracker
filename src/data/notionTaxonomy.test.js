import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNotionLearningTags,
  getNotionCancerTypesForTrackerDomain,
  getNotionMetadataCriteriaForTaskText,
  mapNotionCancerToTrackerDomain,
} from './notionTaxonomy.js';

test('maps current and legacy plan cancer labels through one canonical definition', () => {
  assert.deepEqual(
    getNotionCancerTypesForTrackerDomain('Other'),
    getNotionCancerTypesForTrackerDomain('Rare/Skin/Sarcoma/CUP/Other'),
  );
  assert.deepEqual(
    getNotionCancerTypesForTrackerDomain('Supportive/Stats'),
    getNotionCancerTypesForTrackerDomain('Supportive/Emergency/Stats'),
  );
  assert.equal(mapNotionCancerToTrackerDomain(['soft tissue']), 'Other');
  assert.equal(mapNotionCancerToTrackerDomain(['drug toxicity']), 'Supportive/Stats');
});

test('derives NEWS criteria from the shared tag, treatment, and drug rules', () => {
  const criteria = getNotionMetadataCriteriaForTaskText(
    'Perioperative early stage EGFR NSCLC with adjuvant osimertinib',
    'Lung',
  );
  assert.ok(criteria.cancerTypes.includes('lung cancer'));
  assert.ok(criteria.tags.includes('Early stage'));
  assert.ok(criteria.treatments.includes('perioperative'));
  assert.ok(criteria.treatments.includes('neoadjuvant'));
  assert.ok(criteria.treatments.includes('adjuvant'));
  assert.deepEqual(criteria.drugs, ['osimertinib']);
});

test('builds Phase 3 namespaced tags from the same normalized metadata fields', () => {
  const tags = buildNotionLearningTags({
    cancerTypes: ['lung cancer'],
    subtypes: ['NSCLC'],
    genes: ['EGFR'],
    treatments: ['first line'],
    drugs: ['osimertinib'],
    tags: ['advance and meta'],
  }, ['FLAURA2']);
  assert.deepEqual(tags, [
    'source/notion',
    'disease/lung-cancer',
    'subtype/nsclc',
    'biomarker/egfr',
    'setting/first-line',
    'drug/osimertinib',
    'trial/flaura2',
    'topic/advance-and-meta',
  ]);
});
