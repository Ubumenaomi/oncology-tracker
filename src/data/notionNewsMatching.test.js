import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getNotionNewsCriteriaForTask,
  hasCriteriaMatches,
  rankNotionNewsItems,
} from './notionNewsMatching.js';

test('uses canonical taxonomy for current and legacy NEWS plan labels', () => {
  const current = getNotionNewsCriteriaForTask({
    cancer: 'Other',
    module: 'Rare/Skin/Sarcoma/CUP/Other',
    topic: 'Sarcoma case review',
  });
  const legacy = getNotionNewsCriteriaForTask({
    module: 'Rare/Skin/Sarcoma/CUP/Other',
    topic: 'Sarcoma case review',
  });
  assert.deepEqual(current.cancerTypes, legacy.cancerTypes);
  assert.ok(current.cancerTypes.includes('soft tissue'));
  assert.ok(current.tags.includes('case'));
});

test('ranks shared Library notes using the canonical task criteria', () => {
  const criteria = getNotionNewsCriteriaForTask({
    cancer: 'Lung',
    topic: 'EGFR metastatic NSCLC',
    details: 'First-line osimertinib',
  });
  const ranked = rankNotionNewsItems([
    {
      id: 'breast',
      cancerTypes: ['breast cancer'],
      tags: ['Early stage'],
      treatments: ['adjuvant'],
      drugs: ['trastuzumab'],
      lastEditedTime: '2026-07-23T00:00:00.000Z',
    },
    {
      id: 'lung',
      cancerTypes: ['lung cancer'],
      tags: ['advance and meta'],
      treatments: ['first line'],
      drugs: ['osimertinib'],
      lastEditedTime: '2026-07-22T00:00:00.000Z',
    },
  ], criteria);
  assert.equal(ranked[0].id, 'lung');
  assert.equal(hasCriteriaMatches(ranked[0]), true);
  assert.equal(hasCriteriaMatches(ranked[1]), false);
});
