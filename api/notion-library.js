const DEFAULT_DATA_SOURCE_ID = '105bb19a-c0c2-8160-aaab-000b49de9e79';
const DEFAULT_NOTION_VERSION = '2025-09-03';
const DEFAULT_FIREBASE_API_KEY = 'AIzaSyAIHA_tbHQbK7-7mQrPA-Y2RMN7c-FZrIk';
const MAX_QUERY_PAGES = 10;
const MAX_CONTENT_BLOCKS = 500;
const MAX_CONTENT_DEPTH = 4;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'private, no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.end(JSON.stringify(payload));
}

function parseAllowList(value = '') {
  return new Set(String(value).split(',').map((item) => item.trim().toLowerCase()).filter(Boolean));
}

function getBearerToken(req) {
  const header = String(req.headers?.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

async function verifyFirebaseRequest(req) {
  const allowedUids = parseAllowList(process.env.NOTION_ALLOWED_UIDS);
  const allowedEmails = parseAllowList(process.env.NOTION_ALLOWED_EMAILS);
  if (!allowedUids.size && !allowedEmails.size) {
    const error = new Error('Notion library access policy is not configured.');
    error.status = 503;
    error.code = 'missing_notion_access_policy';
    throw error;
  }

  const idToken = getBearerToken(req);
  if (!idToken) {
    const error = new Error('Sign in to Cloud Sync before syncing Fellow training.');
    error.status = 401;
    error.code = 'missing_firebase_token';
    throw error;
  }

  const firebaseApiKey = process.env.FIREBASE_WEB_API_KEY
    || process.env.VITE_FIREBASE_API_KEY
    || DEFAULT_FIREBASE_API_KEY;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const payload = await response.json().catch(() => ({}));
  const account = payload.users?.[0];
  if (!response.ok || !account?.localId) {
    const error = new Error('Your Cloud Sync session has expired. Please sign in again.');
    error.status = 401;
    error.code = 'invalid_firebase_token';
    throw error;
  }

  const uidAllowed = allowedUids.has(String(account.localId).toLowerCase());
  const emailAllowed = allowedEmails.has(String(account.email || '').toLowerCase());
  if (!uidAllowed && !emailAllowed) {
    const error = new Error('This account is not allowed to read the Fellow training library.');
    error.status = 403;
    error.code = 'notion_library_forbidden';
    throw error;
  }

  return { uid: account.localId, email: account.email || '' };
}

function textFromRichText(parts = []) {
  return (parts || []).map((part) => part?.plain_text || part?.text?.content || '').join('');
}

function propTitle(prop) {
  return textFromRichText(prop?.title || []);
}

function propMultiSelect(prop) {
  return (prop?.multi_select || []).map((item) => item.name).filter(Boolean);
}

function propText(prop) {
  if (!prop) return '';
  if (prop.rich_text) return textFromRichText(prop.rich_text);
  if (prop.url) return prop.url;
  if (typeof prop === 'string') return prop;
  return '';
}

function normalizeNotionPage(page) {
  const properties = page?.properties || {};
  return {
    id: page.id,
    sourceType: 'notion',
    source: 'Notion · Fellow training',
    title: propTitle(properties.Page) || propTitle(properties.Name) || page.id || 'Untitled',
    url: page.url,
    createdTime: page.created_time || null,
    lastEditedTime: page.last_edited_time || null,
    cancerTypes: propMultiSelect(properties['Cancer type']),
    subtypes: propMultiSelect(properties.subtype),
    tags: propMultiSelect(properties.tag),
    treatments: propMultiSelect(properties['治療']),
    genes: propMultiSelect(properties['Gene tag']),
    drugs: propText(properties.drug).split(',').map((value) => value.trim()).filter(Boolean),
    nccn: propText(properties.NCCN) || null,
    trackerId: propText(properties['userDefined:ID']) || propText(properties.ID) || '',
    flashcardCreated: Boolean(properties.Flashcard?.checkbox),
  };
}

async function notionFetch(path, options = {}) {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    const error = new Error('NOTION_TOKEN is not configured.');
    error.status = 503;
    error.code = 'missing_notion_token';
    throw error;
  }
  const notionVersion = process.env.NOTION_VERSION || DEFAULT_NOTION_VERSION;
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'notion-version': notionVersion,
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || 'Notion request failed.');
    error.status = response.status;
    error.code = payload.code || 'notion_request_failed';
    throw error;
  }
  return payload;
}

async function listLibraryPages() {
  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID || DEFAULT_DATA_SOURCE_ID;
  const items = [];
  let cursor = null;
  let pageCount = 0;

  do {
    const payload = await notionFetch(`/data_sources/${dataSourceId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        page_size: 100,
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });
    items.push(...(payload.results || []).map(normalizeNotionPage));
    cursor = payload.has_more ? payload.next_cursor : null;
    pageCount += 1;
  } while (cursor && pageCount < MAX_QUERY_PAGES);

  return {
    items,
    truncated: Boolean(cursor),
    fetchedAt: new Date().toISOString(),
    source: 'live',
  };
}

function normalizeId(value = '') {
  return String(value).replace(/-/g, '').toLowerCase();
}

function assertLibraryPage(page, dataSourceId) {
  const parentId = page?.parent?.data_source_id || page?.parent?.database_id || '';
  if (!parentId || normalizeId(parentId) !== normalizeId(dataSourceId)) {
    const error = new Error('The requested page is not part of Fellow training.');
    error.status = 404;
    error.code = 'notion_page_outside_library';
    throw error;
  }
}

function blockPlainText(block) {
  const value = block?.[block?.type];
  if (!value) return '';
  if (Array.isArray(value.rich_text)) return textFromRichText(value.rich_text);
  if (block.type === 'child_page' || block.type === 'child_database') return value.title || '';
  if (block.type === 'table_row') {
    return (value.cells || []).map((cell) => textFromRichText(cell)).join(' | ');
  }
  return '';
}

async function collectBlockContent(blockId, state, depth = 0) {
  if (state.blockCount >= MAX_CONTENT_BLOCKS || depth > MAX_CONTENT_DEPTH) return;
  let cursor = null;
  do {
    const params = new URLSearchParams({ page_size: '100' });
    if (cursor) params.set('start_cursor', cursor);
    const payload = await notionFetch(`/blocks/${blockId}/children?${params.toString()}`);
    for (const block of payload.results || []) {
      if (state.blockCount >= MAX_CONTENT_BLOCKS) break;
      state.blockCount += 1;
      const text = blockPlainText(block).trim();
      if (text) {
        state.lines.push(text);
        if (['heading_1', 'heading_2', 'heading_3'].includes(block.type)) {
          state.headings.push({
            id: block.id,
            level: Number(block.type.slice(-1)),
            text,
          });
        }
      }
      if (block.has_children && depth < MAX_CONTENT_DEPTH) {
        await collectBlockContent(block.id, state, depth + 1);
      }
    }
    cursor = payload.has_more && state.blockCount < MAX_CONTENT_BLOCKS ? payload.next_cursor : null;
  } while (cursor);
}

async function getLibraryPagePreview(pageId) {
  if (!/^[0-9a-f-]{32,36}$/i.test(pageId)) {
    const error = new Error('Invalid Notion page ID.');
    error.status = 400;
    error.code = 'invalid_notion_page_id';
    throw error;
  }
  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID || DEFAULT_DATA_SOURCE_ID;
  const page = await notionFetch(`/pages/${pageId}`);
  assertLibraryPage(page, dataSourceId);
  const normalized = normalizeNotionPage(page);
  const state = { lines: [], headings: [], blockCount: 0 };
  await collectBlockContent(page.id, state);
  return {
    ...normalized,
    plainText: state.lines.join('\n\n'),
    headings: state.headings,
    blockCount: state.blockCount,
    truncated: state.blockCount >= MAX_CONTENT_BLOCKS,
    fetchedAt: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  try {
    await verifyFirebaseRequest(req);
    const requestUrl = new URL(req.url, 'http://localhost');
    const pageId = requestUrl.searchParams.get('pageId');
    if (pageId) {
      const item = await getLibraryPagePreview(pageId);
      sendJson(res, 200, { item, source: 'live' });
      return;
    }
    const payload = await listLibraryPages();
    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, error.status || 502, {
      error: error.code || 'notion_library_failed',
      message: error.message || 'Unable to read Fellow training.',
    });
  }
}
