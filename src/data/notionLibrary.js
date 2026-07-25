import {
  getNotionCancerTypesForTrackerDomain,
  mapNotionCancerToTrackerDomain,
} from './notionTaxonomy.js';

const LIBRARY_CACHE_KEY = 'oncology-tracker.notion-library.v1';
const PREVIEW_CACHE_KEY = 'oncology-tracker.notion-preview.v2';
const LEGACY_PREVIEW_CACHE_KEY = 'oncology-tracker.notion-preview.v1';
const MAX_PREVIEW_CACHE_ITEMS = 20;

function unique(items = []) {
  const values = new Map();
  (items || []).forEach((item) => {
    const value = String(item || '').trim();
    if (value) values.set(value.toLowerCase(), value);
  });
  return [...values.values()];
}

function normalizeList(value = []) {
  if (Array.isArray(value)) return unique(value);
  return unique(String(value || '').split(',').map((item) => item.trim()));
}

export function normalizeNotionExternalUrl(value = '') {
  const url = String(value || '').trim();
  if (!url) return '';

  try {
    const parsed = new URL(url);
    if (parsed.hostname.toLowerCase() !== 'app.notion.com') return url;

    const compactId = parsed.pathname.match(/([0-9a-f]{32})(?:\/)?$/i)?.[1];
    const uuid = parsed.pathname.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/)?$/i)?.[1];
    const pageId = compactId || uuid?.replaceAll('-', '');
    if (!pageId) return url;

    return `https://www.notion.so/${pageId}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

export function normalizeNotionLibraryItem(item = {}) {
  const normalized = {
    id: item.id,
    sourceType: 'notion',
    source: item.source || 'Notion · Fellow training',
    title: item.title || 'Untitled',
    url: normalizeNotionExternalUrl(item.url),
    createdTime: item.createdTime || item.publishedAt || null,
    lastEditedTime: item.lastEditedTime || item.publishedAt || item.createdTime || null,
    fetchedAt: item.fetchedAt || null,
    cancerTypes: normalizeList(item.cancerTypes),
    subtypes: normalizeList(item.subtypes),
    tags: normalizeList(item.tags),
    treatments: normalizeList(item.treatments),
    genes: normalizeList(item.genes),
    drugs: normalizeList(item.drugs),
    nccn: item.nccn || null,
    trackerId: item.trackerId || '',
    flashcardCreated: Boolean(item.flashcardCreated),
    plainText: item.plainText || '',
    headings: Array.isArray(item.headings) ? item.headings : [],
    blocks: Array.isArray(item.blocks) ? item.blocks : [],
    assets: Array.isArray(item.assets) ? item.assets : [],
    contentSchemaVersion: Number(item.contentSchemaVersion) || 1,
    truncated: Boolean(item.truncated),
  };
  normalized.searchText = [
    normalized.title,
    normalized.trackerId,
    ...normalized.cancerTypes,
    ...normalized.subtypes,
    ...normalized.tags,
    ...normalized.treatments,
    ...normalized.genes,
    ...normalized.drugs,
    normalized.plainText,
  ].filter(Boolean).join(' ').toLowerCase();
  return normalized;
}

export function normalizeNotionLibraryItems(items = []) {
  return [...new Map((items || [])
    .map(normalizeNotionLibraryItem)
    .filter((item) => item.id && item.url)
    .map((item) => [item.id, item])).values()];
}

function readStorage(storage, key) {
  try {
    return JSON.parse(storage?.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function writeStorage(storage, key, payload) {
  try {
    storage?.setItem(key, JSON.stringify(payload));
  } catch {
    // Storage is an optional cache; a quota/privacy failure must not block Knowledge Hub.
  }
}

export function loadNotionLibraryCache() {
  if (typeof window === 'undefined') return null;
  const cached = readStorage(window.localStorage, LIBRARY_CACHE_KEY);
  if (!cached?.items?.length) return null;
  return { ...cached, items: normalizeNotionLibraryItems(cached.items) };
}

export function saveNotionLibraryCache(payload) {
  if (typeof window === 'undefined') return;
  writeStorage(window.localStorage, LIBRARY_CACHE_KEY, {
    items: normalizeNotionLibraryItems(payload.items),
    fetchedAt: payload.fetchedAt || new Date().toISOString(),
    truncated: Boolean(payload.truncated),
  });
}

export function loadNotionPreviewCache(pageId) {
  if (typeof window === 'undefined') return null;
  const cache = readStorage(window.sessionStorage, PREVIEW_CACHE_KEY) || {};
  if (cache[pageId]) return normalizeNotionLibraryItem(cache[pageId]);
  const legacyCache = readStorage(window.sessionStorage, LEGACY_PREVIEW_CACHE_KEY) || {};
  return legacyCache[pageId] ? normalizeNotionLibraryItem(legacyCache[pageId]) : null;
}

export function saveNotionPreviewCache(item) {
  if (typeof window === 'undefined' || !item?.id) return;
  const cache = readStorage(window.sessionStorage, PREVIEW_CACHE_KEY) || {};
  cache[item.id] = normalizeNotionLibraryItem(item);
  const trimmed = Object.entries(cache)
    .sort((a, b) => new Date(b[1].lastEditedTime || 0) - new Date(a[1].lastEditedTime || 0))
    .slice(0, MAX_PREVIEW_CACHE_ITEMS);
  writeStorage(window.sessionStorage, PREVIEW_CACHE_KEY, Object.fromEntries(trimmed));
}

function includesAny(values = [], aliases = []) {
  const normalizedValues = values.map((value) => String(value).toLowerCase());
  return aliases.some((alias) => normalizedValues.includes(String(alias).toLowerCase()));
}

export { mapNotionCancerToTrackerDomain };

function meaningfulTerms(values = []) {
  return unique(values)
    .map((value) => value.toLowerCase().replace(/^#/, '').trim())
    .filter((value) => value.length >= 3);
}

export function scoreNotionNoteForTopic(note, topic) {
  if (!note || !topic) return 0;
  const noteText = note.searchText || normalizeNotionLibraryItem(note).searchText;
  const cancerAliases = getNotionCancerTypesForTrackerDomain(topic.cancer);
  const sameCancer = includesAny(note.cancerTypes || [], cancerAliases);
  const trials = meaningfulTerms(topic.trials || topic.task?.goldenTrials || []);
  const focusTerms = meaningfulTerms([
    ...(topic.focusTags || []),
    ...(topic.task?.focusTags || []),
    ...(topic.task?.details || '').split(/[,;/]/),
  ]);
  const titleTerms = meaningfulTerms(String(topic.title || '').split(/\s+|\//));
  const trialHits = trials.filter((term) => noteText.includes(term)).length;
  const focusHits = focusTerms.filter((term) => noteText.includes(term)).length;
  const titleHits = titleTerms.filter((term) => noteText.includes(term)).length;
  const geneHits = (note.genes || []).filter((gene) => (
    focusTerms.includes(String(gene).toLowerCase()) || String(topic.details || '').toLowerCase().includes(String(gene).toLowerCase())
  )).length;
  if (!sameCancer && trialHits === 0 && focusHits < 2) return 0;
  return (sameCancer ? 60 : 0)
    + (trialHits * 55)
    + (focusHits * 16)
    + (titleHits * 10)
    + (geneHits * 24);
}

export function getLinkedNotionNotes(notes = [], topic, limit = 16) {
  return (notes || [])
    .map((note) => ({ ...note, topicMatchScore: scoreNotionNoteForTopic(note, topic) }))
    .filter((note) => note.topicMatchScore >= 90)
    .sort((a, b) => b.topicMatchScore - a.topicMatchScore
      || new Date(b.lastEditedTime || 0) - new Date(a.lastEditedTime || 0))
    .slice(0, limit);
}

export function filterNotionLibrary(notes = [], filters = {}) {
  const query = String(filters.query || '').trim().toLowerCase();
  return (notes || []).filter((note) => (
    (!query || note.searchText.includes(query))
    && (!filters.cancer || filters.cancer === 'All' || note.cancerTypes.includes(filters.cancer))
    && (!filters.gene || filters.gene === 'All' || note.genes.includes(filters.gene))
    && (!filters.type || filters.type === 'All' || inferNotionNoteType(note) === filters.type)
    && (filters.flashcard === 'All'
      || (filters.flashcard === 'Ready' && note.flashcardCreated)
      || (filters.flashcard === 'Missing' && !note.flashcardCreated))
  ));
}

export function sortNotionLibrary(notes = [], sort = 'updated') {
  const items = [...(notes || [])];
  if (sort === 'title') {
    return items.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh-Hant'));
  }
  if (sort === 'needs-cards') {
    return items.sort((a, b) => Number(a.flashcardCreated) - Number(b.flashcardCreated)
      || new Date(b.lastEditedTime || b.createdTime || 0) - new Date(a.lastEditedTime || a.createdTime || 0));
  }
  return items.sort((a, b) => new Date(b.lastEditedTime || b.createdTime || 0)
    - new Date(a.lastEditedTime || a.createdTime || 0));
}

export function buildNotionNoteSections(note = {}) {
  const plainText = String(note.plainText || '').trim();
  const headings = (note.headings || [])
    .filter((heading) => heading?.text)
    .map((heading, index) => ({
      id: heading.id || `heading-${index + 1}`,
      level: Number(heading.level) || 2,
      title: String(heading.text).trim(),
    }));
  if (!plainText || !headings.length) {
    return plainText ? [{ id: 'note-start', level: 1, title: note.title || '筆記內容', body: plainText }] : [];
  }

  const lowerText = plainText.toLowerCase();
  let cursor = 0;
  const located = headings.map((heading) => {
    let start = plainText.indexOf(heading.title, cursor);
    if (start < 0) start = lowerText.indexOf(heading.title.toLowerCase(), cursor);
    if (start < 0) return null;
    cursor = start + heading.title.length;
    return { ...heading, start, contentStart: cursor };
  }).filter(Boolean);

  if (!located.length) {
    return [{ id: 'note-start', level: 1, title: note.title || '筆記內容', body: plainText }];
  }

  const sections = [];
  if (located[0].start > 0) {
    sections.push({
      id: 'note-introduction',
      level: 1,
      title: note.title || '摘要',
      body: plainText.slice(0, located[0].start).trim(),
    });
  }
  located.forEach((heading, index) => {
    sections.push({
      id: heading.id,
      level: heading.level,
      title: heading.title,
      body: plainText.slice(heading.contentStart, located[index + 1]?.start ?? plainText.length).trim(),
    });
  });
  return sections.filter((section) => section.title || section.body);
}

export function inferNotionNoteType(note = {}) {
  const text = String(note.title || '').toLowerCase();
  if (/trial|study|phase\s*[123]|研究/.test(text)) return 'Trial Note';
  if (/toxicity|toxic|副作用|不良反應|irae/.test(text)) return 'Toxicity';
  if (/algorithm|sequenc|流程|治療選擇/.test(text)) return 'Algorithm';
  if (/rapid|review|重點|整理/.test(text)) return 'Rapid Review';
  return 'Master Note';
}
