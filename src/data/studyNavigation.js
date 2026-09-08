export const STUDY_SECTIONS = [
  { id: 'practice', label: '開始測驗', description: '選題目標、題數與計時方式，一個入口完成所有練習。', items: [['training', '測驗設定與作答']] },
  { id: 'review', label: '檢討', description: '歷次試卷、錯題與複習排程，集中在這裡。', items: [['history', '測驗紀錄'], ['wrong-book', '錯題本'], ['review', '到期複習'], ['critical', '高風險錯題']] },
  { id: 'knowledge', label: '知識庫', description: '查筆記、複習記憶卡，串起題目背後的觀念。', items: [['knowledge', '筆記資料庫'], ['flashcard-review', '記憶卡複習'], ['flashcards', '管理記憶卡']] },
  { id: 'analysis', label: '學習分析', description: '從作答表現找出下一輪最值得加強的地方。', items: [['stats', '學習總覽'], ['analytics', '弱點分析'], ['readiness', '備考評估']] },
  { id: 'plan', label: '讀書計畫', description: '安排今天的任務與專注時間。', items: [['quest', '今日任務'], ['plan', '衝刺計畫'], ['pomodoro', '專注計時']] },
  { id: 'manage', label: '管理', description: '調整題庫、偏好與資料同步。', items: [['questions', '題庫管理'], ['settings', '偏好設定'], ['sync', '同步與備份']] },
];
export function getStudySection(tab) {
  if (tab === 'today' || tab === 'mock') return STUDY_SECTIONS[0];
  return STUDY_SECTIONS.find((section) => section.items.some(([id]) => id === tab)) || STUDY_SECTIONS[0];
}
export function getStudyNextStep(history = [], dueCount = 0) {
  const unfinished = history.find((row) => !row.submittedAt && row.questionIds?.length);
  if (unfinished) return { title: '接著完成上次的試卷', detail: `還有一份 ${unfinished.questionIds.length} 題的測驗未交卷，已保留你的作答。`, action: '繼續作答', tab: 'history', historyKey: unfinished.key };
  const pending = history.find((row) => row.submittedAt && !row.reviewCompletedAt && row.questionIds?.some((id) => !row.reviewedQuestions?.[id]?.completed));
  if (pending) return { title: '把上一份測驗檢討完', detail: `已檢討 ${pending.questionIds.filter((id) => pending.reviewedQuestions?.[id]?.completed).length}／${pending.questionIds.length} 題，接著上次的位置繼續。`, action: '繼續檢討', tab: 'history', historyKey: pending.key };
  if (dueCount > 0) return { title: '今天先鞏固到期的觀念', detail: `${dueCount} 題已到複習時間，先確認是否仍能獨立答對。`, action: '查看到期複習', tab: 'review' };
  return { title: '準備好下一輪提分練習', detail: '選擇下方目標，先獨立作答，再用解析補強觀念。', action: null, tab: 'training' };
}

export function getAssessmentExams(state) {
  const exams = new Map((state.mockExams || []).map((exam) => [exam.id, exam]));
  for (const session of Object.values(state.sessions || {})) {
    if (!session.attemptId || !session.submittedAt || !session.timerMinutes || session.trainingMode !== 'mixed') continue;
    const results = session.gradingResults || [];
    const graded = results.filter((result) => result.isCorrect != null);
    if (!graded.length) continue;
    exams.set(session.attemptId, { id: session.attemptId, completedAt: session.submittedAt, score: Math.round(100 * graded.filter((result) => result.isCorrect).length / graded.length), results });
  }
  return [...exams.values()];
}
export function getTestRemainingSeconds(session, now) {
  if (!session?.timerMinutes) return null;
  return Math.max(0, Math.ceil((Date.parse(session.createdAt) + session.timerMinutes * 60000 - now) / 1000));
}
