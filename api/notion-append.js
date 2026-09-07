import { verifyFirebaseRequest, notionFetch, assertLibraryPage, sendJson, DEFAULT_DATA_SOURCE_ID } from './notion-library.js';

export function makeSupplementBlocks(text, now = new Date()) {
  const chunks = [];
  // Split by Unicode code point so long notes and emoji stay valid rich text.
  let chunk = '';
  for (const character of text) {
    if (chunk.length + character.length > 1900) { chunks.push(chunk); chunk = ''; }
    chunk += character;
  }
  if (chunk) chunks.push(chunk);
  const richText = (content) => [{ type: 'text', text: { content } }];
  return [
    { object: 'block', type: 'heading_3', heading_3: { rich_text: richText(`複習補充 · ${now.toISOString()}`) } },
    ...chunks.map((content) => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: richText(content) } })),
  ];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
  let writeStarted = false;
  try {
    await verifyFirebaseRequest(req);
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return sendJson(res, 400, { message: '補充筆記格式錯誤。' }); }
    }
    const { pageId, text } = body || {};
    if (typeof pageId !== 'string' || !/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(pageId)
      || typeof text !== 'string' || !text.trim() || text.length > 10000) {
      return sendJson(res, 400, { message: '請指定有效的筆記頁面，並輸入 1–10,000 字的補充內容。' });
    }
    const page = await notionFetch(`/pages/${pageId}`);
    await assertLibraryPage(page, process.env.NOTION_DATA_SOURCE_ID || DEFAULT_DATA_SOURCE_ID);
    if (page.archived || page.in_trash) return sendJson(res, 409, { message: '這篇筆記已封存或刪除，無法新增補充。' });
    writeStarted = true;
    await notionFetch(`/blocks/${pageId}/children`, {
      method: 'PATCH', body: JSON.stringify({ children: makeSupplementBlocks(text.trim()) }),
    });
    return sendJson(res, 200, { saved: true, pageId });
  } catch (error) {
    // A timeout or server error after dispatch can mean the write succeeded.
    // Never silently retry an append: preserve the draft for manual verification.
    const uncertain = writeStarted && (!error.status || error.status >= 500);
    return sendJson(res, error.status || 502, {
      error: error.code || 'notion_append_failed', uncertain,
      message: uncertain ? '尚無法確認是否已寫入，請先在 Notion 查看文末；請勿直接重送。' : error.message || '儲存失敗，補充草稿已保留。',
    });
  }
}
