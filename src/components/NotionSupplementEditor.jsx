import { useRef, useState } from 'react';
import { auth } from '../firebase.js';
import { appendNotionSupplement } from '../data/notionLibraryClient.js';

export default function NotionSupplementEditor({ pageId, title, onSaved }) {
  const key = `oncology-tracker.notion-supplement.${auth.currentUser?.uid || 'guest'}.${pageId}`;
  const [draft, setDraft] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(key)) || { text: '', phase: 'draft' }; }
    catch { return { text: '', phase: 'draft' }; }
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [savedText, setSavedText] = useState('');
  const submitting = useRef(false);
  const persist = (next) => {
    // Store intent before sending. Closing the reader mid-request must not enable a blind retry.
    sessionStorage.setItem(key, JSON.stringify(next));
    setDraft(next);
  };
  const submit = async () => {
    if (submitting.current || draft.phase !== 'draft' || !draft.text.trim()) return;
    if (!auth.currentUser) { setMessage('請先登入 Cloud Sync，再儲存到 Notion。'); return; }
    submitting.current = true;
    setBusy(true);
    try {
      persist({ ...draft, phase: 'sending' });
    } catch {
      setMessage('無法保存補充草稿，尚未送出。請先複製內容備份。');
      submitting.current = false;
      setBusy(false);
      return;
    }
    try {
      await appendNotionSupplement(pageId, draft.text);
    } catch (error) {
      const next = { ...draft, phase: error.uncertain ? 'uncertain' : 'draft' };
      setDraft(next);
      try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* Existing sending draft remains conservative. */ }
      setMessage(error.message);
      submitting.current = false;
      setBusy(false);
      return;
    }
    setSavedText(draft.text);
    const saved = { text: '', phase: 'draft' };
    setDraft(saved);
    try { sessionStorage.removeItem(key); } catch { /* Do not report a successful write as failed. */ }
    setMessage('已附加到 Notion 文末，正在重新載入筆記…');
    try {
      await onSaved();
      setMessage('已儲存到 Notion，筆記內容已更新。');
    } catch {
      setMessage('已儲存到 Notion，但重新載入失敗。請重新開啟筆記；不需要再送出。');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const unresolved = draft.phase === 'sending' || draft.phase === 'uncertain';
  return <section className="notion-supplement">
    <h4>新增補充筆記</h4>
    <p>儲存後會附加到「{title || '這篇筆記'}」文末，原文保持不變。以純文字記錄考點、錯因或待查證事項。</p>
    <textarea aria-label="補充筆記內容" maxLength={10000} value={draft.text} disabled={busy || unresolved} placeholder="例如：這題的判斷關鍵、容易混淆的選項、下次複習提醒…" onChange={(event) => {
      const next = { text: event.target.value, phase: 'draft' };
      setDraft(next);
      try { sessionStorage.setItem(key, JSON.stringify(next)); }
      catch { setMessage('無法暫存草稿，關閉前請先複製內容。'); }
    }} />
    <div className="inline-actions">
      <button type="button" className="primary" disabled={busy || unresolved || !draft.text.trim()} onClick={submit}>{busy ? '儲存中…' : '儲存到 Notion'}</button>
      <small>{draft.text.length} / 10,000</small>
    </div>
    {unresolved && !busy && <div role="status"><p>上次送出結果尚待確認。請先查看 Notion 文末，確認是否已收到這段補充。</p><a href={`https://www.notion.so/${pageId.replaceAll('-', '')}`} target="_blank" rel="noreferrer">在 Notion 查看 ↗</a><button className="secondary" type="button" onClick={() => {
      try { persist({ text: '', phase: 'draft' }); setMessage('已清除待確認草稿，可新增下一段補充。'); }
      catch { setMessage('無法清除草稿，請稍後再試。'); }
    }}>已在 Notion 確認，清除這份草稿</button></div>}
    {message && <p role="status">{message}</p>}
    {savedText && <details open><summary>本次已儲存的補充</summary><p style={{ whiteSpace: 'pre-wrap' }}>{savedText}</p></details>}
  </section>;
}
