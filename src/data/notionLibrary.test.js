import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterNotionLibrary,
  getLinkedNotionNotes,
  inferNotionNoteType,
  normalizeNotionExternalUrl,
  normalizeNotionLibraryItem,
} from './notionLibrary.js';

const topic = {
  cancer: 'Lung',
  title: 'EGFR early NSCLC',
  details: 'Adjuvant osimertinib, EGFR exon 19/L858R, postop chemotherapy role',
  focusTags: ['EGFR', 'adjuvant'],
  trials: ['ADAURA'],
  task: { focusTags: ['EGFR', 'adjuvant'], goldenTrials: ['ADAURA'] },
};

const notes = [
  normalizeNotionLibraryItem({
    id: 'egfr',
    title: 'EGFR early NSCLC: ADAURA and adjuvant osimertinib',
    url: 'https://notion.so/egfr',
    cancerTypes: ['lung cancer'],
    genes: ['EGFR'],
    tags: ['Early stage'],
    flashcardCreated: true,
  }),
  normalizeNotionLibraryItem({
    id: 'breast',
    title: 'HER2-positive breast cancer',
    url: 'https://notion.so/breast',
    cancerTypes: ['breast cancer'],
    genes: ['HER2'],
  }),
];

test('links a specific Fellow training note to the matching Knowledge topic', () => {
  assert.deepEqual(getLinkedNotionNotes(notes, topic).map((note) => note.id), ['egfr']);
});

test('filters the normalized library by metadata and flashcard state', () => {
  assert.deepEqual(filterNotionLibrary(notes, {
    query: 'adaura',
    cancer: 'lung cancer',
    gene: 'EGFR',
    flashcard: 'Ready',
  }).map((note) => note.id), ['egfr']);
});

test('infers a conservative display-only note type without changing Notion', () => {
  assert.equal(inferNotionNoteType({ title: 'KEYNOTE-522 phase 3 trial' }), 'Trial Note');
  assert.equal(inferNotionNoteType({ title: 'ICI myocarditis toxicity' }), 'Toxicity');
  assert.equal(inferNotionNoteType({ title: 'NSCLC overview' }), 'Master Note');
});

test('repairs legacy app.notion.com page links while preserving current Notion URLs', () => {
  assert.equal(
    normalizeNotionExternalUrl('https://app.notion.com/38db04dafce881e8a345c39dbdc12272'),
    'https://www.notion.so/38db04dafce881e8a345c39dbdc12272',
  );
  assert.equal(
    normalizeNotionExternalUrl('https://app.notion.com/38db04da-fce8-81e8-a345-c39dbdc12272?pvs=4'),
    'https://www.notion.so/38db04dafce881e8a345c39dbdc12272?pvs=4',
  );
  assert.equal(
    normalizeNotionExternalUrl('https://www.notion.so/NSCLC-38db04dafce881e8a345c39dbdc12272'),
    'https://www.notion.so/NSCLC-38db04dafce881e8a345c39dbdc12272',
  );
});

test('normalizes legacy links when reading library items and cached snapshots', () => {
  const note = normalizeNotionLibraryItem({
    id: 'legacy',
    title: 'Legacy snapshot note',
    url: 'https://app.notion.com/38db04dafce881e8a345c39dbdc12272',
  });
  assert.equal(note.url, 'https://www.notion.so/38db04dafce881e8a345c39dbdc12272');
});
