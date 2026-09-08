export const HISTORY_PREFIX = 'history:';
export function practiceIdentity(session, key) {
  return session?.attemptId || (session?.questionIds?.length ? `legacy-${key}-${session.createdAt || session.submittedAt || session.date || 'saved'}` : '');
}
function freshness(session) {
  return [session.updatedAt, session.submittedAt, session.createdAt, session.statsCommittedAt].filter(Boolean).sort().at(-1) || '';
}
export function preservePracticeHistory(previous = {}, next = {}) {
  const sessions = { ...(next.sessions || {}) };
  const add = (session, key) => {
    const id = practiceIdentity(session, key);
    if (!id) return;
    const archiveKey = `${HISTORY_PREFIX}${id}`;
    const current = sessions[archiveKey];
    const candidate = { ...session, attemptId: id, practiceSource: session.practiceSource || (key.startsWith(HISTORY_PREFIX) ? 'daily' : key === 'score-training' || key === 'wrong-book' ? key : 'daily') };
    if (!current || (Boolean(candidate.submittedAt) && !current.submittedAt) || (Boolean(candidate.submittedAt) === Boolean(current.submittedAt) && freshness(candidate) >= freshness(current))) {
      const reviewedQuestions = { ...(current?.reviewedQuestions || {}) };
      for (const [questionId, review] of Object.entries(candidate.reviewedQuestions || {})) {
        if (!reviewedQuestions[questionId] || (review.updatedAt || '') >= (reviewedQuestions[questionId].updatedAt || '')) reviewedQuestions[questionId] = review;
      }
      sessions[archiveKey] = { ...current, ...candidate, reviewedQuestions };
    }
  };
  for (const state of [previous, next]) {
    for (const [key, session] of Object.entries(state.sessions || {})) add(session, key);
    for (const exam of state.mockExams || []) {
      if (!exam.id || !exam.results?.length) continue;
      const archived = sessions[`${HISTORY_PREFIX}${exam.id}`];
      if (archived && freshness(archived) >= (exam.persistedAt || exam.completedAt || exam.scoredAt || '')) continue;
      add({ attemptId: exam.id, practiceSource: 'mock', createdAt: exam.startedAt, submittedAt: exam.scoredAt || exam.completedAt, updatedAt: exam.persistedAt || exam.completedAt || exam.scoredAt, questionSnapshots: exam.questionSnapshots, questionIds: exam.results.map((r) => r.questionId), gradingResults: exam.results, practiceDrafts: Object.fromEntries(exam.results.map((r) => [r.questionId, r])) }, `${HISTORY_PREFIX}${exam.id}`);
    }
  }
  // Keep active aliases in sync when reviewing the SAME attempt, never a different paper.
  for (const [key, session] of Object.entries(sessions)) {
    if (key.startsWith(HISTORY_PREFIX)) continue;
    const archived = sessions[`${HISTORY_PREFIX}${practiceIdentity(session, key)}`];
    if (archived && freshness(archived) > freshness(session)) sessions[key] = archived;
  }
  return { ...next, sessions };
}
export function restoreHistoryFromAnswers(state) {
  const next = preservePracticeHistory({}, state);
  const groups = new Map();
  for (const [questionId, stat] of Object.entries(state.stats || {})) {
    for (const event of stat.answerHistory || []) {
      if (!event.attemptId || !event.selected || next.sessions[`${HISTORY_PREFIX}${event.attemptId}`]) continue;
      if (!groups.has(event.attemptId)) groups.set(event.attemptId, []);
      groups.get(event.attemptId).push({ ...event, questionId });
    }
  }
  for (const [id, results] of groups) {
    const date = results.map((r) => r.submittedAt || r.date || '').filter(Boolean).sort()[0];
    next.sessions[`${HISTORY_PREFIX}${id}`] = { attemptId: id, practiceSource: results[0].mode || 'daily', createdAt: date, submittedAt: date, recoveredFromAnswers: true, questionIds: results.map((r) => r.questionId), gradingResults: results, practiceDrafts: Object.fromEntries(results.map((r) => [r.questionId, r])) };
  }
  return next.sessions;
}
export function getPracticeHistory(sessions = {}) {
  return Object.entries(sessions).filter(([key]) => key.startsWith(HISTORY_PREFIX))
    .map(([key, session]) => ({ key, ...session }))
    .sort((a, b) => (b.createdAt || b.submittedAt || '').localeCompare(a.createdAt || a.submittedAt || ''));
}
