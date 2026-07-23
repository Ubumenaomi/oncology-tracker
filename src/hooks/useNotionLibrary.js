import { useCallback, useEffect, useRef, useState } from 'react';

import {
  loadNotionLibraryCache,
  loadNotionPreviewCache,
  normalizeNotionLibraryItems,
  saveNotionLibraryCache,
  saveNotionPreviewCache,
} from '../data/notionLibrary.js';
import { fetchNotionLibrary, fetchNotionPagePreview } from '../data/notionLibraryClient.js';

function makeInitialLibraryState(fallbackItems) {
  const cached = loadNotionLibraryCache();
  if (cached?.items?.length) {
    return {
      items: cached.items,
      status: 'cached',
      error: '',
      fetchedAt: cached.fetchedAt,
      truncated: Boolean(cached.truncated),
      source: 'cache',
    };
  }
  return {
    items: normalizeNotionLibraryItems(fallbackItems),
    status: 'idle',
    error: '',
    fetchedAt: null,
    truncated: false,
    source: 'snapshot',
  };
}

export function getNotionPageId(note = {}) {
  const id = String(note.id || '');
  if (/^[0-9a-f-]{32,36}$/i.test(id)) return id;
  return String(note.url || '').match(/([0-9a-f]{32})(?:[?/#]|$)/i)?.[1] || '';
}

export function useNotionLibrary({ user, fallbackItems = [], enabled = false } = {}) {
  const [libraryState, setLibraryState] = useState(() => makeInitialLibraryState(fallbackItems));
  const [notePreview, setNotePreview] = useState({ id: '', title: '', status: 'idle', item: null, error: '' });
  const autoSyncedUserRef = useRef('');

  const syncLibrary = useCallback(async () => {
    if (!user) {
      setLibraryState((prev) => ({ ...prev, status: 'error', error: '請先登入 Cloud Sync，再同步 Fellow training。' }));
      return { ok: false };
    }
    setLibraryState((prev) => ({ ...prev, status: 'loading', error: '' }));
    try {
      const payload = await fetchNotionLibrary();
      saveNotionLibraryCache(payload);
      setLibraryState({
        items: payload.items,
        status: 'ready',
        error: '',
        fetchedAt: payload.fetchedAt,
        truncated: Boolean(payload.truncated),
        source: 'live',
      });
      return { ok: true };
    } catch (error) {
      setLibraryState((prev) => ({
        ...prev,
        status: 'error',
        error: error.message || 'Fellow training 同步失敗，已保留 cached library。',
      }));
      return { ok: false };
    }
  }, [user]);

  const openNotePreview = useCallback(async (note) => {
    const pageId = getNotionPageId(note);
    if (!pageId) return { ok: false };
    const cached = loadNotionPreviewCache(pageId);
    if (cached?.plainText) {
      setNotePreview({ id: pageId, title: note.title, status: 'ready', item: cached, error: '' });
      return { ok: true, source: 'cache' };
    }
    setNotePreview({ id: pageId, title: note.title, status: 'loading', item: null, error: '' });
    try {
      const preview = await fetchNotionPagePreview(pageId);
      saveNotionPreviewCache(preview);
      setNotePreview({ id: pageId, title: preview.title, status: 'ready', item: preview, error: '' });
      setLibraryState((prev) => ({
        ...prev,
        items: prev.items.map((item) => item.id === preview.id ? { ...item, ...preview } : item),
      }));
      return { ok: true, source: 'live' };
    } catch (error) {
      setNotePreview({ id: pageId, title: note.title, status: 'error', item: null, error: error.message || '筆記預覽載入失敗。' });
      return { ok: false };
    }
  }, []);

  const closeNotePreview = useCallback(() => {
    setNotePreview({ id: '', title: '', status: 'idle', item: null, error: '' });
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      autoSyncedUserRef.current = '';
      return;
    }
    if (!enabled || autoSyncedUserRef.current === user.uid) return;
    autoSyncedUserRef.current = user.uid;
    syncLibrary();
  }, [enabled, syncLibrary, user?.uid]);

  return {
    libraryState,
    notePreview,
    syncLibrary,
    openNotePreview,
    closeNotePreview,
  };
}
