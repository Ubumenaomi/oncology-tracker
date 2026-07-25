import { auth } from '../firebase.js';
import { normalizeNotionLibraryItem, normalizeNotionLibraryItems } from './notionLibrary.js';

async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error('請先登入 Cloud Sync，再同步 Fellow training。');
  const idToken = await user.getIdToken();
  return { authorization: `Bearer ${idToken}` };
}

async function readLibraryResponse(url) {
  const headers = await getAuthHeaders();
  const response = await fetch(url, { headers, cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || 'Fellow training 同步失敗。');
  return payload;
}

export async function fetchNotionLibrary() {
  const payload = await readLibraryResponse(`/api/notion-library?sync=${Date.now()}`);
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error('Fellow training 沒有回傳有效索引，已保留 cached library。');
  }
  return { ...payload, items: normalizeNotionLibraryItems(payload.items) };
}

export async function fetchNotionPagePreview(pageId) {
  const payload = await readLibraryResponse(`/api/notion-library?pageId=${encodeURIComponent(pageId)}`);
  if (!payload.item?.id) throw new Error('Fellow training 沒有回傳有效的筆記預覽。');
  return normalizeNotionLibraryItem(payload.item);
}
