import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalPersistence } from './localPersistence.js';
function setup({ disk = new Map(), legacy = new Map(), fail = () => false } = {}) {
  const messages = [];
  const store = createLocalPersistence({
    openDatabase: async () => ({
      readAll: async () => [...disk],
      write: async (entries) => {
        if (fail()) throw new Error('disk full');
        for (const [key, value] of entries) disk.set(key, value);
      },
    }),
    storage: () => ({ getItem: (key) => legacy.get(key) ?? null, removeItem: (key) => legacy.delete(key), setItem: () => { throw new Error('QuotaExceededError'); } }),
    report: (message) => messages.push(message),
  });
  return { store, disk, legacy, messages };
}
test('oversized sessions migrate without localStorage writes and survive reopening', async () => {
  const legacy = new Map([['sessions', JSON.stringify({ answers: ['B'] })], ['unrelated', 'keep']]);
  const env = setup({ legacy });
  await env.store.initialize();
  assert.equal(env.store.getItem('sessions'), legacy.get('sessions'));
  const large = JSON.stringify({ answers: ['B'], snapshot: 'x'.repeat(6 * 1024 * 1024) });
  assert.equal(await env.store.write({ sessions: large }), true);
  assert.equal(legacy.has('sessions'), false);
  assert.equal(legacy.get('unrelated'), 'keep');
  const reopened = setup({ disk: env.disk, legacy });
  await reopened.store.initialize();
  assert.equal(reopened.store.getItem('sessions'), large);
});
test('failed transaction keeps old disk data and latest in-memory answers, and retries', async () => {
  let fail = true;
  const env = setup({ legacy: new Map([['sessions', 'old']]), fail: () => fail });
  await env.store.initialize();
  assert.equal(await env.store.write({ sessions: 'new' }), false);
  assert.equal(env.legacy.get('sessions'), 'old');
  assert.equal(env.store.getItem('sessions'), 'new');
  assert.ok(env.store.error);
  fail = false;
  assert.equal(await env.store.write({ sessions: 'new' }), true);
  assert.equal(env.disk.get('sessions'), 'new');
  assert.equal(env.store.error, '');
});
test('queued saves preserve newest data when rapidly switching papers', async () => {
  const env = setup();
  await env.store.initialize();
  await Promise.all([env.store.write({ sessions: 'a' }), env.store.write({ sessions: 'b' }), env.store.write({ sessions: 'a' })]);
  assert.equal(env.disk.get('sessions'), 'a');
});
test('unavailable IndexedDB and full localStorage report failure without throwing', async () => {
  const store = createLocalPersistence({ openDatabase: async () => { throw new Error('blocked'); }, storage: () => ({ setItem: () => { throw new Error('quota'); } }) });
  await store.initialize();
  assert.equal(await store.write({ sessions: 'answers' }), false);
  assert.equal(store.getItem('sessions'), 'answers');
  assert.ok(store.error);
});
