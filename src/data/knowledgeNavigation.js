export function getKnowledgePageId(note = {}) {
  const id = String(note.id || '');
  if (/^(?:[0-9a-f]{32}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i.test(id)) return id.replaceAll('-', '').toLowerCase();
  try {
    const url = new URL(note.url);
    if (url.protocol !== 'https:' || !/(^|\.)(notion\.so|notion\.site|notion\.com)$/.test(url.hostname)) return '';
    const match = url.pathname.match(/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|[0-9a-f]{32})\/?$/i);
    return match?.[1]?.replaceAll('-', '').toLowerCase() || '';
  } catch { return ''; }
}

export function jumpToKnowledgeSection(panel, sectionId) {
  const target = Array.from(panel?.querySelectorAll('[data-note-anchor]') || [])
    .find((element) => element.dataset.noteAnchor === sectionId);
  if (!target) return false;
  // A heading may live inside one or more collapsed Notion toggles.
  for (let parent = target.parentElement; parent && parent !== panel; parent = parent.parentElement) {
    if (parent.tagName === 'DETAILS') parent.open = true;
  }
  target.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}
