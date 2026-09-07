import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { makeSupplementBlocks } from './notion-append.js';
const pageId = '12345678-1234-1234-1234-123456789abc';
const dataSourceId = '105bb19a-c0c2-8160-aaab-000b49de9e79';
function response() { return { statusCode: 200, setHeader() {}, end(value) { this.body = JSON.parse(value); } }; }
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
async function run({ method = 'POST', body = { pageId, text: '新增考點\n保留換行' }, unauthorized = false, outside = false, archived = false, writeFailure = false, denyWrite = false } = {}) {
  const original = { fetch: globalThis.fetch, token: process.env.NOTION_TOKEN, policy: process.env.NOTION_ALLOWED_UIDS, source: process.env.NOTION_DATA_SOURCE_ID };
  process.env.NOTION_TOKEN = 'test-token'; process.env.NOTION_ALLOWED_UIDS = 'reader'; process.env.NOTION_DATA_SOURCE_ID = dataSourceId;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('accounts:lookup')) return json({ users: [{ localId: unauthorized ? 'stranger' : 'reader' }] });
    if (String(url).endsWith(`/pages/${pageId}`)) return json({ id: pageId, archived, parent: { data_source_id: outside ? 'outside' : dataSourceId } });
    if (options.method === 'PATCH') {
      if (writeFailure) throw new Error('network lost');
      if (denyWrite) return json({ message: 'Insert content permission required', code: 'restricted_resource' }, 403);
      return json({ results: [{ id: 'new' }] });
    }
    throw new Error('Unexpected request');
  };
  try {
    const res = response();
    await handler({ method, body, headers: { authorization: 'Bearer test-user-token' } }, res);
    return { res, writes: calls.filter((call) => call.options.method === 'PATCH') };
  } finally {
    globalThis.fetch = original.fetch;
    for (const [key, value] of [['NOTION_TOKEN', original.token], ['NOTION_ALLOWED_UIDS', original.policy], ['NOTION_DATA_SOURCE_ID', original.source]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
test('append only, authenticates user and writes plain text at page end', async () => {
  const { res, writes } = await run();
  assert.equal(res.statusCode, 200); assert.equal(res.body.saved, true); assert.equal(writes.length, 1);
  assert.match(writes[0].url, /\/blocks\/.*\/children$/);
  const payload = JSON.parse(writes[0].options.body);
  assert.deepEqual(Object.keys(payload), ['children']);
  assert.equal(payload.children[1].paragraph.rich_text[0].text.content, '新增考點\n保留換行');
});
test('rejects other methods, invalid content and invalid page IDs before writing', async () => {
  for (const options of [{ method: 'GET' }, { body: { pageId, text: ' ' } }, { body: { pageId, text: 'x'.repeat(10001) } }, { body: { pageId: '../secret', text: 'text' } }, { body: '{invalid' }]) {
    const { res, writes } = await run(options); assert.ok(res.statusCode >= 400); assert.equal(writes.length, 0);
  }
});
test('cannot write as another user, outside Fellow training, or to an archived page', async () => {
  for (const options of [{ unauthorized: true }, { outside: true }, { archived: true }]) {
    const { res, writes } = await run(options); assert.ok(res.statusCode >= 400); assert.equal(writes.length, 0);
  }
});
test('unknown write outcome is distinguished from a denied write and never retried', async () => {
  const unknown = await run({ writeFailure: true });
  assert.equal(unknown.res.body.uncertain, true); assert.equal(unknown.writes.length, 1);
  const denied = await run({ denyWrite: true });
  assert.equal(denied.res.statusCode, 403); assert.equal(denied.res.body.uncertain, false); assert.equal(denied.writes.length, 1);
});
test('long unicode notes preserve exact text within Notion rich text limits', () => {
  const text = '😀中文\n'.repeat(1800);
  const blocks = makeSupplementBlocks(text, new Date('2026-09-07T12:00:00Z'));
  const pieces = blocks.slice(1).map((block) => block.paragraph.rich_text[0].text.content);
  assert.equal(pieces.join(''), text); assert.ok(pieces.every((piece) => piece.length <= 1900));
  assert.ok(blocks.length < 100);
});
