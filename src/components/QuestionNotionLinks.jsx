import { createContext, useContext, useState } from 'react';
import { getLinkedNotionNotes, normalizeNotionExternalUrl } from '../data/notionLibrary.js';

// Shared by question cards, the question manager and mock review.
// eslint-disable-next-line react-refresh/only-export-components
export const QuestionNotesContext = createContext(null);

function safeNotionUrl(value) {
  try {
    const url = new URL(normalizeNotionExternalUrl(value));
    return url.protocol === 'https:' && /(^|\.)(notion\.so|notion\.site|notion\.com)$/.test(url.hostname) ? url.href : '';
  } catch { return ''; }
}

export default function QuestionNotionLinks({ question }) {
  const context = useContext(QuestionNotesContext);
  const [url, setUrl] = useState('');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  if (!context) return null;
  const stat = context.stats[question.id] || {};
  const saved = stat.notionLinks || [];
  const links = [...new Set([question.notionUrl, ...saved].map(safeNotionUrl).filter(Boolean))];
  const notes = context.items || [];
  const related = query.trim()
    ? notes.filter((note) => `${note.title} ${note.searchText || ''}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
    : getLinkedNotionNotes(notes, { cancer: question.cancer, title: question.topic, trials: question.trials || [], focusTags: question.tags?.biomarker || [], details: question.stem }, 4);
  const add = (value) => {
    const normalized = safeNotionUrl(value);
    if (!normalized) { setMessage('請輸入有效的 HTTPS Notion 頁面網址。'); return; }
    context.onSave(question.id, [...new Set([...saved, normalized])]);
    setUrl('');
    setMessage('已儲存題目連結。');
  };
  return <details className="question-notion-links">
    <summary>相關 Notion · {links.length} 個連結</summary>
    {links.map((link) => <div className="inline-actions" key={link}>
      <a href={link} target="_blank" rel="noreferrer">{notes.find((note) => safeNotionUrl(note.url) === link)?.title || '開啟 Notion 筆記'}</a>
      {saved.includes(link) && <button className="tiny" type="button" onClick={() => context.onSave(question.id, saved.filter((value) => value !== link))}>移除連結</button>}
    </div>)}
    <div className="inline-actions">
      <input aria-label="Notion 頁面網址" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="貼上 https://www.notion.so/..." />
      <button className="secondary" type="button" onClick={() => add(url)}>新增連結</button>
    </div>
    <input aria-label="搜尋 Notion 筆記" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋已同步的 Notion 筆記" />
    <p className="muted">{query ? '搜尋結果' : '可能相關的筆記（請確認內容後連結）'}</p>
    {related.map((note) => <div className="inline-actions" key={note.id}><a href={safeNotionUrl(note.url)} target="_blank" rel="noreferrer">{note.title}</a><button className="tiny" type="button" disabled={links.includes(safeNotionUrl(note.url))} onClick={() => add(note.url)}>連結此題</button></div>)}
    {!related.length && <p className="muted">沒有符合的筆記；可直接貼網址，或到 Knowledge Hub 同步筆記。</p>}
    {message && <p role="status">{message}</p>}
  </details>;
}
