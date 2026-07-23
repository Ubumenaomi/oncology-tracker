import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getKnowledgeCardCancerDomain,
  knowledgeCardMatchesTask,
} from './knowledgeCardMatching.js';

test('maps a biliary tract trial card to the GI plan domain and topic', () => {
  const card = {
    id: 'keynote-966',
    cancer: 'Biliary tract cancer',
    topic: 'First-line systemic therapy',
    front: 'KEYNOTE-966 first-line biliary tract cancer regimen',
    back: 'Pembrolizumab plus GemCis improved overall survival.',
    trial: ['KEYNOTE-966'],
    tags: ['BTC', 'first-line', 'immunotherapy'],
  };
  const task = {
    cancer: 'GI',
    topic: 'Advanced biliary tract cancer',
    details: 'First-line systemic therapy',
    goldenTrials: ['KEYNOTE-966'],
    focusTags: ['biliary'],
  };

  assert.equal(getKnowledgeCardCancerDomain(card), 'GI');
  assert.equal(knowledgeCardMatchesTask(card, task), true);
});

test('maps HER2-positive breast cards to Breast even when cancer is not the plan label', () => {
  const card = {
    cancer: 'HER2-positive breast cancer',
    topic: 'Residual disease',
    front: 'KATHERINE supports adjuvant T-DM1 after residual disease.',
    back: 'Switch trastuzumab to T-DM1.',
    trial: ['KATHERINE'],
    tags: ['HER2', 'adjuvant'],
  };

  assert.equal(getKnowledgeCardCancerDomain(card), 'Breast');
});

test('folds taxonomy-only CNS and melanoma or sarcoma domains into Other', () => {
  assert.equal(getKnowledgeCardCancerDomain({ cancer: 'CNS', taxonomyTags: { cancerDomain: 'CNS' } }), 'Other');
  assert.equal(
    getKnowledgeCardCancerDomain({ cancer: 'Sarcoma', taxonomyTags: { cancerDomain: 'Melanoma/Sarcoma' } }),
    'Other',
  );
});

test('keeps the topic-specific evidence gate after cancer mapping succeeds', () => {
  const card = {
    cancer: 'GI',
    front: 'General oncology recall',
    back: 'No task-specific evidence.',
    tags: [],
  };
  const task = {
    cancer: 'GI',
    topic: 'Advanced biliary tract cancer',
    details: 'First-line systemic therapy',
    goldenTrials: ['KEYNOTE-966'],
    focusTags: ['biliary'],
  };

  assert.equal(knowledgeCardMatchesTask(card, task), false);
});
