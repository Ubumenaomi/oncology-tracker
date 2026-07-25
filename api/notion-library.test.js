import test from 'node:test';
import assert from 'node:assert/strict';

import handler from './notion-library.js';

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = value; },
  };
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; },
  };
}

test('rejects all Notion library write methods', async () => {
  const res = createResponse();
  await handler({ method: 'POST', headers: {}, url: '/api/notion-library' }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(JSON.parse(res.body).error, 'method_not_allowed');
});

test('authenticates Firebase and returns normalized read-only library metadata', async () => {
  const originalFetch = globalThis.fetch;
  const originalPolicy = process.env.NOTION_ALLOWED_UIDS;
  const originalToken = process.env.NOTION_TOKEN;
  process.env.NOTION_ALLOWED_UIDS = 'allowed-user';
  process.env.NOTION_TOKEN = 'server-only-test-token';
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('accounts:lookup')) {
      return jsonResponse({ users: [{ localId: 'allowed-user', email: 'reader@example.com' }] });
    }
    return jsonResponse({
      has_more: false,
      results: [{
        id: '12345678-1234-1234-1234-123456789abc',
        url: 'https://notion.so/12345678123412341234123456789abc',
        created_time: '2026-07-01T00:00:00.000Z',
        last_edited_time: '2026-07-22T00:00:00.000Z',
        properties: {
          Page: { title: [{ plain_text: 'FLAURA2' }] },
          'Cancer type': { multi_select: [{ name: 'lung cancer' }] },
          'Gene tag': { multi_select: [{ name: 'EGFR' }] },
          Flashcard: { checkbox: true },
          subtype: { multi_select: [] },
          tag: { multi_select: [{ name: 'advance and meta' }] },
          '治療': { multi_select: [{ name: 'first line' }] },
          drug: { rich_text: [{ plain_text: 'osimertinib' }] },
        },
      }],
    });
  };

  try {
    const res = createResponse();
    await handler({ method: 'GET', headers: { authorization: 'Bearer firebase-id-token' }, url: '/api/notion-library' }, res);
    const payload = JSON.parse(res.body);
    assert.equal(res.statusCode, 200);
    assert.equal(payload.items[0].title, 'FLAURA2');
    assert.deepEqual(payload.items[0].cancerTypes, ['lung cancer']);
    assert.deepEqual(payload.items[0].genes, ['EGFR']);
    assert.equal(payload.items[0].flashcardCreated, true);
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /identitytoolkit/);
    assert.match(calls[1].url, /\/data_sources\//);
    assert.equal(calls[1].options.method, 'POST');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalPolicy === undefined) delete process.env.NOTION_ALLOWED_UIDS;
    else process.env.NOTION_ALLOWED_UIDS = originalPolicy;
    if (originalToken === undefined) delete process.env.NOTION_TOKEN;
    else process.env.NOTION_TOKEN = originalToken;
  }
});

test('returns structured rich blocks for a read-only page preview', async () => {
  const originalFetch = globalThis.fetch;
  const originalPolicy = process.env.NOTION_ALLOWED_UIDS;
  const originalToken = process.env.NOTION_TOKEN;
  process.env.NOTION_ALLOWED_UIDS = 'allowed-user';
  process.env.NOTION_TOKEN = 'server-only-test-token';
  const pageId = '12345678-1234-1234-1234-123456789abc';
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.includes('accounts:lookup')) {
      return jsonResponse({ users: [{ localId: 'allowed-user' }] });
    }
    if (value.endsWith(`/pages/${pageId}`)) {
      return jsonResponse({
        id: pageId,
        url: `https://notion.so/${pageId.replaceAll('-', '')}`,
        parent: { database_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
        properties: { Page: { title: [{ plain_text: 'Rich note' }] } },
      });
    }
    if (value.endsWith('/data_sources/105bb19a-c0c2-8160-aaab-000b49de9e79')) {
      return jsonResponse({
        id: '105bb19a-c0c2-8160-aaab-000b49de9e79',
        parent: { database_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
      });
    }
    if (value.includes(`/blocks/${pageId}/children`)) {
      return jsonResponse({
        has_more: false,
        results: [
          {
            id: 'heading',
            type: 'heading_2',
            has_children: false,
            heading_2: { rich_text: [{ plain_text: 'Treatment', annotations: { bold: true } }] },
          },
          {
            id: 'toggle',
            type: 'toggle',
            has_children: true,
            toggle: { rich_text: [{ plain_text: 'Details' }] },
          },
          {
            id: 'image',
            type: 'image',
            has_children: false,
            image: { file: { url: 'https://files.notion.so/image.png' }, caption: [{ plain_text: 'Figure 1' }] },
          },
        ],
      });
    }
    if (value.includes('/blocks/toggle/children')) {
      return jsonResponse({
        has_more: false,
        results: [{
          id: 'todo',
          type: 'to_do',
          has_children: false,
          to_do: { checked: true, rich_text: [{ plain_text: 'Review evidence' }] },
        }],
      });
    }
    throw new Error(`Unexpected request: ${value}`);
  };

  try {
    const res = createResponse();
    await handler({
      method: 'GET',
      headers: { authorization: 'Bearer firebase-id-token' },
      url: `/api/notion-library?pageId=${pageId}`,
    }, res);
    const payload = JSON.parse(res.body);
    assert.equal(res.statusCode, 200);
    assert.equal(payload.item.contentSchemaVersion, 2);
    assert.equal(payload.item.blocks[0].type, 'heading_2');
    assert.equal(payload.item.blocks[0].richText[0].annotations.bold, true);
    assert.equal(payload.item.blocks[1].children[0].type, 'to_do');
    assert.equal(payload.item.blocks[1].children[0].checked, true);
    assert.deepEqual(payload.item.assets, [{
      id: 'image',
      type: 'image',
      url: 'https://files.notion.so/image.png',
    }]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalPolicy === undefined) delete process.env.NOTION_ALLOWED_UIDS;
    else process.env.NOTION_ALLOWED_UIDS = originalPolicy;
    if (originalToken === undefined) delete process.env.NOTION_TOKEN;
    else process.env.NOTION_TOKEN = originalToken;
  }
});
