import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNotionLearningPrompt,
  deriveNotionLearningContext,
  getRelatedQuestionsForNotionNote,
  markLearningDraftDuplicates,
  parseNotionLearningDrafts,
} from './notionLearningDrafts.js';

const note = {
  id: 'notion-egfr',
  title: 'EGFR early NSCLC: ADAURA',
  url: 'https://notion.so/notion-egfr',
  cancerTypes: ['lung cancer'],
  genes: ['EGFR'],
  treatments: ['adjuvant'],
  plainText: 'ADAURA evaluated adjuvant osimertinib in resected EGFR-mutated NSCLC. Board Trap: treatment setting is adjuvant.',
  headings: [{ id: 'h1', level: 1, text: 'Board Trap' }],
};

const questions = [
  {
    id: '114-Q001',
    cancer: 'Lung',
    topic: 'EGFR early NSCLC',
    trials: ['ADAURA'],
    stem: 'Which adjuvant strategy applies after resection in EGFR-mutated NSCLC?',
    options: {},
  },
  {
    id: '114-Q002',
    cancer: 'Breast',
    topic: 'HER2-positive disease',
    trials: ['KATHERINE'],
    stem: 'Post-neoadjuvant HER2 therapy',
    options: {},
  },
];

test('derives safe tracker mapping, auto-tags, and known trials from a Notion note', () => {
  const context = deriveNotionLearningContext(note, [questions[0]]);
  assert.equal(context.cancer, 'Lung');
  assert.ok(context.trials.includes('ADAURA'));
  assert.ok(context.autoTags.includes('biomarker/egfr'));
  assert.ok(context.autoTags.includes('source/notion'));
});

test('does not leak trial names from related questions into note auto-mapping', () => {
  const context = deriveNotionLearningContext({
    id: 'her2-note',
    title: 'HER2-positive early breast cancer',
    plainText: 'Neoadjuvant treatment and residual disease decisions.',
    cancerTypes: ['breast cancer'],
    genes: ['HER2'],
  }, [{ cancer: 'Breast', trials: ['OlympiA'] }]);
  assert.deepEqual(context.trials, []);
  assert.equal(context.autoTags.some((tag) => tag === 'trial/olympia'), false);
});

test('links only strongly related existing questions', () => {
  assert.deepEqual(
    getRelatedQuestionsForNotionNote(note, questions).map(({ question }) => question.id),
    ['114-Q001'],
  );
});

test('builds a source-grounded prompt with read-only provenance', () => {
  const prompt = buildNotionLearningPrompt({ artifactType: 'board-traps', note, relatedQuestions: [questions[0]] });
  assert.match(prompt, /sourceEvidence/);
  assert.match(prompt, /type 必須是 "Trap Card"/);
  assert.match(prompt, /Notion page ID: notion-egfr/);
});

test('validates learning drafts and preserves Notion provenance', () => {
  const result = parseNotionLearningDrafts(JSON.stringify([
    {
      front: 'ADAURA 的治療 setting？',
      back: 'Adjuvant setting after resection.',
      type: 'Trial Card',
      trial: ['ADAURA'],
      sourceEvidence: 'Board Trap heading',
    },
    {
      front: 'Missing evidence',
      back: 'Should be rejected',
      type: 'Trap Card',
    },
  ]), 'flashcards', note, [questions[0]]);

  assert.equal(result.items.length, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(result.items[0].notionPageId, 'notion-egfr');
  assert.equal(result.items[0].sourceType, 'notion');
});

test('validates a five-option quiz for Question Manager', () => {
  const result = parseNotionLearningDrafts(JSON.stringify([
    {
      stem: 'ADAURA belongs to which treatment setting?',
      options: { A: 'Neoadjuvant', B: 'Adjuvant', C: 'Metastatic first line', D: 'Salvage', E: 'Maintenance after CCRT' },
      answer: 'B',
      explanation: 'The source describes complete resection followed by adjuvant osimertinib.',
      sourceEvidence: 'Board Trap',
    },
  ]), 'quiz', note, [questions[0]]);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].kind, 'question');
  assert.equal(result.items[0].answer, 'B');
  assert.equal(result.items[0].notionUrl, note.url);
});

test('marks existing and within-batch duplicates before approval', () => {
  const marked = markLearningDraftDuplicates([
    { draftId: '1', kind: 'flashcard', front: 'Same front' },
    { draftId: '2', kind: 'flashcard', front: 'Same   front' },
  ], [{ front: 'same front' }], []);
  assert.deepEqual(marked.map((item) => item.duplicate), [true, true]);
});
