export function getWrongAnswerRows(questions, stats, { query = '', cancer = 'All', period = 'all', status = 'all', sort = 'recent', today } = {}) {
  return questions.flatMap((q) => {
    const stat = stats[q.id] || {};
    if (!(stat.wrong > 0)) return [];
    const lastWrong = (stat.answerHistory || []).filter((event) => event.isCorrect === false)
      .map((event) => event.submittedAt || event.date || '').sort().at(-1)
      || (stat.lastResult === 'wrong' ? stat.lastAttemptAt : '') || '';
    if (cancer !== 'All' && q.cancer !== cancer) return [];
    if (status === 'pending' && stat.lastResult === 'correct') return [];
    if (status === 'corrected' && stat.lastResult !== 'correct') return [];
    if (period !== 'all') {
      const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastWrong.slice(0, 10)}T00:00:00Z`)) / 86400000);
      if (!Number.isFinite(days) || days < 0 || days >= Number(period)) return [];
    }
    if (query && !`${q.id} ${q.stem} ${q.cancer} ${q.topic} ${stat.wrongNotes || ''}`.toLowerCase().includes(query.trim().toLowerCase())) return [];
    return [{ q, stat, lastWrong }];
  }).sort((a, b) => (sort === 'wrong' ? b.stat.wrong - a.stat.wrong : b.lastWrong.localeCompare(a.lastWrong)) || a.q.id.localeCompare(b.q.id));
}

export function gradeWrongAnswerBatch(questions, drafts, stats, submittedAt) {
  return questions.map((q) => {
    const draft = drafts[q.id] || {};
    const stat = stats[q.id] || {};
    const correctAnswer = String(draft.correctAnswer ?? (stat.correctAnswer || q.answer) ?? '').trim().toUpperCase();
    const selected = String(draft.selected || '').trim().toUpperCase();
    return { questionId: q.id, selected, correctAnswer,
      isCorrect: /^[A-E]$/.test(correctAnswer) ? selected === correctAnswer : null,
      confidence: Number(draft.confidence) || 3, errorType: draft.errorType || '',
      explanation: draft.explanation ?? stat.explanation ?? q.explanation ?? '',
      wrongNotes: draft.wrongNotes ?? stat.wrongNotes ?? '', cancer: q.cancer, topic: q.topic, submittedAt };
  });
}
