import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise async request ordering without a browser or live Notion requests.
function harness() {
  const states = [];
  const pending = new Map();
  const source = readFileSync(new URL('./useNotionLibrary.js', import.meta.url), 'utf8');
  const context = vm.createContext({
    useState: (initial) => {
      const index = states.length;
      states.push(typeof initial === 'function' ? initial() : initial);
      return [states[index], (value) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useRef: (current) => ({ current }), useCallback: (fn) => fn, useEffect: () => {},
    getNotionPageId: (note) => note.id,
    makeInitialLibraryState: () => ({ items: [] }),
    loadNotionPreviewCache: () => null, saveNotionPreviewCache: () => {},
    fetchNotionPagePreview: (id) => new Promise((resolve, reject) => pending.set(id, { resolve, reject })),
  });
  vm.runInContext(source.slice(source.indexOf('export function useNotionLibrary')).replace('export function', 'function'), context);
  return { api: context.useNotionLibrary(), pending, preview: () => states[1] };
}

test('late response cannot reopen a closed question note', async () => {
  const h = harness();
  const request = h.api.openNotePreview({ id: 'one' });
  h.api.closeNotePreview();
  h.pending.get('one').resolve({ id: 'one', title: 'Old note' });
  await request;
  assert.equal(h.preview().status, 'idle');
  assert.equal(h.preview().id, '');
});

test('earlier response or failure cannot overwrite a newer note', async () => {
  for (const fail of [false, true]) {
    const h = harness();
    const older = h.api.openNotePreview({ id: 'old' });
    const newer = h.api.openNotePreview({ id: 'new' });
    h.pending.get('new').resolve({ id: 'new', title: 'Current note' });
    await newer;
    if (fail) h.pending.get('old').reject(new Error('Old request failed'));
    else h.pending.get('old').resolve({ id: 'old', title: 'Old note' });
    await older;
    assert.equal(h.preview().id, 'new');
    assert.equal(h.preview().status, 'ready');
  }
});
