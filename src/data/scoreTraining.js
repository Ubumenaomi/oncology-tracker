export const TRAINING_MODES = [
  { id: 'mixed', title: '綜合測驗', detail: '從符合條件的題目隨機抽題，搭配計時即可模擬考試。' },
  { id: 'smart', title: '智慧提分', detail: '優先補漏洞，再穿插未練題，避免只記住答案。' },
  { id: 'repair', title: '弱點修復', detail: '最近答錯與低信心答對，集中練到能說明理由。' },
  { id: 'due', title: '到期複習', detail: '依既有複習排程，檢查隔一段時間是否仍記得。' },
  { id: 'unseen', title: '新題檢測', detail: '只出尚未練過的題目，檢查知識能否轉移。' },
];

export function getTrainingRows(questions, stats = {}, today, mode = 'smart') {
  return questions.flatMap((q) => {
    const stat = stats[q.id] || {};
    // Exclude questions without a usable answer from scored training.
    const answer = String(stat.correctAnswer || q.answer || '').trim().toUpperCase();
    if (!/^[A-E]$/.test(answer)) return [];
    const latest = (stat.answerHistory || []).at(-1);
    const wrong = latest?.isCorrect === false || (!latest && stat.lastResult === 'wrong');
    const confidence = Number(latest?.confidence ?? stat.confidenceHistory?.at(-1));
    const uncertain = (latest?.isCorrect === true || (!latest && stat.lastResult === 'correct')) && confidence > 0 && confidence <= 2;
    const due = Boolean(stat.nextReviewDate && stat.nextReviewDate <= today);
    const unseen = !(stat.attempts > 0) && !latest;
    if (mode === 'repair' && !wrong && !uncertain) return [];
    if (mode === 'due' && !due) return [];
    if (mode === 'unseen' && !unseen) return [];
    const reason = wrong ? (confidence >= 4 ? '高信心答錯' : '最近答錯') : uncertain ? '答對但不確定' : due ? '到期複習' : unseen ? '尚未練過' : '維持熟練';
    const priority = (wrong ? 100 + Math.min(stat.wrong || 0, 5) * 5 + (confidence >= 4 ? 30 : 0) : 0) + (uncertain ? 70 : 0) + (due ? 40 : 0) + (unseen ? 20 : 0);
    return [{ q, stat, reason, priority, unseen }];
  }).sort((a, b) => b.priority - a.priority || String(a.stat.lastAttemptAt || '').localeCompare(String(b.stat.lastAttemptAt || '')) || a.q.id.localeCompare(b.q.id));
}

export function selectTrainingIds(rows, count, mode) {
  if (mode === 'mixed') {
    const shuffled = [...rows];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count).map(({ q }) => q.id);
  }
  if (mode !== 'smart') return rows.slice(0, count).map(({ q }) => q.id);
  const fresh = rows.filter((row) => row.unseen).slice(0, Math.floor(count / 3));
  const freshIds = new Set(fresh.map(({ q }) => q.id));
  return [...rows.filter(({ q }) => !freshIds.has(q.id)).slice(0, count - fresh.length), ...fresh].map(({ q }) => q.id);
}
