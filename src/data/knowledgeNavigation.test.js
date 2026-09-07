import test from 'node:test';
import assert from 'node:assert/strict';
import { getKnowledgePageId, jumpToKnowledgeSection } from './knowledgeNavigation.js';
import { buildNotionNoteSections } from './notionLibrary.js';

test('Knowledge resolves existing saved and library Notion URLs to the same page', () => {
  const id = '38db04dafce881e8a345c39dbdc12272';
  assert.equal(getKnowledgePageId({ id: '38db04da-fce8-81e8-a345-c39dbdc12272' }), id);
  assert.equal(getKnowledgePageId({ url: `https://www.notion.so/Title-${id}?pvs=4#heading` }), id);
  assert.equal(getKnowledgePageId({ url: 'https://app.notion.com/38db04da-fce8-81e8-a345-c39dbdc12272' }), id);
  assert.equal(getKnowledgePageId({ url: `https://example.com/${id}` }), '');
  assert.equal(getKnowledgePageId({ url: 'javascript:alert(1)' }), '');
});

test('rich article TOC uses actual rendered block IDs, including nested duplicate titles', () => {
  const sections = buildNotionNoteSections({
    plainText: 'Old stale heading', headings: [{ id: 'stale', text: 'Old stale heading' }],
    blocks: [
      { id: 'one', type: 'heading_2', richText: [{ text: 'Same title' }] },
      { id: 'toggle', type: 'toggle', children: [{ id: 'two', type: 'heading_3', richText: [{ text: 'Same title' }] }] },
    ],
  });
  assert.deepEqual(sections, [{ id: 'one', title: 'Same title', level: 2 }, { id: 'two', title: 'Same title', level: 3 }]);
  assert.equal(buildNotionNoteSections({ blocks: [{ id: 'single', type: 'heading_1', richText: [{ text: 'Only heading' }] }] }).length, 1);
});

test('TOC opens collapsed ancestors, focuses the correct heading and scrolls within its reader', () => {
  const calls = [];
  const panel = { querySelectorAll: () => [other, target] };
  const outer = { tagName: 'DETAILS', open: false, parentElement: panel };
  const inner = { tagName: 'DETAILS', open: false, parentElement: outer };
  const other = { dataset: { noteAnchor: 'one' } };
  const target = { dataset: { noteAnchor: 'two' }, parentElement: inner,
    focus: (options) => calls.push(['focus', options]),
    scrollIntoView: (options) => { assert.ok(inner.open && outer.open); calls.push(['scroll', options]); },
  };
  assert.equal(jumpToKnowledgeSection(panel, 'two'), true);
  assert.deepEqual(calls.map(([name]) => name), ['focus', 'scroll']);
  assert.equal(jumpToKnowledgeSection(panel, 'missing'), false);
  assert.equal(jumpToKnowledgeSection(null, 'two'), false);
});
