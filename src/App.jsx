import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { AlertTriangle, BarChart3, BookOpen, ChevronDown, ClipboardList, Clock3, ExternalLink, FileText, Home, LayoutGrid, List, Pause, Play, RefreshCw, RotateCcw, Settings2 } from 'lucide-react';
import './App.css';
import { NotionBlocks } from './components/NotionBlockRenderer.jsx';
import { QUESTION_BANK_TOTAL, QUESTION_YEARS, cancerCategories } from './data/questionBankMeta.js';
import { buildFlashcardTags } from './data/taxonomy.js';
import {
  getKnowledgeCardCancerDomain,
  getTaskKeywords,
  getTaskSearchText,
  knowledgeCardMatchesTask,
} from './data/knowledgeCardMatching.js';
import { notionNewsItems } from './data/notionNews.js';
import {
  getNotionNewsCriteriaForTask,
  hasCriteriaMatches,
  rankNotionNewsItems,
} from './data/notionNewsMatching.js';
import {
  buildNotionNoteSections,
  filterNotionLibrary,
  getLinkedNotionNotes,
  inferNotionNoteType,
  normalizeNotionExternalUrl,
  sortNotionLibrary,
} from './data/notionLibrary.js';
import {
  NOTION_LEARNING_ARTIFACTS,
  buildNotionLearningPrompt,
  canonicalLearningText,
  deriveNotionLearningContext,
  getRelatedQuestionsForNotionNote,
  markLearningDraftDuplicates,
  parseNotionLearningDrafts,
} from './data/notionLearningDrafts.js';
import { getNotionPageId, useNotionLibrary } from './hooks/useNotionLibrary.js';
import {
  HIGH_YIELD_TOPICS,
  dailyCompletionCriteria,
  getStudyPlanTaskById,
  getStudyPlanTaskKey,
  isPlanTaskComplete,
  normalizePlanProgress,
  studyPlan100,
} from './data/studyPlan100.js';
import {
  auth,
  db,
  firebaseConfigStatus,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from './firebase.js';

const STORAGE_KEY = 'oncologyTracker.aiReview.v1';
const STORAGE_VERSION = 3;
const STORAGE_V2_SLICE_KEYS = {
  core: `${STORAGE_KEY}.core.v2`,
  questionRecords: `${STORAGE_KEY}.questionRecords.v2`,
  questionEdits: `${STORAGE_KEY}.questionEdits.v2`,
  flashcards: `${STORAGE_KEY}.flashcards.v2`,
  flashcardStats: `${STORAGE_KEY}.flashcardStats.v2`,
};
const STORAGE_SLICE_KEYS = {
  app: `${STORAGE_KEY}.app.v3`,
  activity: `${STORAGE_KEY}.activity.v3`,
  sessions: `${STORAGE_KEY}.sessions.v3`,
  progress: `${STORAGE_KEY}.progress.v3`,
  quest: `${STORAGE_KEY}.quest.v3`,
  questionRecords: `${STORAGE_KEY}.questionRecords.v3`,
  questionEdits: `${STORAGE_KEY}.questionEdits.v3`,
  flashcards: `${STORAGE_KEY}.flashcards.v3`,
  flashcardStats: `${STORAGE_KEY}.flashcardStats.v3`,
  game: `${STORAGE_KEY}.game.v3`,
};
const CLOUD_STORAGE_VERSION = 3;
const CLOUD_SLICE_CHUNK_SIZE = 250000;
const CLOUD_SLICE_NAMES = Object.freeze(Object.keys(STORAGE_SLICE_KEYS));
const KNOWLEDGE_CANCER_DOMAINS = new Set([
  'Lung',
  'Breast',
  'GI',
  'GU',
  'GYN',
  'Head & Neck',
  'Heme',
  'Other',
  'Supportive/Stats',
]);

const NAV_GROUPS = [
  {
    id: 'practice',
    label: 'Practice',
    Icon: ClipboardList,
    items: [
      ['today', 'Daily Practice'],
      ['mock', 'Mock Exam'],
      ['flashcard-review', 'Card Review'],
      ['flashcards', 'Card Manager'],
      ['plan', '100-Day Plan'],
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis',
    Icon: BarChart3,
    items: [
      ['stats', 'Stats'],
      ['analytics', 'Analytics'],
      ['readiness', 'Board Readiness'],
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    Icon: Settings2,
    items: [
      ['settings', 'Settings'],
      ['sync', 'Cloud Sync'],
      ['questions', 'Question Manager'],
    ],
  },
  {
    id: 'review',
    label: 'Review',
    Icon: AlertTriangle,
    items: [
      ['critical', 'Critical Errors'],
      ['review', 'Review Queue'],
    ],
  },
];
const EMPTY_ARRAY = Object.freeze([]);
const QUESTION_MANAGER_PAGE_SIZE = 50;
const QUESTION_YEAR_LOADERS = {
  111: () => import('./data/questions/year111.js').then((module) => module.questions111),
  112: () => import('./data/questions/year112.js').then((module) => module.questions112),
  113: () => import('./data/questions/year113.js').then((module) => module.questions113),
  114: () => import('./data/questions/year114.js').then((module) => module.questions114),
};
const loadedQuestionYears = new Set();
const questionYearLoadPromises = new Map();
let questionBank = [];
let BANK_QUESTION_BY_ID = new Map();
const ERROR_TYPE_OPTIONS = [
  'Not studied yet',
  'Knowledge gap',
  'Misread question',
  'Trial confusion',
  'Biomarker cutoff',
  'Treatment sequence',
  'Toxicity',
  'Guideline outdated',
  'Overconfidence',
];

const ERROR_TYPE_REMEDIATION = {
  'Not studied yet': {
    task: '補核心知識',
    cardType: 'Cloze Card',
    action: '先讀 guideline 或講義核心段落，回到這題用一句話寫下「這題在考什麼」，再重做一次。',
  },
  'Knowledge gap': {
    task: '補概念缺口',
    cardType: 'Cloze Card',
    action: '回 guideline 與核心表格，抓出漏掉的 cutoff、eligibility、endpoint 或關鍵事實，寫成一條訂正重點後重測。',
  },
  'Trial confusion': {
    task: '釐清 trial 對照',
    cardType: 'Trial Card',
    action: '把 population、intervention、endpoint、OS/PFS 與適用情境對照清楚，再回題目判斷為什麼原選項錯。',
  },
  'Biomarker cutoff': {
    task: '校正 cutoff / threshold',
    cardType: 'Cloze Card',
    action: '把 cutoff、threshold、duration 或數字來源查清楚，寫下正確門檻與常混淆門檻。',
  },
  'Treatment sequence': {
    task: '重排治療順序',
    cardType: 'Algorithm Card',
    action: '把一線、二線、維持、術前術後或 progression 後的順序排一次，確認這題卡在哪一個節點。',
  },
  'Misread question': {
    task: '訂正審題陷阱',
    cardType: 'Trap Card',
    action: '補一條審題提醒：否定詞、例外條件、疾病期別、line of therapy。',
  },
  Toxicity: {
    task: '整理毒性判斷',
    cardType: 'Trap Card',
    action: '對照 AE、contraindication、dose hold/discontinue 規則，寫下這題最容易誤判的毒性點。',
  },
  'Guideline outdated': {
    task: '更新 guideline 差異',
    cardType: 'Algorithm Card',
    action: '確認 NCCN / ESMO / ASCO 的新版標準，寫下新舊差異與會影響答案的治療節點。',
  },
  Overconfidence: {
    task: '拆解高信心錯誤',
    cardType: 'Trap Card',
    action: '回看為什麼很有把握卻錯，記下錯誤直覺、真正線索與下次要停下來檢查的點。',
  },
};

const FLASHCARD_TYPE_OPTIONS = [
  'Trial Card',
  'Algorithm Card',
  'Cloze Card',
  'Trap Card',
];

const FLASHCARD_TYPE_ALIASES = {
  trial: 'Trial Card',
  'trial card': 'Trial Card',
  algorithm: 'Algorithm Card',
  'algorithm card': 'Algorithm Card',
  cloze: 'Cloze Card',
  'cloze card': 'Cloze Card',
  trap: 'Trap Card',
  'trap card': 'Trap Card',
  'exam trap': 'Trap Card',
  'topic recall': 'Algorithm Card',
  'golden trial': 'Trial Card',
  'focus tags': 'Algorithm Card',
  'algorithm recall': 'Algorithm Card',
  toxicity: 'Trap Card',
  biomarker: 'Cloze Card',
  basic: 'Trap Card',
  imported: 'Trap Card',
};

const FLASHCARD_TYPE_GUIDANCE_PROMPT = `卡片類型選擇：
- Trial Card: pivotal trial、population/intervention/comparator/outcome、適用情境、trial 間差異。
- Algorithm Card: basic card 的變體；用來練治療順序、line of therapy、stage-based decision、contraindication、例外情境，back 要能逐步揭開。
- Cloze Card: cutoff、duration、dose、endpoint、eligibility、biomarker threshold、數字型記憶點。
- Trap Card: basic card；正面問陷阱或常見錯誤，背面直接說明為何錯與正確判斷。`;

const FLASHCARD_SCHEMA_PROMPT = `每張卡必須包含：
- front
- back
- type: 只能是 "Trial Card", "Algorithm Card", "Cloze Card", "Trap Card"
- cancer
- topic
- sourceQuestionId
- trial: array
- tags: array
- examValue: 1-5
- errorType: 從 Not studied yet, Knowledge gap, Misread question, Trial confusion, Biomarker cutoff, Treatment sequence, Toxicity, Guideline outdated, Overconfidence 選一個

製卡規則：
1. 不要把整個題目題幹直接變成 front。
2. 每張卡只測一個可轉移的 decision rule 或核心概念。
3. Trial Card 必須包含 population / intervention / comparator / endpoint / exam trap。
4. Algorithm Card 必須包含 treatment sequencing 與 contraindication / exception；back 請寫成多行 numbered steps，讓 app 可以一步一步 reveal。
5. Cloze Card 必須針對 cutoff、duration、endpoint、dose、eligibility。
6. Cloze Card 使用 Anki cloze 格式，例如 {{c1::50%}}；不同 c-number 會分成不同複習卡，同一 c-number 會在同一次複習一起遮擋。
7. Trap Card 不做特殊互動，視為 Basic card；必須指出常見錯誤敘述為何錯。
8. 不可輸出 Trial Card / Algorithm Card / Cloze Card / Trap Card 以外的 type；請把所有補救內容歸入上面四種新版卡。
9. 醫學名詞與藥名保留英文，其餘用繁體中文。
10. back 要 concise，但要足夠讓我考前複習。

${FLASHCARD_TYPE_GUIDANCE_PROMPT}`;

const FLASHCARD_RATINGS = {
  Again: { masteryDelta: -1, tone: '重學' },
  Hard: { masteryDelta: 0, tone: '偏難' },
  Good: { masteryDelta: 1, tone: '正常' },
  Easy: { masteryDelta: 2, tone: '熟悉' },
};

const XP_RULES = {
  stageClear: 100,
  planTask: 50,
  wrongAgainRecovery: 80,
  highConfidenceWrongCorrected: 120,
  cancerBoss: 150,
  fullMock75: 300,
  wrongRetest90: 300,
};

let feedbackAudioContext = null;
let feedbackAudioUnlocked = false;
let feedbackAudioPreloaded = false;
const FEEDBACK_SOUND_PATHS = {
  correct: '/sounds/correct.mp3',
  wrong: '/sounds/wrong.mp3',
  taskCompletion: '/sounds/task-completion.mp3',
  pomodoroComplete: '/sounds/pomodoro-complete.mp3',
};
const feedbackAudioElements = {};

function triggerHapticFeedback(type = 'tap') {
  if (!navigator.vibrate) return;
  const patterns = {
    tap: 20,
    correct: [25, 40, 30],
    wrong: [60, 45, 60],
  };
  navigator.vibrate(patterns[type] || patterns.tap);
}

function getFeedbackAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  feedbackAudioContext ||= new AudioContext();
  return feedbackAudioContext;
}

function unlockFeedbackAudio() {
  const context = getFeedbackAudioContext();
  if (!feedbackAudioPreloaded) {
    Object.entries(FEEDBACK_SOUND_PATHS).forEach(([key, path]) => {
      feedbackAudioElements[key] ||= new Audio(path);
      feedbackAudioElements[key].preload = 'auto';
      feedbackAudioElements[key].load();
    });
    feedbackAudioPreloaded = true;
  }

  if (!context) return;

  const resume = context.state === 'suspended' ? context.resume() : Promise.resolve();
  resume
    .then(() => {
      if (feedbackAudioUnlocked) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = context.createBuffer(1, 1, context.sampleRate);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      source.connect(gain);
      gain.connect(context.destination);
      source.start(0);
      feedbackAudioUnlocked = true;
    })
    .catch(() => {});
}

function playFeedbackSound(soundKey, fallback) {
  unlockFeedbackAudio();
  const path = FEEDBACK_SOUND_PATHS[soundKey];
  const audio = feedbackAudioElements[soundKey] || new Audio(path);
  feedbackAudioElements[soundKey] = audio;
  audio.preload = 'auto';
  audio.volume = soundKey === 'wrong' ? 0.9 : 0.85;
  audio.currentTime = 0;

  const playPromise = audio.play();
  if (playPromise?.catch) {
    playPromise.catch(() => fallback?.());
  }
}

function scheduleTone(context, startFrequency, endFrequency, duration, delay, volume, waveType) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime + delay;

  oscillator.type = waveType;
  oscillator.frequency.setValueAtTime(startFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.05);
}

function playTone(startFrequency, endFrequency, duration, delay = 0, volume = 0.16, waveType = 'sine') {
  const context = getFeedbackAudioContext();
  if (!context) return;

  const play = () => scheduleTone(context, startFrequency, endFrequency, duration, delay, volume, waveType);
  if (context.state === 'suspended') {
    context.resume().then(play).catch(() => {});
    return;
  }

  play();
}

function playResultFeedback(result) {
  triggerHapticFeedback(result === 'correct' ? 'correct' : 'wrong');

  if (result === 'correct') {
    playFeedbackSound('correct', () => {
      playTone(587.33, 783.99, 0.12, 0, 0.18, 'triangle');
      playTone(783.99, 1046.5, 0.16, 0.1, 0.16, 'sine');
    });
    return;
  }

  playFeedbackSound('wrong', () => playTone(196, 110, 0.3, 0, 0.2, 'square'));
}

function playTaskCompletionFeedback() {
  triggerHapticFeedback('correct');
  playFeedbackSound('taskCompletion', () => {
    playTone(523.25, 783.99, 0.12, 0, 0.16, 'triangle');
    playTone(659.25, 1046.5, 0.18, 0.09, 0.14, 'sine');
  });
}

function playPomodoroCompletionFeedback() {
  triggerHapticFeedback('correct');
  playFeedbackSound('pomodoroComplete', () => {
    playTone(880, 880, 0.18, 0, 0.18, 'square');
    playTone(880, 880, 0.18, 0.32, 0.18, 'square');
    playTone(880, 880, 0.18, 0.64, 0.18, 'square');
  });
}

const FOCUS_RIVALS = [
  { id: 'rival-lin', name: '林晨安', title: 'GI Trial Sprinter', initials: 'GI', startOffset: 24, minutesPerMinute: 0.45, focusMinutes: 12, restMinutes: 16 },
  { id: 'rival-chou', name: '周品妤', title: 'Toxicity Sentinel', initials: 'Tx', startOffset: -48, minutesPerMinute: 0.35, focusMinutes: 18, restMinutes: 14 },
  { id: 'rival-kao', name: '高子睿', title: 'Flashcard Keeper', initials: 'FC', startOffset: -36, minutesPerMinute: 1.15, focusMinutes: 16, restMinutes: 10 },
  { id: 'rival-chen', name: '陳映禾', title: 'Board Boss Hunter', initials: 'BB', startOffset: -62, minutesPerMinute: 1.7, focusMinutes: 10, restMinutes: 14 },
  { id: 'rival-wu', name: '吳柏翰', title: 'Late Night Reviewer', initials: 'LR', startOffset: -90, minutesPerMinute: 0.25, focusMinutes: 8, restMinutes: 22 },
];

const FOCUS_MARQUEE_MESSAGES = [
  '不要等待機會，而要創造機會。',
  '經得起歷練，人生才有價值。',
  '機會是自己創造的，而不能一味的等待別人的賜予。',
  '專心追求卓越，成功自然就會跟著你！',
  '一個人的勝利不取決於他的智慧，而是毅力',
  '勝利不是將來才有的',
];

const POMODORO_PRESETS = {
  standard: { id: 'standard', label: '標準節奏', focusMinutes: 25, restMinutes: 5 },
  long: { id: 'long', label: '長時專注', focusMinutes: 50, restMinutes: 10 },
};
const DEFAULT_POMODORO_PRESET = 'standard';
const POMODORO_VIDEO_ID = 'z-j6jsLtgjs';

const PRACTICE_MODES = {
  minimum: {
    label: '保底',
    shortLabel: '保底 15 題',
    total: 15,
    newCount: 4,
    topicCount: 3,
    dueCount: 3,
    weaknessCount: 2,
    highYieldCount: 3,
    xp: 40,
  },
  standard: {
    label: '標準',
    shortLabel: '標準 30 題',
    total: 30,
    newCount: 9,
    topicCount: 6,
    dueCount: 5,
    weaknessCount: 4,
    highYieldCount: 6,
    xp: 90,
  },
  sprint: {
    label: '衝刺',
    shortLabel: '衝刺 40 題',
    total: 40,
    newCount: 12,
    topicCount: 8,
    dueCount: 8,
    weaknessCount: 6,
    highYieldCount: 6,
    xp: 140,
  },
};

const PRACTICE_PAGE_SIZE = 10;

function getPracticeModeConfig(mode) {
  return PRACTICE_MODES[mode] || PRACTICE_MODES.standard;
}

function formatLocalDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function makeCustomQuestionId() {
  return `custom-${Date.now()}`;
}

const TODAY = formatLocalDate(new Date());

const DEFAULT_WORKOUT_REMINDER = {
  enabled: false,
  time: '19:30',
  minutes: 20,
  completedDates: {},
  lastNotifiedDate: '',
};

const EXAM_DATE = {
  year: 2026,
  monthIndex: 9,
  day: 4,
  display: '2026/10/4',
  label: '腫瘤專科考試',
};

function getExamCountdown(now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const examDay = new Date(EXAM_DATE.year, EXAM_DATE.monthIndex, EXAM_DATE.day);
  const diffDays = Math.round((examDay - today) / 86400000);

  if (diffDays === 0) return 'D-Day';
  return diffDays > 0 ? `D-${diffDays}` : `D+${Math.abs(diffDays)}`;
}

const QUESTION_YEAR_KEY = QUESTION_YEARS.join(',');
const QUESTION_YEAR_LABEL = QUESTION_YEARS.length
  ? `${QUESTION_YEARS[0]}–${QUESTION_YEARS[QUESTION_YEARS.length - 1]}`
  : '題庫';
const DEFAULT_QUESTION_MANAGER_YEAR = String(QUESTION_YEARS[QUESTION_YEARS.length - 1] || 'All');

function normalizeQuestionYearList(years = QUESTION_YEARS) {
  return [...new Set((years || [])
    .map((year) => Number(year))
    .filter((year) => QUESTION_YEARS.includes(year)))]
    .sort((a, b) => a - b);
}

function getQuestionYearsFromIds(ids = []) {
  return normalizeQuestionYearList((ids || []).map((id) => {
    const match = String(id || '').match(/\b(111|112|113|114)\b/);
    return match ? Number(match[1]) : null;
  }));
}

function areQuestionYearsLoaded(years = QUESTION_YEARS) {
  const normalizedYears = normalizeQuestionYearList(years);
  return normalizedYears.length > 0 && normalizedYears.every((year) => (
    loadedQuestionYears.has(year)
    && questionBank.some((question) => Number(question.year) === year)
  ));
}

function installQuestionYear(year, questions = []) {
  const normalizedYear = Number(year);
  questionBank = [
    ...questionBank.filter((question) => Number(question.year) !== normalizedYear),
    ...questions,
  ].sort((a, b) => Number(a.year) - Number(b.year) || Number(a.number || 0) - Number(b.number || 0));
  BANK_QUESTION_BY_ID = new Map(questionBank.map((question) => [question.id, question]));
  loadedQuestionYears.add(normalizedYear);
}

async function loadQuestionYears(years = QUESTION_YEARS) {
  const normalizedYears = normalizeQuestionYearList(years);
  let loadedNewYear = false;
  await Promise.all(normalizedYears.map(async (year) => {
    if (loadedQuestionYears.has(year)) return;
    const loader = QUESTION_YEAR_LOADERS[year];
    if (!loader) return;
    if (!questionYearLoadPromises.has(year)) {
      questionYearLoadPromises.set(year, loader().then((questions) => {
        installQuestionYear(year, questions);
        loadedNewYear = true;
      }));
    }
    await questionYearLoadPromises.get(year);
  }));
  return loadedNewYear;
}

const defaultState = {
  sessions: {},
  focusSessions: [],
  focusTimer: {
    activeSession: null,
    leaderboardStartedAt: new Date().toISOString(),
    selectedPreset: DEFAULT_POMODORO_PRESET,
  },
  stats: {},
  settings: {
    dailyCount: 30,
    practiceMode: 'standard',
    preferredYears: QUESTION_YEARS,
    questionYearVersion: QUESTION_YEAR_KEY,
    preferredCancers: [],
    workoutReminder: DEFAULT_WORKOUT_REMINDER,
  },
  planProgress: {},
  planItemProgress: {},
  dailyQuestProgress: {},
  bossProgress: {},
  questionOverrides: {},
  customQuestions: {},
  deletedQuestionIds: {},
  mockExams: [],
  activeMockExam: null,
  activeMockExamClearedAt: null,
  activeFlashcardReview: null,
  activeFlashcardReviewClearedAt: null,
  flashcards: {},
  flashcardStats: {},
  deletedFlashcardIds: {},
  game: {
    xp: 0,
    level: 1,
    streak: 0,
    badges: [],
    unlockedBosses: [],
    defeatedBosses: [],
    xpEvents: [],
    dailyClaims: {},
    dailyChests: {},
    dailyCheckIns: {},
    reviewQueueCompletions: {},
    trialGems: 0,
  },
  cloudMeta: {
    updatedAt: null,
    device: null,
  },
  player: {
    xp: 0,
    level: 1,
    streak: 0,
    badges: [],
  },
};

let lastSavedStorageSlices = {};

function readStorageJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function buildStorageSlices(state) {
  return {
    app: {
      storageVersion: STORAGE_VERSION,
      settings: state.settings || defaultState.settings,
      cloudMeta: state.cloudMeta || defaultState.cloudMeta,
    },
    activity: {
      focusSessions: state.focusSessions || [],
      mockExams: state.mockExams || [],
      activeMockExam: state.activeMockExam || null,
      activeMockExamClearedAt: state.activeMockExamClearedAt || null,
      activeFlashcardReview: state.activeFlashcardReview || null,
      activeFlashcardReviewClearedAt: state.activeFlashcardReviewClearedAt || null,
      focusTimer: state.focusTimer || defaultState.focusTimer,
    },
    sessions: {
      sessions: state.sessions || {},
    },
    progress: {
      planProgress: state.planProgress || {},
      planItemProgress: state.planItemProgress || {},
    },
    quest: {
      dailyQuestProgress: state.dailyQuestProgress || {},
      bossProgress: state.bossProgress || {},
    },
    questionRecords: {
      stats: state.stats || {},
    },
    questionEdits: {
      questionOverrides: state.questionOverrides || {},
      customQuestions: state.customQuestions || {},
      deletedQuestionIds: state.deletedQuestionIds || {},
    },
    flashcards: {
      flashcards: state.flashcards || {},
      deletedFlashcardIds: state.deletedFlashcardIds || {},
    },
    flashcardStats: {
      flashcardStats: state.flashcardStats || {},
      deletedFlashcardIds: state.deletedFlashcardIds || {},
    },
    game: {
      game: state.game || defaultState.game,
      player: state.player || defaultState.player,
    },
  };
}

function hydrateStateFromStorage() {
  const legacyRaw = readStorageJSON(STORAGE_KEY, null);
  const legacyState = legacyRaw?.storageVersion === STORAGE_VERSION ? {} : (legacyRaw || {});
  const v2Core = readStorageJSON(STORAGE_V2_SLICE_KEYS.core, null);
  const app = readStorageJSON(STORAGE_SLICE_KEYS.app, null);
  const activity = readStorageJSON(STORAGE_SLICE_KEYS.activity, null);
  const sessions = readStorageJSON(STORAGE_SLICE_KEYS.sessions, null);
  const progress = readStorageJSON(STORAGE_SLICE_KEYS.progress, null);
  const quest = readStorageJSON(STORAGE_SLICE_KEYS.quest, null);
  const game = readStorageJSON(STORAGE_SLICE_KEYS.game, null);
  const questionRecords = readStorageJSON(STORAGE_SLICE_KEYS.questionRecords, null)
    || readStorageJSON(STORAGE_V2_SLICE_KEYS.questionRecords, null);
  const questionEdits = readStorageJSON(STORAGE_SLICE_KEYS.questionEdits, null)
    || readStorageJSON(STORAGE_V2_SLICE_KEYS.questionEdits, null);
  const flashcardSlice = readStorageJSON(STORAGE_SLICE_KEYS.flashcards, null)
    || readStorageJSON(STORAGE_V2_SLICE_KEYS.flashcards, null);
  const flashcardStatsSlice = readStorageJSON(STORAGE_SLICE_KEYS.flashcardStats, null)
    || readStorageJSON(STORAGE_V2_SLICE_KEYS.flashcardStats, null);

  return normalizeState({
    ...defaultState,
    ...legacyState,
    ...(v2Core || {}),
    settings: app?.settings ?? v2Core?.settings ?? legacyState.settings ?? defaultState.settings,
    cloudMeta: app?.cloudMeta ?? v2Core?.cloudMeta ?? legacyState.cloudMeta ?? defaultState.cloudMeta,
    focusSessions: activity?.focusSessions ?? v2Core?.focusSessions ?? legacyState.focusSessions ?? defaultState.focusSessions,
    mockExams: activity?.mockExams ?? v2Core?.mockExams ?? legacyState.mockExams ?? defaultState.mockExams,
    activeMockExam: activity?.activeMockExam ?? v2Core?.activeMockExam ?? legacyState.activeMockExam ?? defaultState.activeMockExam,
    activeMockExamClearedAt: activity?.activeMockExamClearedAt ?? v2Core?.activeMockExamClearedAt ?? legacyState.activeMockExamClearedAt ?? defaultState.activeMockExamClearedAt,
    activeFlashcardReview: activity?.activeFlashcardReview ?? v2Core?.activeFlashcardReview ?? legacyState.activeFlashcardReview ?? defaultState.activeFlashcardReview,
    activeFlashcardReviewClearedAt: activity?.activeFlashcardReviewClearedAt ?? v2Core?.activeFlashcardReviewClearedAt ?? legacyState.activeFlashcardReviewClearedAt ?? defaultState.activeFlashcardReviewClearedAt,
    focusTimer: activity?.focusTimer ?? v2Core?.focusTimer ?? legacyState.focusTimer ?? defaultState.focusTimer,
    sessions: sessions?.sessions ?? v2Core?.sessions ?? legacyState.sessions ?? defaultState.sessions,
    planProgress: progress?.planProgress ?? v2Core?.planProgress ?? legacyState.planProgress ?? defaultState.planProgress,
    planItemProgress: progress?.planItemProgress ?? v2Core?.planItemProgress ?? legacyState.planItemProgress ?? defaultState.planItemProgress,
    dailyQuestProgress: quest?.dailyQuestProgress ?? v2Core?.dailyQuestProgress ?? legacyState.dailyQuestProgress ?? defaultState.dailyQuestProgress,
    bossProgress: quest?.bossProgress ?? v2Core?.bossProgress ?? legacyState.bossProgress ?? defaultState.bossProgress,
    stats: questionRecords?.stats ?? legacyState.stats ?? defaultState.stats,
    questionOverrides: questionEdits?.questionOverrides ?? legacyState.questionOverrides ?? defaultState.questionOverrides,
    customQuestions: questionEdits?.customQuestions ?? legacyState.customQuestions ?? defaultState.customQuestions,
    deletedQuestionIds: questionEdits?.deletedQuestionIds ?? legacyState.deletedQuestionIds ?? defaultState.deletedQuestionIds,
    flashcards: flashcardSlice?.flashcards ?? legacyState.flashcards ?? defaultState.flashcards,
    flashcardStats: flashcardStatsSlice?.flashcardStats ?? flashcardSlice?.flashcardStats ?? legacyState.flashcardStats ?? defaultState.flashcardStats,
    deletedFlashcardIds: flashcardStatsSlice?.deletedFlashcardIds ?? flashcardSlice?.deletedFlashcardIds ?? legacyState.deletedFlashcardIds ?? defaultState.deletedFlashcardIds,
    game: game?.game ?? v2Core?.game ?? legacyState.game ?? defaultState.game,
    player: game?.player ?? v2Core?.player ?? legacyState.player ?? defaultState.player,
  });
}

function loadState() {
  try {
    return hydrateStateFromStorage();
  } catch {
    return defaultState;
  }
}

function saveState(state, sliceNames = null) {
  const normalized = normalizeState(state);
  const slices = buildStorageSlices(normalized);
  const requestedSlices = sliceNames ? new Set(sliceNames) : null;
  Object.entries(slices).forEach(([sliceName, value]) => {
    if (requestedSlices && !requestedSlices.has(sliceName)) return;
    const serialized = JSON.stringify(value);
    if (lastSavedStorageSlices[sliceName] === serialized) return;
    localStorage.setItem(STORAGE_SLICE_KEYS[sliceName], serialized);
    lastSavedStorageSlices[sliceName] = serialized;
  });
  const marker = JSON.stringify({ storageVersion: STORAGE_VERSION });
  if (lastSavedStorageSlices.marker !== marker) {
    localStorage.setItem(STORAGE_KEY, marker);
    lastSavedStorageSlices.marker = marker;
  }
}

function normalizeFocusSessions(focusSessions = []) {
  if (!Array.isArray(focusSessions)) return [];
  return focusSessions
    .filter((session) => session?.id && session?.date)
    .map((session) => ({
      id: String(session.id),
      date: session.date,
      startedAt: session.startedAt || null,
      endedAt: session.endedAt || null,
      durationSeconds: Math.max(0, Math.round(Number(session.durationSeconds) || 0)),
      durationMinutes: Math.max(0, Math.round(Number(session.durationMinutes) || ((Number(session.durationSeconds) || 0) / 60))),
      planTaskId: session.planTaskId || null,
      legacyPlanTaskId: session.legacyPlanTaskId || null,
      planTopic: session.planTopic || '',
      planDay: session.planDay || '',
      source: session.source || 'focus-timer',
      preset: POMODORO_PRESETS[session.preset] ? session.preset : null,
      completedCycles: Math.max(0, Math.round(Number(session.completedCycles) || 0)),
    }));
}

function normalizeFocusTimer(focusTimer = {}) {
  const active = focusTimer?.activeSession;
  const activeSession = active?.id && active?.startedAt
    ? {
        id: String(active.id),
        date: active.date || formatLocalDate(new Date(active.startedAt)),
        startedAt: active.startedAt,
        planTaskId: active.planTaskId || null,
        legacyPlanTaskId: active.legacyPlanTaskId || null,
        planTopic: active.planTopic || '',
        planDay: active.planDay || '',
        updatedAt: active.updatedAt || active.startedAt,
        source: active.source === 'pomodoro' ? 'pomodoro' : 'focus-timer',
        preset: POMODORO_PRESETS[active.preset] ? active.preset : DEFAULT_POMODORO_PRESET,
        focusMinutes: Math.max(1, Math.round(Number(active.focusMinutes) || POMODORO_PRESETS[active.preset]?.focusMinutes || 25)),
        restMinutes: Math.max(1, Math.round(Number(active.restMinutes) || POMODORO_PRESETS[active.preset]?.restMinutes || 5)),
        phase: active.phase === 'rest' ? 'rest' : 'focus',
        status: active.status === 'paused' ? 'paused' : 'running',
        phaseStartedAt: active.phaseStartedAt || active.startedAt,
        phaseEndsAt: active.phaseEndsAt || null,
        remainingSeconds: Math.max(0, Math.round(Number(active.remainingSeconds) || 0)),
      }
    : null;
  return {
    activeSession,
    leaderboardStartedAt: focusTimer?.leaderboardStartedAt || defaultState.focusTimer.leaderboardStartedAt,
    selectedPreset: POMODORO_PRESETS[focusTimer?.selectedPreset] ? focusTimer.selectedPreset : DEFAULT_POMODORO_PRESET,
  };
}

function mergeFocusSessions(cloudSessions = [], localSessions = []) {
  const byId = new Map();
  [...normalizeFocusSessions(cloudSessions), ...normalizeFocusSessions(localSessions)].forEach((session) => {
    byId.set(session.id, session);
  });
  return [...byId.values()].sort((a, b) => String(b.startedAt || b.date).localeCompare(String(a.startedAt || a.date)));
}

function mergeFocusTimer(cloudTimer = {}, localTimer = {}) {
  const cloud = normalizeFocusTimer(cloudTimer);
  const local = normalizeFocusTimer(localTimer);
  const activeSession = [cloud.activeSession, local.activeSession]
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt || b.startedAt).localeCompare(String(a.updatedAt || a.startedAt)))[0] || null;
  const startedAtCandidates = [cloud.leaderboardStartedAt, local.leaderboardStartedAt].filter(Boolean).sort();
  return {
    activeSession,
    leaderboardStartedAt: startedAtCandidates[0] || defaultState.focusTimer.leaderboardStartedAt,
    selectedPreset: local.selectedPreset || cloud.selectedPreset || DEFAULT_POMODORO_PRESET,
  };
}

function removeCompletedActiveFocusSession(focusTimer, focusSessions = []) {
  const normalizedTimer = normalizeFocusTimer(focusTimer);
  const completedIds = new Set(normalizeFocusSessions(focusSessions).map((session) => session.id));
  if (
    normalizedTimer.activeSession
    && completedIds.has(normalizedTimer.activeSession.id)
    && normalizedTimer.activeSession.phase !== 'rest'
  ) {
    return {
      ...normalizedTimer,
      activeSession: null,
    };
  }
  return normalizedTimer;
}

function getStatAttemptScore(stat = {}) {
  return (Number(stat.attempts) || 0) + ((stat.answerHistory || []).length / 100);
}

function getAnswerEventMergeKey(event = {}) {
  if (event.attemptId) return `attempt:${event.attemptId}`;
  return ['legacy', event.date, event.mode, event.questionId, event.selected, event.rating, event.isCorrect].join('|');
}

function mergeAnswerEvents(secondaryEvents = [], primaryEvents = []) {
  const merged = [];
  secondaryEvents.forEach((event) => {
    if (!event.attemptId) {
      merged.push(event);
      return;
    }
    const existingIndex = merged.findIndex((candidate) => candidate.attemptId === event.attemptId);
    if (existingIndex >= 0) merged[existingIndex] = event;
    else merged.push(event);
  });
  const matchedSecondaryIndexes = new Set();
  primaryEvents.forEach((event) => {
    const key = getAnswerEventMergeKey(event);
    if (event.attemptId) {
      const stableIndex = merged.findIndex((candidate) => candidate.attemptId === event.attemptId);
      if (stableIndex >= 0) merged[stableIndex] = event;
      else merged.push(event);
      return;
    }
    const matchingIndex = merged.findIndex((candidate, index) => (
      !matchedSecondaryIndexes.has(index) && getAnswerEventMergeKey(candidate) === key
    ));
    if (matchingIndex >= 0) {
      merged[matchingIndex] = event;
      matchedSecondaryIndexes.add(matchingIndex);
    } else {
      merged.push(event);
    }
  });
  return merged.slice(-50);
}

function haveSameEventOccurrences(leftEvents = [], rightEvents = []) {
  const countKeys = (events) => events.reduce((counts, event) => {
    const key = getAnswerEventMergeKey(event);
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map());
  const leftCounts = countKeys(leftEvents);
  const rightCounts = countKeys(rightEvents);
  return leftEvents.length > 0
    && leftEvents.length === rightEvents.length
    && [...leftCounts].every(([key, count]) => rightCounts.get(key) === count);
}

function getRemediationMergeKey(task = {}) {
  return task.attemptId ? `attempt:${task.attemptId}` : ['legacy', task.date, task.questionId, task.errorType, task.task].join('|');
}

function mergeRemediationTasks(secondaryTasks = [], primaryTasks = []) {
  const merged = [];
  secondaryTasks.forEach((task) => {
    if (!task.attemptId) {
      merged.push(task);
      return;
    }
    const existingIndex = merged.findIndex((candidate) => candidate.attemptId === task.attemptId);
    if (existingIndex >= 0) merged[existingIndex] = task;
    else merged.push(task);
  });
  const matchedSecondaryIndexes = new Set();
  primaryTasks.forEach((task) => {
    const key = getRemediationMergeKey(task);
    if (task.attemptId) {
      const stableIndex = merged.findIndex((candidate) => candidate.attemptId === task.attemptId);
      if (stableIndex >= 0) merged[stableIndex] = task;
      else merged.push(task);
      return;
    }
    const matchingIndex = merged.findIndex((candidate, index) => (
      !matchedSecondaryIndexes.has(index) && getRemediationMergeKey(candidate) === key
    ));
    if (matchingIndex >= 0) {
      merged[matchingIndex] = task;
      matchedSecondaryIndexes.add(matchingIndex);
    } else {
      merged.push(task);
    }
  });
  return merged.slice(-20);
}

function getSessionFreshness(session = {}) {
  return [session.statsCommittedAt, session.attemptsCommittedAt, session.submittedAt, session.updatedAt, session.createdAt]
    .filter(Boolean)
    .sort()
    .at(-1) || '';
}

function mergeDailySession(cloudSession = {}, localSession = {}) {
  const localIsNewer = getSessionFreshness(localSession) >= getSessionFreshness(cloudSession);
  const primary = localIsNewer ? localSession : cloudSession;
  const secondary = localIsNewer ? cloudSession : localSession;
  if (primary.attemptId && secondary.attemptId && primary.attemptId !== secondary.attemptId) return primary;
  return {
    ...secondary,
    ...primary,
    questionIds: (primary.questionIds || []).length >= (secondary.questionIds || []).length ? primary.questionIds : secondary.questionIds,
    practiceDrafts: { ...(secondary.practiceDrafts || {}), ...(primary.practiceDrafts || {}) },
    gradingResults: (primary.gradingResults || []).length >= (secondary.gradingResults || []).length
      ? primary.gradingResults
      : secondary.gradingResults,
    attemptsCommittedAt: [cloudSession.attemptsCommittedAt, localSession.attemptsCommittedAt].filter(Boolean).sort().at(-1) || null,
    statsCommittedAt: [cloudSession.statsCommittedAt, localSession.statsCommittedAt].filter(Boolean).sort().at(-1) || null,
    completed: Boolean(cloudSession.completed || localSession.completed),
  };
}

function mergeDailySessions(cloudSessions = {}, localSessions = {}) {
  const merged = { ...(cloudSessions || {}) };
  Object.entries(localSessions || {}).forEach(([date, localSession]) => {
    merged[date] = merged[date] ? mergeDailySession(merged[date], localSession) : localSession;
  });
  return merged;
}

function getMockExamFreshness(exam = {}) {
  return [exam.persistedAt, exam.completedAt, exam.scoredAt, exam.startedAt].filter(Boolean).sort().at(-1) || '';
}

function mergeMockExamHistory(cloudExams = [], localExams = []) {
  const byId = new Map();
  [...cloudExams, ...localExams].forEach((exam) => {
    if (!exam?.id) return;
    const current = byId.get(exam.id);
    if (!current || getMockExamFreshness(exam) >= getMockExamFreshness(current)) byId.set(exam.id, exam);
  });
  return [...byId.values()].sort((a, b) => getMockExamFreshness(b).localeCompare(getMockExamFreshness(a))).slice(0, 20);
}

function mergeActiveMockExam(localState = {}, cloudState = {}) {
  const clearedAt = [localState.activeMockExamClearedAt, cloudState.activeMockExamClearedAt].filter(Boolean).sort().at(-1) || '';
  const candidates = [cloudState.activeMockExam, localState.activeMockExam]
    .filter((draft) => draft?.updatedAt && draft.updatedAt > clearedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { activeMockExam: candidates[0] || null, activeMockExamClearedAt: clearedAt || null };
}

function mergeFlashcardStats(cloudStats = {}, localStats = {}) {
  const merged = { ...(cloudStats || {}) };
  Object.entries(localStats || {}).forEach(([id, localStat]) => {
    const cloudStat = merged[id];
    if (!cloudStat) {
      merged[id] = localStat;
      return;
    }
    const localUpdatedAt = localStat?.updatedAt || localStat?.lastReviewedAt || localStat?.createdAt || '';
    const cloudUpdatedAt = cloudStat?.updatedAt || cloudStat?.lastReviewedAt || cloudStat?.createdAt || '';
    merged[id] = localUpdatedAt >= cloudUpdatedAt ? localStat : cloudStat;
  });
  return merged;
}

function normalizeActiveFlashcardReview(review, flashcards = {}) {
  if (!review || !Array.isArray(review.queue)) return null;
  const cards = normalizeFlashcards(flashcards);
  const originalIndex = Math.max(0, Math.min(review.queue.length, Number(review.activeIndex) || 0));
  let retainedBeforeIndex = 0;
  const queue = review.queue.flatMap((entry, index) => {
    if (!entry?.cardId || !cards[getFlashcardBaseId(entry.cardId)]) return [];
    if (index < originalIndex) retainedBeforeIndex += 1;
    return [{
      sessionKey: String(entry.sessionKey || `${entry.cardId}-${index}`),
      cardId: String(entry.cardId),
    }];
  });
  return {
    id: String(review.id || `flashcard-review-${review.startedAt || Date.now()}`),
    mode: review.mode === 'all' ? 'all' : 'due',
    queue,
    activeIndex: Math.min(retainedBeforeIndex, queue.length),
    startedAt: review.startedAt || review.updatedAt || new Date().toISOString(),
    updatedAt: review.updatedAt || review.startedAt || null,
  };
}

function mergeActiveFlashcardReview(localState = {}, cloudState = {}, flashcards = {}) {
  const clearedAt = [localState.activeFlashcardReviewClearedAt, cloudState.activeFlashcardReviewClearedAt]
    .filter(Boolean).sort().at(-1) || '';
  const candidates = [cloudState.activeFlashcardReview, localState.activeFlashcardReview]
    .map((review) => normalizeActiveFlashcardReview(review, flashcards))
    .filter((review) => review?.updatedAt && review.updatedAt > clearedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return {
    activeFlashcardReview: candidates[0] || null,
    activeFlashcardReviewClearedAt: clearedAt || null,
  };
}

function mergeQuestionStats(cloudStats = {}, localStats = {}) {
  const merged = { ...(cloudStats || {}) };
  Object.entries(localStats || {}).forEach(([id, localStat]) => {
    const cloudStat = merged[id];
    if (!cloudStat) {
      merged[id] = localStat;
      return;
    }

    const localScore = getStatAttemptScore(localStat);
    const cloudScore = getStatAttemptScore(cloudStat);
    const primary = localScore >= cloudScore ? localStat : cloudStat;
    const secondary = primary === localStat ? cloudStat : localStat;
    const sameEventSet = haveSameEventOccurrences(localStat.answerHistory, cloudStat.answerHistory);
    const answerHistory = mergeAnswerEvents(secondary.answerHistory || [], primary.answerHistory || []);
    const mergedConfidenceHistory = answerHistory.flatMap((event) => event.confidence == null ? [] : [Number(event.confidence)]).filter(Number.isFinite).slice(-50);
    const mergedTimeHistory = answerHistory.flatMap((event) => event.timeSpentSec == null ? [] : [Number(event.timeSpentSec)]).filter(Number.isFinite).slice(-50);
    merged[id] = {
      ...secondary,
      ...primary,
      attempts: sameEventSet ? (Number(primary.attempts) || 0) : Math.max(Number(localStat.attempts) || 0, Number(cloudStat.attempts) || 0),
      correct: sameEventSet ? (Number(primary.correct) || 0) : Math.max(Number(localStat.correct) || 0, Number(cloudStat.correct) || 0),
      wrong: sameEventSet ? (Number(primary.wrong) || 0) : Math.max(Number(localStat.wrong) || 0, Number(cloudStat.wrong) || 0),
      answerHistory,
      confidenceHistory: mergedConfidenceHistory.length ? mergedConfidenceHistory : (primary.confidenceHistory || secondary.confidenceHistory || []).slice(-50),
      timeHistory: mergedTimeHistory.length ? mergedTimeHistory : (primary.timeHistory || secondary.timeHistory || []).slice(-50),
      errorTypes: [...new Set([
        ...(cloudStat.errorTypes || []),
        ...(localStat.errorTypes || []),
      ])].slice(-20),
      remediationTasks: mergeRemediationTasks(secondary.remediationTasks || [], primary.remediationTasks || []),
      bookmarked: Boolean(localStat.bookmarked || cloudStat.bookmarked),
      wrongNotes: primary.wrongNotes ?? secondary.wrongNotes ?? '',
      explanation: primary.explanation ?? secondary.explanation ?? '',
    };
  });
  return merged;
}

function mergeCloudState(localState, cloudState) {
  if (!cloudState) return normalizeState({ ...defaultState, ...localState });
  const deletedFlashcardIds = {
    ...(cloudState.deletedFlashcardIds || {}),
    ...(localState.deletedFlashcardIds || {}),
  };
  const localPlanResetAt = localState?.cloudMeta?.planResetAt || '';
  const cloudPlanResetAt = cloudState?.cloudMeta?.planResetAt || '';
  const localGameResetAt = localState?.cloudMeta?.gameResetAt || '';
  const cloudGameResetAt = cloudState?.cloudMeta?.gameResetAt || '';
  const planResetOwner = localPlanResetAt > cloudPlanResetAt ? 'local' : cloudPlanResetAt > localPlanResetAt ? 'cloud' : 'none';
  const gameResetOwner = localGameResetAt > cloudGameResetAt ? 'local' : cloudGameResetAt > localGameResetAt ? 'cloud' : 'none';
  const mergedFocusSessions = mergeFocusSessions(cloudState.focusSessions, localState.focusSessions);
  const mergedActiveMockExam = mergeActiveMockExam(localState, cloudState);
  const mergedFlashcards = mergeFlashcardMaps(cloudState.flashcards, localState.flashcards, deletedFlashcardIds);
  const mergedActiveFlashcardReview = mergeActiveFlashcardReview(localState, cloudState, mergedFlashcards);

  return normalizeState({
    ...defaultState,
    ...cloudState,
    ...localState,
    sessions: mergeDailySessions(cloudState.sessions, localState.sessions),
    focusSessions: mergedFocusSessions,
    focusTimer: removeCompletedActiveFocusSession(mergeFocusTimer(cloudState.focusTimer, localState.focusTimer), mergedFocusSessions),
    stats: mergeQuestionStats(cloudState.stats, localState.stats),
    settings: {
      ...defaultState.settings,
      ...(cloudState.settings || {}),
      ...(localState.settings || {}),
    },
    planProgress: planResetOwner === 'local'
      ? (localState.planProgress || {})
      : planResetOwner === 'cloud'
        ? (cloudState.planProgress || {})
        : {
            ...(cloudState.planProgress || {}),
            ...(localState.planProgress || {}),
          },
    planItemProgress: planResetOwner === 'local'
      ? normalizePlanItemProgress(localState.planItemProgress)
      : planResetOwner === 'cloud'
        ? normalizePlanItemProgress(cloudState.planItemProgress)
        : mergePlanItemProgress(cloudState.planItemProgress, localState.planItemProgress),
    dailyQuestProgress: planResetOwner === 'local'
      ? (localState.dailyQuestProgress || {})
      : planResetOwner === 'cloud'
        ? (cloudState.dailyQuestProgress || {})
        : {
            ...(cloudState.dailyQuestProgress || {}),
            ...(localState.dailyQuestProgress || {}),
          },
    bossProgress: planResetOwner === 'local'
      ? (localState.bossProgress || {})
      : planResetOwner === 'cloud'
        ? (cloudState.bossProgress || {})
        : {
            ...(cloudState.bossProgress || {}),
            ...(localState.bossProgress || {}),
          },
    questionOverrides: {
      ...(cloudState.questionOverrides || {}),
      ...(localState.questionOverrides || {}),
    },
    customQuestions: {
      ...(cloudState.customQuestions || {}),
      ...(localState.customQuestions || {}),
    },
    deletedQuestionIds: {
      ...(cloudState.deletedQuestionIds || {}),
      ...(localState.deletedQuestionIds || {}),
    },
    mockExams: mergeMockExamHistory(cloudState.mockExams, localState.mockExams),
    ...mergedActiveMockExam,
    ...mergedActiveFlashcardReview,
    deletedFlashcardIds,
    flashcards: mergedFlashcards,
    flashcardStats: mergeFlashcardStats(cloudState.flashcardStats, localState.flashcardStats),
    game: gameResetOwner === 'local'
      ? mergeGameState({}, localState.game)
      : gameResetOwner === 'cloud'
        ? mergeGameState({}, cloudState.game)
        : mergeGameState(cloudState.game, localState.game),
    player: gameResetOwner === 'local'
      ? mergePlayerState({}, localState.player, {}, localState.game)
      : gameResetOwner === 'cloud'
        ? mergePlayerState({}, cloudState.player, {}, cloudState.game)
        : mergePlayerState(cloudState.player, localState.player, cloudState.game, localState.game),
    cloudMeta: {
      ...(cloudState.cloudMeta || {}),
      ...(localState.cloudMeta || {}),
    },
  });
}

function getCloudDocRef(uid) {
  return doc(db, 'oncologyTrackerUsers', uid, 'appState', 'main');
}

function getCloudSliceDocRef(uid, sliceName) {
  return doc(db, 'oncologyTrackerUsers', uid, 'appState', 'slices', 'items', sliceName);
}

function getCloudSlicesCollectionRef(uid) {
  return collection(db, 'oncologyTrackerUsers', uid, 'appState', 'slices', 'items');
}

function getCloudSliceChunkDocRef(uid, sliceName, chunkIndex) {
  return doc(db, 'oncologyTrackerUsers', uid, 'appState', 'slices', 'items', sliceName, 'chunks', `chunk-${String(chunkIndex).padStart(4, '0')}`);
}

function getCloudSliceChunksCollectionRef(uid, sliceName) {
  return collection(db, 'oncologyTrackerUsers', uid, 'appState', 'slices', 'items', sliceName, 'chunks');
}

function makeCloudMeta(state, syncedAt = new Date().toISOString()) {
  return {
    ...(state.cloudMeta || {}),
    updatedAt: syncedAt,
    device: navigator.userAgent,
  };
}

function makeCloudIndexPayload(state, syncedAt = new Date().toISOString()) {
  return {
    cloudStorageVersion: CLOUD_STORAGE_VERSION,
    storageVersion: STORAGE_VERSION,
    sliceNames: CLOUD_SLICE_NAMES,
    cloudMeta: makeCloudMeta(state, syncedAt),
    serverUpdatedAt: serverTimestamp(),
  };
}

function splitCloudSlicePayload(payload) {
  const serialized = JSON.stringify(payload);
  const chunks = [];
  for (let index = 0; index < serialized.length; index += CLOUD_SLICE_CHUNK_SIZE) {
    chunks.push(serialized.slice(index, index + CLOUD_SLICE_CHUNK_SIZE));
  }
  return chunks.length ? chunks : ['{}'];
}

async function readChunkedCloudSlice(uid, sliceName, sliceMeta = {}) {
  const chunkSnapshot = await getDocs(getCloudSliceChunksCollectionRef(uid, sliceName));
  const chunks = [];
  const chunkCount = Math.max(0, Number(sliceMeta.chunkCount) || 0);
  chunkSnapshot.forEach((chunkDoc) => {
    const data = chunkDoc.data();
    const index = Number.isFinite(Number(data?.index)) ? Number(data.index) : Number(String(chunkDoc.id).replace('chunk-', ''));
    if (Number.isInteger(index) && (!chunkCount || index < chunkCount)) {
      chunks[index] = data?.payload || '';
    }
  });
  try {
    return JSON.parse(chunks.slice(0, chunkCount || chunks.length).join(''));
  } catch {
    return {};
  }
}

function hydrateStateFromCloudSlices(sliceMap = {}) {
  const app = sliceMap.app || {};
  const activity = sliceMap.activity || {};
  const sessions = sliceMap.sessions || {};
  const progress = sliceMap.progress || {};
  const quest = sliceMap.quest || {};
  const questionRecords = sliceMap.questionRecords || {};
  const questionEdits = sliceMap.questionEdits || {};
  const flashcardSlice = sliceMap.flashcards || {};
  const flashcardStatsSlice = sliceMap.flashcardStats || {};
  const game = sliceMap.game || {};

  return normalizeState({
    ...defaultState,
    settings: app.settings ?? defaultState.settings,
    cloudMeta: app.cloudMeta ?? defaultState.cloudMeta,
    focusSessions: activity.focusSessions ?? defaultState.focusSessions,
    mockExams: activity.mockExams ?? defaultState.mockExams,
    activeMockExam: activity.activeMockExam ?? defaultState.activeMockExam,
    activeMockExamClearedAt: activity.activeMockExamClearedAt ?? defaultState.activeMockExamClearedAt,
    activeFlashcardReview: activity.activeFlashcardReview ?? defaultState.activeFlashcardReview,
    activeFlashcardReviewClearedAt: activity.activeFlashcardReviewClearedAt ?? defaultState.activeFlashcardReviewClearedAt,
    focusTimer: activity.focusTimer ?? defaultState.focusTimer,
    sessions: sessions.sessions ?? defaultState.sessions,
    planProgress: progress.planProgress ?? defaultState.planProgress,
    planItemProgress: progress.planItemProgress ?? defaultState.planItemProgress,
    dailyQuestProgress: quest.dailyQuestProgress ?? defaultState.dailyQuestProgress,
    bossProgress: quest.bossProgress ?? defaultState.bossProgress,
    stats: questionRecords.stats ?? defaultState.stats,
    questionOverrides: questionEdits.questionOverrides ?? defaultState.questionOverrides,
    customQuestions: questionEdits.customQuestions ?? defaultState.customQuestions,
    deletedQuestionIds: questionEdits.deletedQuestionIds ?? defaultState.deletedQuestionIds,
    flashcards: flashcardSlice.flashcards ?? defaultState.flashcards,
    flashcardStats: flashcardStatsSlice.flashcardStats ?? flashcardSlice.flashcardStats ?? defaultState.flashcardStats,
    deletedFlashcardIds: flashcardStatsSlice.deletedFlashcardIds ?? flashcardSlice.deletedFlashcardIds ?? defaultState.deletedFlashcardIds,
    game: game.game ?? defaultState.game,
    player: game.player ?? defaultState.player,
  });
}

async function readCloudState(uid, mainSnapshot = null) {
  const snap = mainSnapshot || await getDoc(getCloudDocRef(uid));
  if (!snap.exists()) return null;
  const mainData = snap.data();
  if ((Number(mainData?.cloudStorageVersion) || 0) < 2) {
    return normalizeState(mainData);
  }

  const sliceSnapshot = await getDocs(getCloudSlicesCollectionRef(uid));
  const sliceEntries = await Promise.all(sliceSnapshot.docs
    .filter((sliceDoc) => CLOUD_SLICE_NAMES.includes(sliceDoc.id))
    .map(async (sliceDoc) => {
      const data = sliceDoc.data();
      const payload = data?.storageMode === 'jsonChunks'
        ? await readChunkedCloudSlice(uid, sliceDoc.id, data)
        : data?.payload || data;
      return [sliceDoc.id, payload];
    }));
  const sliceMap = Object.fromEntries(sliceEntries);
  const hydrated = hydrateStateFromCloudSlices(sliceMap);
  return normalizeState({
    ...hydrated,
    cloudMeta: {
      ...(hydrated.cloudMeta || {}),
      ...(mainData.cloudMeta || {}),
    },
  });
}

async function writeCloudState(uid, state, syncedAt = new Date().toISOString()) {
  const normalized = normalizeState({
    ...state,
    cloudMeta: makeCloudMeta(state, syncedAt),
  });
  const slices = buildStorageSlices(normalized);
  await Promise.all(Object.entries(slices).map(async ([sliceName, payload]) => {
    const chunks = splitCloudSlicePayload(payload);
    await Promise.all(chunks.map((chunkPayload, index) => (
      setDoc(getCloudSliceChunkDocRef(uid, sliceName, index), {
        index,
        payload: chunkPayload,
        updatedAt: syncedAt,
        serverUpdatedAt: serverTimestamp(),
      })
    )));
    await setDoc(getCloudSliceDocRef(uid, sliceName), {
      storageMode: 'jsonChunks',
      chunkCount: chunks.length,
      storageVersion: STORAGE_VERSION,
      cloudStorageVersion: CLOUD_STORAGE_VERSION,
      updatedAt: syncedAt,
      serverUpdatedAt: serverTimestamp(),
    });
  }));
  await setDoc(getCloudDocRef(uid), makeCloudIndexPayload(normalized, syncedAt));
  return normalized;
}

function getCloudSyncSignature(state) {
  const syncableState = { ...normalizeState(state) };
  delete syncableState.cloudMeta;
  delete syncableState.serverUpdatedAt;
  return JSON.stringify(syncableState);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

function getDailyCheckInStatus(state, date = TODAY) {
  return Boolean(state?.game?.dailyCheckIns?.[date]);
}

function getDailyCheckInStreak(state, date = TODAY) {
  let streak = 0;
  let cursor = date;
  while (state?.game?.dailyCheckIns?.[cursor]) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function normalizeTextList(value = []) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeTextList(item));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => {
      if (item === true) return [key];
      if (item === false || item == null) return [];
      return normalizeTextList(item);
    });
  }
  if (value == null || value === false) return [];
  return [String(value).trim()].filter(Boolean);
}

function normalizeFlashcardType(type, sourceType = '') {
  const normalized = String(type || sourceType || '').trim().toLowerCase();
  return FLASHCARD_TYPE_ALIASES[normalized] || (normalized.includes('trial') ? 'Trial Card' : 'Trap Card');
}

function normalizeExamValue(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 3;
  return Math.max(1, Math.min(5, Math.round(numericValue)));
}

function normalizeFlashcardErrorType(errorType) {
  return ERROR_TYPE_OPTIONS.includes(errorType) ? errorType : 'Knowledge gap';
}

function hasClozeMarkup(value) {
  return /\{\{c\d+::.*?\}\}/.test(String(value || ''));
}

function getClozeNumbers(value) {
  const text = String(value || '');
  const clozePattern = /\{\{c(\d+)::.*?\}\}/g;
  const numbers = [];
  let match;
  while ((match = clozePattern.exec(text)) !== null) {
    if (!numbers.includes(match[1])) numbers.push(match[1]);
  }
  return numbers;
}

function getFlashcardFrontText(card = {}) {
  const front = String(card.front || '');
  const cloze = String(card.cloze || '');
  if (hasClozeMarkup(front)) return front;
  if (normalizeFlashcardType(card.type, card.sourceType) === 'Cloze Card' && cloze) return cloze;
  return front;
}

function getFlashcardBaseId(cardId = '') {
  return String(cardId).split('::c')[0];
}

function getFlashcardReviewId(card = {}) {
  return card.reviewId || card.id;
}

function getFlashcardEditId(card = {}) {
  return card.baseId || card.id;
}

function isAlgorithmFlashcard(card = {}) {
  return normalizeFlashcardType(card.type, card.sourceType) === 'Algorithm Card';
}

function getAlgorithmSteps(card = {}) {
  const back = String(card.back || '').trim();
  if (!isAlgorithmFlashcard(card) || !back) return [];
  const lineSteps = back
    .split(/\n+/)
    .map((line) => line.trim().replace(/^(?:step\s*)?\d+[.)、:：-]?\s*/i, '').replace(/^[•*-]\s*/, ''))
    .filter(Boolean);
  if (lineSteps.length > 1) return lineSteps;
  return back
    .split(/\s*(?:→|->|=>|;|；)\s*/)
    .map((step) => step.trim())
    .filter(Boolean);
}

function renderClozeText(value, revealAnswer = false, activeClozeNumber = null) {
  const text = String(value || '');
  const clozePattern = /\{\{c\d+::(.*?)(?:::(.*?))?\}\}/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = clozePattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const clozeNumber = match[0].match(/^\{\{c(\d+)::/)?.[1] || null;
    const answer = match[1] || '';
    const hint = match[2] || '';
    const isActiveCloze = !activeClozeNumber || clozeNumber === String(activeClozeNumber);
    const shouldReveal = revealAnswer || !isActiveCloze;
    parts.push(
      <span className={shouldReveal ? 'cloze-answer' : 'cloze-blank'} key={`${match.index}-${answer}`}>
        {shouldReveal ? answer : hint || '_____'}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length ? parts : text;
}

function formatAlgorithmBackForStepReveal(card = {}) {
  const steps = getAlgorithmSteps(card);
  if (steps.length <= 1) return String(card.back || '');
  return steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
}

function normalizeFlashcard(card) {
  const normalizedTags = [...new Set(normalizeTextList(card.tags))];
  const normalizedTrial = [...new Set(normalizeTextList(card.trial))];
  const baseCard = {
    ...card,
    tags: normalizedTags,
    trial: normalizedTrial,
  };
  const taxonomyTags = buildFlashcardTags(baseCard);
  const type = normalizeFlashcardType(card.type, card.sourceType);
  const rawBack = String(card.back || '');
  const normalizedBack = type === 'Algorithm Card'
    ? formatAlgorithmBackForStepReveal({ ...baseCard, type, back: rawBack })
    : rawBack;
  return {
    ...baseCard,
    front: String(card.front || ''),
    back: normalizedBack,
    cloze: String(card.cloze || ''),
    type,
    tags: [...new Set([...normalizedTags, ...(taxonomyTags.hashTags || [])])],
    taxonomyTags,
    examValue: normalizeExamValue(card.examValue),
    errorType: normalizeFlashcardErrorType(card.errorType),
  };
}

function normalizeFlashcards(flashcards = {}) {
  if (Array.isArray(flashcards)) {
    return Object.fromEntries(flashcards.filter((card) => card?.id).map((card) => [card.id, normalizeFlashcard(card)]));
  }
  if (flashcards && typeof flashcards === 'object') {
    return Object.fromEntries(Object.values(flashcards).filter((card) => card?.id).map((card) => [card.id, normalizeFlashcard(card)]));
  }
  return {};
}

function normalizeFlashcardStats(stats = {}, flashcards = {}) {
  const cards = normalizeFlashcards(flashcards);
  const normalized = stats && typeof stats === 'object' && !Array.isArray(stats) ? { ...stats } : {};
  Object.values(cards).forEach((card) => {
    const baseStats = normalized[card.id] || {};
    normalized[card.id] = {
      attempts: 0,
      correct: 0,
      wrong: 0,
      mastery: card.mastery || 0,
      intervalDays: card.intervalDays || 1,
      nextReviewDate: card.nextReviewDate || null,
      lastReviewedAt: card.lastReviewedAt || null,
      ...baseStats,
    };
    const clozeNumbers = normalizeFlashcardType(card.type, card.sourceType) === 'Cloze Card'
      ? getClozeNumbers(getFlashcardFrontText(card))
      : [];
    clozeNumbers.forEach((number) => {
      const reviewId = `${card.id}::c${number}`;
      normalized[reviewId] = {
        ...normalized[card.id],
        ...(normalized[reviewId] || {}),
        id: reviewId,
        baseId: card.id,
      };
    });
  });
  return normalized;
}

function removeDeletedFlashcardRecords(records = {}, deletedFlashcardIds = {}) {
  return Object.fromEntries(Object.entries(records || {}).filter(([id]) => !deletedFlashcardIds[id]));
}

function makePlanProgressEntry(progress = {}, task, completed = true) {
  if (!task) return progress;
  return {
    ...progress,
    [getStudyPlanTaskKey(task)]: completed,
    [task.id]: completed,
  };
}

function getPlanProgressValue(progress = {}, task) {
  return isPlanTaskComplete(progress, task);
}

function getPlanTaskStorageId(task) {
  return task ? getStudyPlanTaskKey(task) : null;
}

function makePlanTaskSnapshot(task) {
  if (!task) return {};
  return {
    planTaskId: getPlanTaskStorageId(task),
    legacyPlanTaskId: task.id,
    planTopic: task.topic,
    planDay: task.day,
  };
}

function normalizePlanItemProgress(progress = {}) {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return {};
  return Object.fromEntries(Object.entries(progress).flatMap(([taskId, item]) => {
    const task = getStudyPlanTaskById(taskId);
    const normalizedTaskId = task ? getPlanTaskStorageId(task) : taskId;
    const criteria = item?.criteria && typeof item.criteria === 'object' && !Array.isArray(item.criteria) ? item.criteria : {};
    const knowledge = item?.knowledge && typeof item.knowledge === 'object' && !Array.isArray(item.knowledge) ? item.knowledge : {};
    const normalizedItem = {
      criteria: Object.fromEntries(Object.entries(criteria).filter(([, value]) => Boolean(value))),
      knowledge: Object.fromEntries(Object.entries(knowledge).filter(([, value]) => Boolean(value))),
      updatedAt: item?.updatedAt || null,
    };
    const entries = [[normalizedTaskId, normalizedItem]];
    if (task) entries.push([task.id, normalizedItem]);
    return entries;
  }));
}

function mergePlanItemProgress(cloudProgress = {}, localProgress = {}) {
  const cloud = normalizePlanItemProgress(cloudProgress);
  const local = normalizePlanItemProgress(localProgress);
  const merged = { ...cloud };
  Object.entries(local).forEach(([taskId, item]) => {
    const cloudUpdatedAt = merged[taskId]?.updatedAt || '';
    const localUpdatedAt = item.updatedAt || '';
    merged[taskId] = !cloudUpdatedAt || localUpdatedAt >= cloudUpdatedAt ? item : merged[taskId];
  });
  return merged;
}

function mergeFlashcardMaps(cloudFlashcards = {}, localFlashcards = {}, deletedFlashcardIds = {}) {
  return removeDeletedFlashcardRecords({
    ...normalizeFlashcards(cloudFlashcards),
    ...normalizeFlashcards(localFlashcards),
  }, deletedFlashcardIds);
}

function getFlashcardList(stateOrFlashcards = {}, statsOverride = null) {
  const rawFlashcards = stateOrFlashcards?.flashcards !== undefined ? stateOrFlashcards.flashcards : stateOrFlashcards;
  const stats = statsOverride || stateOrFlashcards?.flashcardStats || {};
  return Object.values(normalizeFlashcards(rawFlashcards))
    .flatMap((card) => {
      const clozeNumbers = getClozeNumbers(getFlashcardFrontText(card));
      const shouldExpandCloze = normalizeFlashcardType(card.type, card.sourceType) === 'Cloze Card' && clozeNumbers.length > 0;
      const reviewKeys = shouldExpandCloze ? clozeNumbers.map((number) => `c${number}`) : [null];

      return reviewKeys.map((clozeKey, index) => {
        const reviewId = clozeKey ? `${card.id}::${clozeKey}` : card.id;
        const cardStats = stats?.[reviewId] || stats?.[card.id] || {};
        return {
          ...card,
          ...cardStats,
          id: reviewId,
          baseId: card.id,
          reviewId,
          clozeNumber: clozeKey ? clozeKey.slice(1) : null,
          clozeLabel: clozeKey ? clozeKey.toUpperCase() : null,
          clozeIndex: shouldExpandCloze ? index + 1 : null,
          clozeTotal: shouldExpandCloze ? reviewKeys.length : null,
          mastery: cardStats.mastery ?? card.mastery ?? 0,
          intervalDays: cardStats.intervalDays ?? card.intervalDays ?? 1,
          nextReviewDate: cardStats.nextReviewDate ?? card.nextReviewDate ?? TODAY,
        };
      });
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function cardsToMap(cards = []) {
  return Object.fromEntries(cards.filter((card) => card?.id).map((card) => [card.id, normalizeFlashcard(card)]));
}

function makeFlashcardStats(card, now = new Date().toISOString()) {
  return {
    attempts: 0,
    correct: 0,
    wrong: 0,
    mastery: card.mastery || 0,
    intervalDays: card.intervalDays || 1,
    nextReviewDate: card.nextReviewDate || TODAY,
    lastReviewedAt: null,
    sourceType: card.sourceType,
    createdAt: now,
    updatedAt: now,
  };
}

function mergeGameState(cloudGame = {}, localGame = {}) {
  const xp = Math.max(cloudGame?.xp || 0, localGame?.xp || 0);
  return {
    ...defaultState.game,
    ...(cloudGame || {}),
    ...(localGame || {}),
    xp,
    level: xpLevel(xp),
    badges: [...new Set([...(cloudGame?.badges || []), ...(localGame?.badges || [])])],
    unlockedBosses: [...new Set([...(cloudGame?.unlockedBosses || []), ...(localGame?.unlockedBosses || [])])],
    defeatedBosses: [...new Set([...(cloudGame?.defeatedBosses || []), ...(localGame?.defeatedBosses || [])])],
    xpEvents: [
      ...(cloudGame?.xpEvents || []),
      ...(localGame?.xpEvents || []),
    ].filter((event, index, events) => event?.id && events.findIndex((x) => x.id === event.id) === index).slice(0, 80),
    dailyClaims: {
      ...(cloudGame?.dailyClaims || {}),
      ...(localGame?.dailyClaims || {}),
    },
    dailyChests: {
      ...(cloudGame?.dailyChests || {}),
      ...(localGame?.dailyChests || {}),
    },
    dailyCheckIns: {
      ...(cloudGame?.dailyCheckIns || {}),
      ...(localGame?.dailyCheckIns || {}),
    },
    reviewQueueCompletions: {
      ...(cloudGame?.reviewQueueCompletions || {}),
      ...(localGame?.reviewQueueCompletions || {}),
    },
    trialGems: Math.max(cloudGame?.trialGems || 0, localGame?.trialGems || 0),
  };
}

function mergePlayerState(cloudPlayer = {}, localPlayer = {}, cloudGame = {}, localGame = {}) {
  const game = mergeGameState(cloudGame, localGame);
  const xp = Math.max(cloudPlayer?.xp || 0, localPlayer?.xp || 0, game.xp || 0);
  return {
    ...defaultState.player,
    ...(cloudPlayer || {}),
    ...(localPlayer || {}),
    xp,
    level: xpLevel(xp),
    streak: Math.max(cloudPlayer?.streak || 0, localPlayer?.streak || 0, game.streak || 0),
    badges: [...new Set([...(cloudPlayer?.badges || []), ...(localPlayer?.badges || []), ...(game.badges || [])])],
  };
}

function normalizeState(state) {
  const stateSettings = state?.settings || {};
  const workoutReminder = {
    ...DEFAULT_WORKOUT_REMINDER,
    ...(stateSettings.workoutReminder || {}),
    completedDates: stateSettings.workoutReminder?.completedDates || {},
  };
  const rawPreferredYears = Array.isArray(stateSettings.preferredYears)
    ? stateSettings.preferredYears.map((year) => Number(year)).filter((year) => Number.isFinite(year))
    : defaultState.settings.preferredYears;
  const preferredYears = stateSettings.questionYearVersion === QUESTION_YEAR_KEY
    ? rawPreferredYears.filter((year) => QUESTION_YEARS.includes(year))
    : [...new Set([...rawPreferredYears, ...QUESTION_YEARS])].filter((year) => QUESTION_YEARS.includes(year)).sort((a, b) => a - b);
  const game = {
    ...defaultState.game,
    ...(state?.game || {}),
    badges: state?.game?.badges || [],
    unlockedBosses: state?.game?.unlockedBosses || [],
    defeatedBosses: state?.game?.defeatedBosses || [],
    xpEvents: state?.game?.xpEvents || [],
    dailyClaims: state?.game?.dailyClaims || {},
    dailyChests: state?.game?.dailyChests || {},
    dailyCheckIns: state?.game?.dailyCheckIns || {},
    reviewQueueCompletions: state?.game?.reviewQueueCompletions || {},
    trialGems: state?.game?.trialGems || 0,
  };
  const xp = Math.max(game.xp || 0, state?.player?.xp || 0);
  const player = {
    ...defaultState.player,
    ...(state?.player || {}),
    xp,
    level: xpLevel(xp),
    streak: Math.max(game.streak || 0, state?.player?.streak || 0),
    badges: [...new Set([...(game.badges || []), ...(state?.player?.badges || [])])],
  };
  const deletedFlashcardIds = state?.deletedFlashcardIds || {};
  const flashcards = removeDeletedFlashcardRecords(normalizeFlashcards(state?.flashcards), deletedFlashcardIds);
  const activeFlashcardReview = normalizeActiveFlashcardReview(state?.activeFlashcardReview, flashcards);
  return {
    ...defaultState,
    ...state,
    settings: {
      ...defaultState.settings,
      ...stateSettings,
      preferredYears,
      questionYearVersion: QUESTION_YEAR_KEY,
      practiceMode: PRACTICE_MODES[stateSettings.practiceMode] ? stateSettings.practiceMode : 'standard',
      workoutReminder,
    },
    planProgress: normalizePlanProgress(state?.planProgress),
    planItemProgress: normalizePlanItemProgress(state?.planItemProgress),
    dailyQuestProgress: state?.dailyQuestProgress || {},
    bossProgress: state?.bossProgress || {},
    questionOverrides: state?.questionOverrides || {},
    customQuestions: state?.customQuestions || {},
    deletedQuestionIds: state?.deletedQuestionIds || {},
    deletedFlashcardIds,
    focusSessions: normalizeFocusSessions(state?.focusSessions),
    focusTimer: normalizeFocusTimer(state?.focusTimer),
    flashcards,
    flashcardStats: normalizeFlashcardStats(removeDeletedFlashcardRecords(state?.flashcardStats, deletedFlashcardIds), flashcards),
    activeFlashcardReview,
    activeFlashcardReviewClearedAt: state?.activeFlashcardReviewClearedAt || null,
    game: { ...game, xp, level: xpLevel(xp), streak: player.streak, badges: player.badges },
    player,
  };
}

function daysBetween(fromDate, toDate) {
  if (!fromDate || !toDate) return Number.POSITIVE_INFINITY;
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  return Math.round((to - from) / 86400000);
}

function xpLevel(xp = 0) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 120)) + 1);
}

function getLevelProgress(xp = 0) {
  const level = xpLevel(xp);
  const currentLevelFloor = ((level - 1) ** 2) * 120;
  const nextLevelFloor = (level ** 2) * 120;
  const inLevel = Math.max(0, xp - currentLevelFloor);
  const needed = Math.max(1, nextLevelFloor - currentLevelFloor);
  return {
    level,
    current: inLevel,
    needed,
    percent: Math.round((inLevel / needed) * 100),
    nextLevelXp: nextLevelFloor,
  };
}

function awardXp(game = defaultState.game, amount, reason, meta = {}) {
  if (!amount) return game;
  const xp = (game.xp || 0) + amount;
  const event = {
    id: `xp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    amount,
    reason,
    meta,
    createdAt: new Date().toISOString(),
  };
  return {
    ...defaultState.game,
    ...game,
    xp,
    level: xpLevel(xp),
    xpEvents: [event, ...(game.xpEvents || [])].slice(0, 80),
  };
}

function getTodayReviewQuestionCount(state, date = TODAY) {
  const completedIds = new Set(Object.keys(state.game?.reviewQueueCompletions?.[date] || {}));
  Object.values(state.stats || {}).forEach((stat) => {
    (stat.answerHistory || []).forEach((event) => {
      if (event?.date === date && event?.mode === 'review' && event?.questionId) {
        completedIds.add(event.questionId);
      }
    });
  });
  return completedIds.size;
}

function getTodayFlashcardReviewCount(state, date = TODAY) {
  return Object.values(state.flashcardStats || {}).filter((stat) => stat.lastReviewedAt === date).length;
}

function getTodayWrongNoteCount(state, date = TODAY) {
  return Object.values(state.stats || {}).filter((stat) => stat.lastAttemptAt === date && String(stat.wrongNotes || '').trim()).length;
}

function getDailyChest(state, todayCompleted = false, date = TODAY) {
  const checkedIn = getDailyCheckInStatus(state, date);
  const reviewCount = getTodayReviewQuestionCount(state, date);
  const flashcardCount = getTodayFlashcardReviewCount(state, date);
  const wrongNoteCount = getTodayWrongNoteCount(state, date);
  const rows = [
    {
      key: 'daily-check-in',
      label: '每日打卡',
      target: '按下今日打卡',
      value: checkedIn ? 1 : 0,
      max: 1,
      points: checkedIn ? 10 : 0,
      totalPoints: 10,
    },
    {
      key: 'daily-practice',
      label: 'Daily Practice',
      target: '完成今日題組',
      value: todayCompleted ? 1 : 0,
      max: 1,
      points: todayCompleted ? 30 : 0,
      totalPoints: 30,
    },
    {
      key: 'review-queue',
      label: 'Review Queue',
      target: '8 題',
      value: Math.min(reviewCount, 8),
      max: 8,
      points: Math.round(Math.min(reviewCount / 8, 1) * 25),
      totalPoints: 25,
    },
    {
      key: 'flashcards',
      label: 'Flashcards',
      target: '10 張',
      value: Math.min(flashcardCount, 10),
      max: 10,
      points: Math.round(Math.min(flashcardCount / 10, 1) * 20),
      totalPoints: 20,
    },
    {
      key: 'wrong-note',
      label: '錯題 note',
      target: '1 題',
      value: Math.min(wrongNoteCount, 1),
      max: 1,
      points: wrongNoteCount >= 1 ? 15 : 0,
      totalPoints: 15,
    },
  ];
  const progress = Math.min(100, rows.reduce((sum, row) => sum + row.points, 0));
  return {
    rows,
    progress,
    claimed: Boolean(state.game?.dailyChests?.[date]),
  };
}

const TAXONOMY_CANCER_TYPE_RULES = [
  ['NSCLC', ['nsclc', 'non-small cell', 'adenocarcinoma', 'squamous cell lung']],
  ['SCLC', ['sclc', 'small cell lung']],
  ['Mesothelioma', ['mesothelioma']],
  ['Thymic malignancy', ['thymic', 'thymoma']],
  ['Early breast cancer', ['early breast', 'stage i breast', 'stage ii breast', 'stage iii breast']],
  ['Metastatic breast cancer', ['metastatic breast', 'mbc']],
  ['TNBC', ['tnbc', 'triple negative']],
  ['HER2-positive breast cancer', ['her2-positive breast', 'her2+ breast']],
  ['HR+/HER2- breast cancer', ['hr+/her2', 'er-positive', 'hormone receptor-positive']],
  ['Colorectal cancer', ['colorectal', 'colon cancer', 'rectal cancer', 'mcrc']],
  ['Gastric/GEJ cancer', ['gastric', 'gastroesophageal', 'gej']],
  ['Esophageal cancer', ['esophageal', 'oesophageal']],
  ['Pancreatic cancer', ['pancreatic']],
  ['Biliary tract cancer', ['biliary', 'cholangiocarcinoma', 'gallbladder']],
  ['HCC', ['hepatocellular', 'hcc']],
  ['GIST', ['gist', 'gastrointestinal stromal']],
  ['Prostate cancer', ['prostate', 'mcrpc', 'mhspc']],
  ['Renal cell carcinoma', ['renal cell', 'rcc', 'clear cell']],
  ['Urothelial cancer', ['urothelial', 'bladder cancer', 'mibc']],
  ['Germ cell tumor', ['seminoma', 'non-seminoma', 'germ cell', 'testicular']],
  ['Ovarian cancer', ['ovarian']],
  ['Endometrial cancer', ['endometrial']],
  ['Cervical cancer', ['cervical cancer']],
  ['Head and neck cancer', ['oropharynx', 'larynx', 'hypopharynx', 'oral cavity', 'hnscc']],
  ['Nasopharyngeal carcinoma', ['nasopharyngeal', 'npc', 'ebv dna']],
  ['AML', ['acute myeloid', 'aml']],
  ['CML', ['chronic myeloid', 'cml']],
  ['MDS/MPN', ['mds', 'myelodysplastic', 'mpn', 'myelofibrosis', 'polycythemia', 'essential thrombocythemia']],
  ['Multiple myeloma', ['multiple myeloma', 'myeloma', 'slim-crab']],
  ['Lymphoma', ['lymphoma', 'dlbcl', 'hodgkin', 'follicular', 'mantle cell']],
  ['CLL', ['cll', 'chronic lymphocytic']],
  ['Melanoma', ['melanoma']],
  ['Sarcoma', ['sarcoma']],
  ['Supportive care', ['antiemesis', 'fatigue', 'febrile neutropenia', 'bone-modifying', 'thromboembolism', 'vte']],
  ['Precision oncology', ['ngs', 'tumor agnostic', 'basket', 'companion diagnostic']],
];

const STAGE_RULES = [
  ['localized', ['localized', 'early-stage', 'stage i', 'stage ii', 'stage iii', 'post-nephrectomy']],
  ['resectable', ['resectable', 'operable', 'surgery']],
  ['borderline resectable', ['borderline resectable']],
  ['unresectable locally advanced', ['unresectable', 'locally advanced', 'definitive ccrt', 'stage iii nsclc']],
  ['metastatic', ['metastatic', 'advanced', 'stage iv', 'm1']],
  ['relapsed/refractory', ['relapsed', 'refractory', 'salvage', 'progression after', 'post-platinum', 'post-tki', 'post-io']],
  ['palliative/supportive', ['palliative', 'supportive', 'symptom', 'fatigue', 'antiemesis']],
];

const CLINICAL_SETTING_RULES = [
  ['diagnosis/staging/risk', ['staging', 'tnm', 'risk group', 'imdc', 'figo', 'bclc', 'iss', 'r-iss', 'eln', 'diagnosis']],
  ['localized curative intent', ['localized', 'resectable', 'curative', 'surgery', 'margin', 'lymph node dissection']],
  ['neoadjuvant therapy', ['neoadjuvant', 'preoperative', 'pre-operative']],
  ['adjuvant therapy', ['adjuvant', 'postoperative', 'post-operative', 'post-nephrectomy']],
  ['perioperative therapy', ['perioperative', 'peri-operative', 'flot']],
  ['locally advanced unresectable', ['unresectable', 'definitive ccrt', 'concurrent chemoradiation', 'brachytherapy']],
  ['metastatic first-line', ['first-line', '1l', '1st line', 'metastatic 1l']],
  ['later-line/refractory', ['second-line', '2l', 'third-line', '3l', 'salvage', 'relapsed', 'refractory', 'progression after']],
  ['maintenance therapy', ['maintenance']],
  ['toxicity/supportive care', ['toxicity', 'adverse event', 'pneumonitis', 'colitis', 'neuropathy', 'antiemesis', 'fatigue', 'febrile neutropenia']],
  ['biomarker/companion diagnostic', ['biomarker', 'companion diagnostic', 'ngs', 'msi', 'dmmr', 'pd-l1', 'her2', 'egfr', 'alk', 'brca']],
];

const MODALITY_RULES = [
  ['surgery', ['surgery', 'surgical', 'resection', 'nephrectomy', 'mastectomy']],
  ['radiation therapy', ['radiation', 'radiotherapy', 'rt', 'ccrt', 'brachytherapy', 'pci']],
  ['chemotherapy', ['chemotherapy', 'chemo', 'folfox', 'folfiri', 'cisplatin', 'carboplatin', 'gemcitabine', 'docetaxel']],
  ['immunotherapy', ['immunotherapy', 'ici', 'pd-1', 'pd-l1', 'ctla-4', 'pembrolizumab', 'nivolumab', 'atezolizumab', 'durvalumab', 'ipilimumab']],
  ['targeted therapy', ['targeted', 'tki', 'osimertinib', 'alectinib', 'selpercatinib', 'olaparib', 'parp', 'braf', 'mek', 'fgfr']],
  ['ADC', ['adc', 'antibody-drug', 'trastuzumab deruxtecan', 't-dxd', 'sacituzumab', 'enfortumab']],
  ['endocrine therapy', ['endocrine', 'aromatase', 'tamoxifen', 'fulvestrant', 'abemaciclib', 'cdk4/6', 'abiraterone', 'enzalutamide']],
  ['cellular/bispecific therapy', ['car-t', 'bispecific', 'tarlatamab', 'crs', 'icans']],
  ['supportive care', ['supportive', 'antiemesis', 'denosumab', 'zoledronic', 'anticoagulation', 'fatigue']],
];

const GOLDEN_TRIAL_TERMS = [
  'pacific', 'laura', 'adaura', 'keynote-671', 'checkmate 816', 'impower133', 'caspian',
  'keynote-522', 'katherine', 'cleopatra', 'destiny-breast03', 'her2climb',
  'cross', 'checkmate-577', 'flot4', 'keynote-811', 'checkmate-649', 'idea', 'rapido',
  'prodige 23', 'opra', 'beacon', 'prodige 24', 'topaz-1', 'keynote-966', 'imbrave150',
  'himalaya', 'keynote-564', 'checkmate 274', 'ev-302', 'javelin bladder 100',
  'vision', 'ruby', 'keynote-a18', 'keynote-775', 'echelon-1',
];

function questionSearchText(question = {}) {
  return [
    question.id,
    question.cancer,
    question.topic,
    question.stem,
    ...Object.values(question.options || {}),
    ...(question.trials || []),
    question.explanation,
  ].filter(Boolean).join(' ').toLowerCase();
}

function matchesAny(text, terms = []) {
  return terms.some((term) => text.includes(String(term).toLowerCase()));
}

function pickRuleLabel(text, rules, fallback = '') {
  return rules.find(([, terms]) => matchesAny(text, terms))?.[0] || fallback;
}

function inferEvidenceType(question, text) {
  if ((question.trials || []).some((trial) => matchesAny(String(trial).toLowerCase(), GOLDEN_TRIAL_TERMS)) || matchesAny(text, GOLDEN_TRIAL_TERMS)) return 'Golden trial';
  if ((question.trials || []).length) return 'Recognized trial';
  if (matchesAny(text, ['negative trial', 'did not improve', 'no benefit', 'failed to'])) return 'Negative trial';
  if (matchesAny(text, ['guideline', 'nccn', 'asco', 'esmo', 'category'])) return 'Guideline-only';
  if (pickRuleLabel(text, MODALITY_RULES) === 'supportive care') return 'Toxicity/supportive principle';
  if (matchesAny(text, ['biomarker', 'companion diagnostic', 'msi', 'dmmr', 'pd-l1', 'her2', 'egfr', 'alk', 'brca'])) return 'Biomarker principle';
  return 'Guideline principle';
}

function inferQuestionType(text) {
  if (matchesAny(text, ['toxicity', 'adverse event', 'pneumonitis', 'colitis', 'neuropathy', 'crs', 'icans'])) return 'toxicity';
  if (matchesAny(text, ['biomarker', 'mutation', 'ngs', 'companion diagnostic', 'msi', 'dmmr', 'pd-l1', 'her2', 'egfr', 'alk'])) return 'biomarker';
  if (matchesAny(text, ['sequence', 'after progression', 'post-platinum', 'post-tki', 'second-line', 'salvage'])) return 'sequence';
  if (matchesAny(text, ['except', 'not correct', 'incorrect', 'wrong', '錯誤', '不正確'])) return 'exception/wrong statement';
  if (matchesAny(text, ['endpoint', 'os', 'pfs', 'efs', 'dfs', 'orr', 'hazard ratio'])) return 'endpoint recognition';
  return 'standard of care';
}

function makeHashTags(question, taxonomy) {
  const baseTags = [
    taxonomy.cancerType,
    taxonomy.stage,
    taxonomy.clinicalSetting,
    taxonomy.treatmentModality,
    taxonomy.evidenceType,
    taxonomy.questionType,
    ...(question.trials || []),
    ...(taxonomy.biomarker || []),
  ];
  return [...new Set(baseTags
    .filter(Boolean)
    .map((tag) => `#${String(tag).replace(/[^a-z0-9]+/gi, '')}`)
    .filter((tag) => tag.length > 1))]
    .slice(0, 8);
}

function tagSearchText(tags = {}) {
  return Object.values(tags)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value) => ['string', 'number'].includes(typeof value))
    .join(' ')
    .toLowerCase();
}

function makeQuestionTags(question) {
  const text = questionSearchText(question);
  const includesAny = (items) => items.some((item) => text.includes(item.toLowerCase()));
  const biomarker = [
    ['EGFR', 'egfr'], ['ALK', 'alk'], ['KRAS', 'kras'], ['HER2', 'her2'], ['BRCA/HRD', 'brca', 'hrd'],
    ['MSI/dMMR', 'msi', 'dmmr'], ['PD-L1', 'pd-l1', 'cps', 'tps'], ['FGFR', 'fgfr'], ['NTRK/RET', 'ntrk', 'ret'],
    ['BRAF', 'braf'], ['CLDN18.2', 'cldn18'], ['Nectin-4', 'nectin'], ['PSMA', 'psma'],
  ].filter(([, ...terms]) => includesAny(terms)).map(([label]) => label);
  const taxonomy = {
    cancerDomain: question.cancer,
    cancerType: pickRuleLabel(text, TAXONOMY_CANCER_TYPE_RULES, question.topic || question.cancer || 'General'),
    stage: pickRuleLabel(text, STAGE_RULES, ''),
    clinicalSetting: pickRuleLabel(text, CLINICAL_SETTING_RULES, question.topic || 'General'),
    treatmentModality: pickRuleLabel(text, MODALITY_RULES, ''),
    biomarker,
    evidenceType: inferEvidenceType(question, text),
    questionType: inferQuestionType(text),
  };
  return {
    domain: question.cancer,
    cancerDomain: taxonomy.cancerDomain,
    cancerType: taxonomy.cancerType,
    stage: taxonomy.stage,
    clinicalSetting: taxonomy.clinicalSetting,
    treatmentModality: taxonomy.treatmentModality,
    subtopic: question.topic || 'General',
    trial: question.trials || [],
    biomarker,
    treatmentLine: includesAny(['adjuvant']) ? 'adjuvant' : includesAny(['neoadjuvant']) ? 'neoadjuvant' : includesAny(['second-line', '2nd', 'salvage']) ? 'second-line' : includesAny(['first-line', '1st']) ? 'first-line' : '',
    endpoint: ['OS', 'PFS', 'EFS', 'DFS', 'iDFS', 'pCR', 'ORR'].filter((endpoint) => text.includes(endpoint.toLowerCase())),
    toxicity: [
      ['ILD/pneumonitis', 'ild', 'pneumonitis'],
      ['neuropathy', 'neuropathy'],
      ['cytopenia', 'neutropenia', 'anemia', 'thrombocytopenia'],
      ['hyperglycemia', 'hyperglycemia'],
      ['hypertension', 'hypertension'],
      ['CRS/ICANS', 'crs', 'icans'],
    ].filter(([, ...terms]) => includesAny(terms)).map(([label]) => label),
    guidelineConcept: question.topic || '',
    evidenceType: taxonomy.evidenceType,
    questionType: taxonomy.questionType,
    hashTags: makeHashTags(question, taxonomy),
    examWeight: question.cancer === 'Lung' ? 5 : ['Breast', 'GI', 'Heme'].includes(question.cancer) ? 4 : ['GU', 'Head & Neck'].includes(question.cancer) ? 3 : 2,
    cardEligible: Boolean(question.explanation || (question.trials || []).length || question.answer),
  };
}

function normalizeQuestion(question = {}) {
  return {
    ...question,
    id: question.id || `custom-${Date.now()}`,
    year: Number.isFinite(Number(question.year)) ? Number(question.year) : (question.year || 'Custom'),
    number: question.number ? Number(question.number) : null,
    stem: String(question.stem || ''),
    options: {
      A: question.options?.A || '',
      B: question.options?.B || '',
      C: question.options?.C || '',
      D: question.options?.D || '',
      E: question.options?.E || '',
    },
    answer: question.answer || null,
    cancer: question.cancer || 'Custom',
    topic: question.topic || 'Manual',
    trials: normalizeTextList(question.trials),
    explanation: question.explanation || '',
    notionUrl: question.notionUrl || '',
    sourceType: question.sourceType || (String(question.id || '').startsWith('custom-') ? 'custom' : 'bank'),
  };
}

function getQuestionPool(state = {}) {
  const deleted = state?.deletedQuestionIds || {};
  const customQuestions = Object.values(state?.customQuestions || {}).map((q) => normalizeQuestion({ ...q, sourceType: 'custom' }));
  return [...questionBank, ...customQuestions].filter((q) => !deleted[q.id]);
}

function findQuestionById(id, state = {}) {
  if (!id || state?.deletedQuestionIds?.[id]) return null;
  const customQuestion = state?.customQuestions?.[id];
  if (customQuestion) return normalizeQuestion({ ...customQuestion, sourceType: 'custom' });
  const bankQuestion = BANK_QUESTION_BY_ID.get(id) || questionBank.find((question) => question.id === id) || null;
  if (bankQuestion && !BANK_QUESTION_BY_ID.has(id)) {
    BANK_QUESTION_BY_ID.set(id, bankQuestion);
  }
  return bankQuestion;
}

function applyQuestionOverride(question, overrides = {}) {
  if (!question) return question;
  const override = overrides[question.id];
  if (!override) return question;

  return {
    ...question,
    ...override,
    options: {
      ...(question.options || {}),
      ...(override.options || {}),
    },
    trials: override.trials ?? question.trials,
  };
}


const getQuestionWithOverride = (id, state) => {
  const original = findQuestionById(id, state);
  if (!original) return null;
  const question = applyQuestionOverride(original, state?.questionOverrides || {});
  return {
    ...question,
    tags: {
      ...makeQuestionTags(question),
      ...(question.tags && !Array.isArray(question.tags) ? question.tags : {}),
      raw: Array.isArray(question.tags) ? question.tags : question.tags?.raw || [],
    },
  };
};

function emptyStat() {
  return {
    attempts: 0,
    correct: 0,
    wrong: 0,

    lastResult: null,
    lastRating: null,
    lastAttemptAt: null,
    nextReviewDate: null,

    mastery: 0,
    intervalDays: 1,
    difficulty: 3,

    userAnswer: null,
    correctAnswer: null,

    ungradedAttempts: 0,
    confidenceHistory: [],
    answerHistory: [],
    timeHistory: [],

    highConfidenceWrong: 0,
    repeatedWrong: 0,
    wrongRetestAttempts: 0,
    wrongRetestCorrect: 0,

    errorTypes: [],
    explanation: '',
    explanationImages: [],
    wrongNotes: '',
    bookmarked: false,
  };
}

function getStat(state, id) {
  return { ...emptyStat(), ...(state.stats[id] || {}) };
}

function wrongRate(stat) {
  if (!stat.attempts) return 0;
  return Math.round((stat.wrong / stat.attempts) * 100);
}

function getRemediationForErrorType(errorType) {
  return ERROR_TYPE_REMEDIATION[errorType] || {
    task: '完成針對性訂正',
    cardType: 'Trap Card',
    action: '回到題目確認錯因，寫下正確判斷線索與下次避免同錯的提醒。',
  };
}

function nextIntervalByRating(rating, stat) {
  return getAnkiIntervalDays(rating, stat);
}

function getMasteryDeltaByRating(rating) {
  if (rating === 'Again') return -1;
  if (rating === 'Hard') return 0;
  if (rating === 'Easy') return 2;
  return 1;
}

function applyBatchQuestionResults(stats, results, mode, attemptId) {
  const nextStats = { ...(stats || {}) };

  results.forEach((result) => {
    if (result.isCorrect == null) return;
    const previous = { ...emptyStat(), ...(nextStats[result.questionId] || {}) };
    if ((previous.answerHistory || []).some((event) => event?.attemptId === attemptId)) return;

    const rating = FLASHCARD_RATINGS[result.rating]
      ? result.rating
      : (result.isCorrect ? 'Good' : 'Again');
    const interval = nextIntervalByRating(rating, previous);
    const wasPreviouslyWrong = (previous.wrong || 0) > 0;
    const remediation = !result.isCorrect && result.errorType ? getRemediationForErrorType(result.errorType) : null;
    const remediationEvent = remediation ? {
      date: TODAY,
      questionId: result.questionId,
      errorType: result.errorType,
      task: remediation.task,
      cardType: remediation.cardType,
      action: remediation.action,
      attemptId,
    } : null;
    const event = {
      ...result,
      date: TODAY,
      mode,
      rating,
      attemptId,
      wasPreviouslyWrong,
      previousStat: {
        mastery: previous.mastery || 0,
        repeatedWrong: previous.repeatedWrong || 0,
        wrongRetestAttempts: previous.wrongRetestAttempts || 0,
        wrongRetestCorrect: previous.wrongRetestCorrect || 0,
        intervalDays: previous.intervalDays || 1,
        nextReviewDate: previous.nextReviewDate || null,
        lastResult: previous.lastResult || null,
        lastRating: previous.lastRating || null,
        lastAttemptAt: previous.lastAttemptAt || null,
        lastErrorType: previous.lastErrorType || '',
      },
      remediationTask: remediation?.task || '',
      remediationCardType: remediation?.cardType || '',
    };

    nextStats[result.questionId] = {
      ...previous,
      attempts: (previous.attempts || 0) + 1,
      correct: (previous.correct || 0) + (result.isCorrect ? 1 : 0),
      wrong: (previous.wrong || 0) + (result.isCorrect ? 0 : 1),
      lastResult: result.isCorrect ? 'correct' : 'wrong',
      lastRating: rating,
      lastAttemptAt: TODAY,
      nextReviewDate: addDays(TODAY, interval),
      mastery: Math.max(0, Math.min(5, (previous.mastery || 0) + getMasteryDeltaByRating(rating))),
      intervalDays: interval,
      userAnswer: result.selected,
      correctAnswer: result.correctAnswer,
      explanation: result.explanation ?? previous.explanation,
      wrongNotes: result.wrongNotes ?? previous.wrongNotes,
      lastConfidence: result.confidence,
      lastErrorType: result.isCorrect ? '' : (result.errorType || previous.lastErrorType || ''),
      confidenceHistory: [...(previous.confidenceHistory || []), result.confidence].slice(-50),
      answerHistory: [...(previous.answerHistory || []), event].slice(-50),
      timeHistory: result.timeSpentSec == null ? (previous.timeHistory || []) : [...(previous.timeHistory || []), result.timeSpentSec].slice(-50),
      highConfidenceWrong: (previous.highConfidenceWrong || 0) + (!result.isCorrect && result.confidence >= 4 ? 1 : 0),
      repeatedWrong: result.isCorrect ? 0 : (previous.repeatedWrong || 0) + 1,
      wrongRetestAttempts: (previous.wrongRetestAttempts || 0) + (wasPreviouslyWrong ? 1 : 0),
      wrongRetestCorrect: (previous.wrongRetestCorrect || 0) + (wasPreviouslyWrong && result.isCorrect ? 1 : 0),
      errorTypes: result.isCorrect || !result.errorType || (previous.errorTypes || []).at(-1) === result.errorType
        ? (previous.errorTypes || [])
        : [...(previous.errorTypes || []), result.errorType].slice(-20),
      lastRemediationTask: remediationEvent || previous.lastRemediationTask || null,
      remediationTasks: remediationEvent ? [remediationEvent, ...(previous.remediationTasks || [])].slice(0, 20) : (previous.remediationTasks || []),
    };
  });

  return nextStats;
}

function regradeBatchQuestionResult(stats, result, mode, attemptId) {
  const previous = { ...emptyStat(), ...(stats?.[result.questionId] || {}) };
  const previousEvent = (previous.answerHistory || []).find((event) => event?.attemptId === attemptId);
  if (!previousEvent) {
    return applyBatchQuestionResults(stats, [result], mode, attemptId);
  }
  if (
    previousEvent.correctAnswer === result.correctAnswer
    && previousEvent.isCorrect === result.isCorrect
    && previousEvent.rating === (result.rating || (result.isCorrect ? 'Good' : 'Again'))
  ) return stats;

  const previousWasWrongRetest = previousEvent.wasPreviouslyWrong
    ?? ((previous.wrong || 0) - (previousEvent.isCorrect ? 0 : 1) > 0);
  const oldMasteryDelta = getMasteryDeltaByRating(previousEvent.rating || (previousEvent.isCorrect ? 'Good' : 'Again'));
  const previousSnapshot = previousEvent.previousStat || {};
  const remainingHistory = (previous.answerHistory || []).filter((event) => event?.attemptId !== attemptId);
  const trailingWrong = [...remainingHistory].reverse().findIndex((event) => event?.isCorrect);

  const cleanedStat = {
    ...previous,
    attempts: Math.max(0, (previous.attempts || 0) - 1),
    correct: Math.max(0, (previous.correct || 0) - (previousEvent.isCorrect ? 1 : 0)),
    wrong: Math.max(0, (previous.wrong || 0) - (previousEvent.isCorrect ? 0 : 1)),
    answerHistory: remainingHistory,
    mastery: previousSnapshot.mastery ?? Math.max(0, Math.min(5, (previous.mastery || 0) - oldMasteryDelta)),
    repeatedWrong: previousSnapshot.repeatedWrong ?? (trailingWrong < 0 ? remainingHistory.filter((event) => event?.isCorrect === false).length : trailingWrong),
    highConfidenceWrong: Math.max(0, (previous.highConfidenceWrong || 0) - (!previousEvent.isCorrect && previousEvent.confidence >= 4 ? 1 : 0)),
    wrongRetestAttempts: previousSnapshot.wrongRetestAttempts ?? Math.max(0, (previous.wrongRetestAttempts || 0) - (previousWasWrongRetest ? 1 : 0)),
    wrongRetestCorrect: previousSnapshot.wrongRetestCorrect ?? Math.max(0, (previous.wrongRetestCorrect || 0) - (previousWasWrongRetest && previousEvent.isCorrect ? 1 : 0)),
    intervalDays: previousSnapshot.intervalDays ?? previous.intervalDays,
    nextReviewDate: Object.hasOwn(previousSnapshot, 'nextReviewDate') ? previousSnapshot.nextReviewDate : previous.nextReviewDate,
    lastResult: Object.hasOwn(previousSnapshot, 'lastResult') ? previousSnapshot.lastResult : previous.lastResult,
    lastRating: Object.hasOwn(previousSnapshot, 'lastRating') ? previousSnapshot.lastRating : previous.lastRating,
    lastAttemptAt: Object.hasOwn(previousSnapshot, 'lastAttemptAt') ? previousSnapshot.lastAttemptAt : previous.lastAttemptAt,
    lastErrorType: previousSnapshot.lastErrorType ?? previous.lastErrorType,
    confidenceHistory: (previous.confidenceHistory || []).slice(0, -1),
    timeHistory: previousEvent.timeSpentSec == null ? (previous.timeHistory || []) : (previous.timeHistory || []).slice(0, -1),
    remediationTasks: (previous.remediationTasks || []).filter((task) => task?.attemptId !== attemptId),
  };
  return applyBatchQuestionResults({ ...(stats || {}), [result.questionId]: cleanedStat }, [result], mode, attemptId);
}

function applyBatchQuestionNotes(stats, questionId, attemptId, patch = {}) {
  const previous = stats?.[questionId];
  if (!previous || !(previous.answerHistory || []).some((event) => event?.attemptId === attemptId)) return stats;
  const notePatch = {
    ...(patch.explanation !== undefined ? { explanation: patch.explanation } : {}),
    ...(patch.wrongNotes !== undefined ? { wrongNotes: patch.wrongNotes } : {}),
  };
  if (!Object.keys(notePatch).length) return stats;
  const attemptEvent = (previous.answerHistory || []).find((event) => event?.attemptId === attemptId);
  const alreadySynced = Object.entries(notePatch).every(([key, value]) => previous[key] === value && attemptEvent?.[key] === value);
  if (alreadySynced) return stats;
  return {
    ...(stats || {}),
    [questionId]: {
      ...previous,
      ...notePatch,
      answerHistory: (previous.answerHistory || []).map((event) => (
        event?.attemptId === attemptId ? { ...event, ...notePatch } : event
      )),
    },
  };
}

function applyBatchRemediationsToStats(stats, results, attemptId) {
  const nextStats = { ...(stats || {}) };

  results.forEach((result) => {
    if (result.isCorrect || !result.errorType) return;
    const previous = { ...emptyStat(), ...(nextStats[result.questionId] || {}) };
    const remediation = getRemediationForErrorType(result.errorType);
    const remediationEvent = {
      date: TODAY,
      questionId: result.questionId,
      errorType: result.errorType,
      task: remediation.task,
      cardType: remediation.cardType,
      action: remediation.action,
      attemptId,
    };
    const answerHistory = (previous.answerHistory || []).map((event) => (
      event?.attemptId === attemptId
        ? { ...event, errorType: result.errorType, remediationTask: remediation.task, remediationCardType: remediation.cardType }
        : event
    ));
    const alreadyHasRemediation = (previous.remediationTasks || []).some((task) => task?.attemptId === attemptId);

    nextStats[result.questionId] = {
      ...previous,
      lastErrorType: result.errorType,
      errorTypes: (previous.errorTypes || []).at(-1) === result.errorType
        ? (previous.errorTypes || [])
        : [...(previous.errorTypes || []), result.errorType].slice(-20),
      answerHistory,
      lastRemediationTask: remediationEvent,
      remediationTasks: alreadyHasRemediation
        ? (previous.remediationTasks || []).map((task) => task?.attemptId === attemptId ? remediationEvent : task)
        : [remediationEvent, ...(previous.remediationTasks || [])].slice(0, 20),
    };
  });

  return nextStats;
}

function getAnkiIntervalDays(rating, stat = {}) {
  const current = Math.max(1, Number(stat.intervalDays) || 1);
  const attempts = Number(stat.attempts) || 0;

  if (rating === 'Again') return 1;

  if (attempts <= 0) {
    if (rating === 'Hard') return 2;
    if (rating === 'Good') return 3;
    if (rating === 'Easy') return 5;
  }

  if (rating === 'Hard') return Math.max(2, Math.round(current * 1.2));
  if (rating === 'Good') return Math.max(current + 1, Math.round(current * 2.5));
  if (rating === 'Easy') return Math.max(current + 3, Math.round(current * 3.5));
  return Math.max(3, current);
}

function formatReviewDueLabel(nextReviewDate, date = TODAY) {
  const days = daysBetween(date, nextReviewDate);
  if (days < 0) return `已到期 · ${nextReviewDate}`;
  if (days === 0) return `今天 · ${nextReviewDate}`;
  if (days === 1) return `明天 · ${nextReviewDate}`;
  return `${days} 天後 · ${nextReviewDate}`;
}

function getReviewSchedulePreview(rating, stat = {}, date = TODAY) {
  const intervalDays = getAnkiIntervalDays(rating, stat);
  const nextReviewDate = addDays(date, intervalDays);
  return {
    intervalDays,
    nextReviewDate,
    dueLabel: formatReviewDueLabel(nextReviewDate, date),
    shortLabel: intervalDays === 1 ? '明天' : `${intervalDays} 天後`,
  };
}

function getFlashcardReviewSchedulePreview(rating, stat = {}, date = TODAY) {
  if (rating === 'Again') {
    return {
      intervalDays: 0,
      nextReviewDate: date,
      dueLabel: '本次複習 · 10 cards 後',
      shortLabel: '10 cards 後',
    };
  }
  return getReviewSchedulePreview(rating, stat, date);
}


function shuffleStable(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function getQuestionContentText(question) {
  return [
    question?.id,
    question?.topic,
    question?.stem,
    ...(question?.trials || []),
    ...Object.values(question?.options || {}),
    question?.explanation,
  ].filter(Boolean).join(' ').toLowerCase();
}

function getQuestionPromptText(question) {
  return [
    question?.id,
    question?.topic,
    question?.stem,
    ...(question?.trials || []),
    ...Object.values(question?.options || {}),
  ].filter(Boolean).join(' ').toLowerCase();
}

function questionMatchesHighYieldTopic(question, highYieldTopic, cachedQuestionText = null) {
  if (!question || !highYieldTopic) return false;
  const questionText = cachedQuestionText || getQuestionContentText(question);
  const aliases = highYieldTopic.aliases || [];
  const cancerMatch = question.cancer === highYieldTopic.cancer
    || (highYieldTopic.cancer === 'Supportive/Stats' && ['Supportive/Stats', 'Other'].includes(question.cancer));
  const aliasHit = aliases.some((alias) => questionText.includes(String(alias).toLowerCase()));
  return aliasHit || (cancerMatch && aliases.some((alias) => String(question.topic || '').toLowerCase().includes(String(alias).toLowerCase())));
}

function scoreHighYieldTopicFromStats(highYieldTopic, stats) {
  const recencyFactor = Math.min(3, Math.log2(stats.daysSinceReview + 1));
  return Math.round(
    highYieldTopic.examFrequency
    * highYieldTopic.recentUpdate
    * stats.wrongRateFactor
    * recencyFactor
    * 10
  ) / 10;
}

function getRankedHighYieldTopics(state, task = null) {
  const questionRows = getQuestionPool(state)
    .map((q) => getQuestionWithOverride(q.id, state))
    .filter(Boolean)
    .map((q) => ({
      q,
      stat: getStat(state, q.id),
      text: getQuestionContentText(q),
    }));

  return HIGH_YIELD_TOPICS
    .map((topic) => {
      let total = 0;
      let attempts = 0;
      let wrong = 0;
      let latestAttemptAt = '';
      questionRows.forEach((row) => {
        if (!questionMatchesHighYieldTopic(row.q, topic, row.text)) return;
        total += 1;
        attempts += row.stat.attempts || 0;
        wrong += row.stat.wrong || 0;
        if (row.stat.lastAttemptAt && row.stat.lastAttemptAt > latestAttemptAt) {
          latestAttemptAt = row.stat.lastAttemptAt;
        }
      });
      const stats = {
        total,
        attempts,
        wrongRateFactor: attempts ? Math.max(1, wrong / attempts) : 1,
        daysSinceReview: latestAttemptAt ? Math.max(1, daysBetween(latestAttemptAt, TODAY)) : 30,
      };
      const mainlineBonus = task && (topic.cancer === task.cancer || getTaskSearchText(task).includes(topic.label.toLowerCase())) ? 1.25 : 1;
      const score = Math.round(scoreHighYieldTopicFromStats(topic, stats) * mainlineBonus * 10) / 10;
      return { ...topic, priorityScore: score };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore || b.examFrequency - a.examFrequency || b.recentUpdate - a.recentUpdate);
}

function formatPracticeRecipe(config) {
  return `New ${config.newCount} / Topic ${config.topicCount} / Due ${config.dueCount} / Weakness ${config.weaknessCount} / High-yield ${config.highYieldCount || 0}`;
}

function getCancerAliases(cancer) {
  const aliases = {
    Breast: ['breast', '乳癌'],
    Lung: ['lung', '肺', 'nsclc', 'sclc'],
    GI: ['gi', 'gastro', 'colon', 'rectal', 'crc', 'gastric', 'esophageal', 'hcc', 'biliary', 'pancreas', '大腸', '直腸', '胃', '食道', '肝', '膽', '胰'],
    GU: ['gu', 'rcc', 'renal', 'urothelial', 'prostate', 'seminoma', 'kidney', '膀胱', '攝護腺', '腎', '泌尿'],
    GYN: ['gyn', 'endometrial', 'cervical', 'ovarian', '子宮', '卵巢', '婦癌'],
    Heme: ['heme', 'lymphoma', 'leukemia', 'myeloma', '淋巴', '白血', '骨髓'],
    'Head & Neck': ['head', 'neck', 'hnscc', 'npc', 'oropharyngeal', 'nasopharyngeal', '頭頸', '鼻咽', '口咽'],
  };
  return aliases[cancer] || [String(cancer || '').toLowerCase()];
}

function scoreQuestionForTask(question, task) {
  if (!question || !task) return 0;
  const questionText = getQuestionContentText(question);
  const keywords = getTaskKeywords(task);
  const trialHits = (task.goldenTrials || []).filter((trial) => questionText.includes(String(trial).toLowerCase())).length;
  const focusHits = (task.focusTags || []).filter((tag) => questionText.includes(String(tag).toLowerCase())).length;
  const keywordHits = keywords.filter((keyword) => questionText.includes(keyword)).length;
  const sameCancer = question.cancer === task.cancer;
  const topicHit = question.topic && getTaskSearchText(task).includes(String(question.topic).toLowerCase());

  return (sameCancer ? 100 : 0)
    + (topicHit ? 20 : 0)
    + (trialHits * 35)
    + (focusHits * 18)
    + keywordHits;
}

function questionMatchesTask(question, task, minScore = 120) {
  const promptText = getQuestionPromptText(question);
  const trialHits = (task?.goldenTrials || []).filter((trial) => promptText.includes(String(trial).toLowerCase())).length;
  const focusHits = (task?.focusTags || []).filter((tag) => promptText.includes(String(tag).toLowerCase())).length;
  const keywordHits = getTaskKeywords(task).filter((keyword) => promptText.includes(keyword)).length;
  const hasCancerSignal = getCancerAliases(task?.cancer).some((alias) => promptText.includes(alias));
  const hasTaskSpecificHit = trialHits > 0 || focusHits > 0 || keywordHits >= 2;
  const hasEnoughPromptEvidence = hasCancerSignal || trialHits > 0 || focusHits >= 2 || keywordHits >= 4;
  if (!hasTaskSpecificHit || !hasEnoughPromptEvidence) return false;
  return hasTaskSpecificHit && scoreQuestionForTask(question, task) >= minScore;
}

function getKnowledgeTopicStatus({ coverage, accuracy, criticalCount, dueCount }) {
  if (criticalCount > 0 || accuracy < 70 || coverage < 40) return 'Needs attention';
  if (dueCount > 0 || accuracy < 80 || coverage < 75) return 'In progress';
  return 'On track';
}

function buildKnowledgeTopics(questionState, flashcardState, planProgress = {}) {
  const questions = getQuestionPool(questionState)
    .map((question) => getQuestionWithOverride(question.id, questionState))
    .filter(Boolean);
  const cards = getFlashcardList(flashcardState);

  return studyPlan100.map((task) => {
    const questionRows = questions
      .filter((question) => questionMatchesTask(question, task))
      .map((question) => ({ question, stat: getStat(questionState, question.id) }));
    const topicCards = cards.filter((card) => knowledgeCardMatchesTask(card, task));
    const attempts = questionRows.reduce((sum, { stat }) => sum + (stat.attempts || 0), 0);
    const correct = questionRows.reduce((sum, { stat }) => sum + (stat.correct || 0), 0);
    const attemptedQuestions = questionRows.filter(({ stat }) => (stat.attempts || 0) > 0).length;
    const dueQuestions = questionRows.filter(({ stat }) => stat.nextReviewDate && stat.nextReviewDate <= TODAY);
    const dueCards = topicCards.filter((card) => {
      const stat = flashcardState.flashcardStats?.[card.id] || {};
      return stat.nextReviewDate && stat.nextReviewDate <= TODAY;
    });
    const criticalQuestions = questionRows.filter(({ stat }) => (
      (stat.highConfidenceWrong || 0) > 0
      || (stat.repeatedWrong || 0) >= 2
      || (stat.wrong || 0) >= 2
    ));
    const notionNotes = [...new Map(questionRows
      .map(({ question }) => ({
        question,
        url: normalizeNotionExternalUrl(question.notionUrl),
      }))
      .filter(({ url }) => url)
      .map(({ question, url }) => [url, {
        url,
        title: question.trials?.[0] || question.topic || question.id,
        questionId: question.id,
      }])).values()];
    const trials = [...new Set([
      ...(task.goldenTrials || []),
      ...(task.relatedTrials || []),
      ...questionRows.flatMap(({ question }) => question.trials || []),
      ...topicCards.flatMap((card) => normalizeTextList(card.trial || card.trials)),
    ].filter(Boolean))];
    const coverage = questionRows.length ? Math.round((attemptedQuestions / questionRows.length) * 100) : 0;
    const accuracy = attempts ? Math.round((correct / attempts) * 100) : 0;
    const dueCount = dueQuestions.length + dueCards.length;
    const searchText = [
      task.cancer,
      task.module,
      task.topic,
      task.details,
      ...(task.focusTags || []),
      ...trials,
      ...questionRows.flatMap(({ question }) => [question.id, question.stem]),
      ...topicCards.flatMap((card) => [card.front, card.back]),
    ].filter(Boolean).join(' ').toLowerCase();

    return {
      id: task.key,
      task,
      cancer: task.cancer,
      title: task.topic,
      details: task.details,
      focusTags: task.focusTags || [],
      priority: task.priority || 'Standard',
      highYieldWeight: task.highYieldWeight || 0,
      completed: getPlanProgressValue(planProgress, task),
      questionRows,
      cards: topicCards,
      trials,
      notionNotes,
      criticalQuestions,
      attempts,
      accuracy,
      coverage,
      dueQuestions,
      dueCards,
      dueCount,
      status: getKnowledgeTopicStatus({ coverage, accuracy, criticalCount: criticalQuestions.length, dueCount }),
      searchText,
    };
  });
}

function generateDailyQuestionIds(state, task = getTodayPlanTask(state), excludedIds = [], rankedHighYieldTopics = null) {
  const { preferredYears, preferredCancers } = state.settings;
  const modeConfig = getPracticeModeConfig(state.settings?.practiceMode);
  const excluded = new Set(excludedIds);
  const rankedTopics = rankedHighYieldTopics || getRankedHighYieldTopics(state, task);
  const topHighYieldTopics = rankedTopics.slice(0, 5);

  const pool = getQuestionPool(state)
    .map((q) => getQuestionWithOverride(q.id, state))
    .filter(Boolean)
    .filter((q) => !excluded.has(q.id))
    .filter((q) => {
      const yearOk = !preferredYears || preferredYears.length === 0 || preferredYears.includes(Number(q.year));
      const cancerOk = !preferredCancers || preferredCancers.length === 0 || preferredCancers.includes(q.cancer);
      return yearOk && cancerOk;
    });

  const withStats = pool.map((q) => ({ q, stat: getStat(state, q.id), questionText: getQuestionContentText(q) }));
  const topical = withStats
    .map((item) => ({ ...item, taskScore: scoreQuestionForTask(item.q, task) }))
    .filter((item) => questionMatchesTask(item.q, task))
    .sort((a, b) => b.taskScore - a.taskScore);

  const due = withStats
    .filter(({ stat }) => stat.nextReviewDate && stat.nextReviewDate <= TODAY)
    .sort((a, b) => wrongRate(b.stat) - wrongRate(a.stat) || String(a.stat.nextReviewDate || '').localeCompare(String(b.stat.nextReviewDate || '')));
  const weaknessTrap = withStats
    .map((item) => ({ ...item, taskScore: scoreQuestionForTask(item.q, task) }))
    .filter(({ stat }) => stat.wrong > 0 || stat.bookmarked || (stat.highConfidenceWrong || 0) > 0 || (stat.repeatedWrong || 0) > 0)
    .sort((a, b) => (b.stat.highConfidenceWrong || 0) - (a.stat.highConfidenceWrong || 0)
      || (b.stat.repeatedWrong || 0) - (a.stat.repeatedWrong || 0)
      || wrongRate(b.stat) - wrongRate(a.stat)
      || b.taskScore - a.taskScore);
  const highYield = withStats
    .map((item) => {
      const matchedTopics = topHighYieldTopics.filter((topic) => questionMatchesHighYieldTopic(item.q, topic, item.questionText));
      const topicScore = matchedTopics.reduce((max, topic) => Math.max(max, topic.priorityScore || 0), 0);
      const personalScore = 1
        + wrongRate(item.stat) / 100
        + ((item.stat.highConfidenceWrong || 0) * 0.5)
        + Math.min(1, daysBetween(item.stat.lastAttemptAt, TODAY) / 30);
      return {
        ...item,
        highYieldScore: Math.round(topicScore * personalScore * 10) / 10,
        matchedTopics,
      };
    })
    .filter((item) => item.matchedTopics.length > 0)
    .sort((a, b) => b.highYieldScore - a.highYieldScore || wrongRate(b.stat) - wrongRate(a.stat));
  const newQuestions = withStats.filter(({ stat }) => (stat.attempts || 0) === 0);
  const bookmarked = withStats.filter(({ stat }) => stat.bookmarked);
  const regular = withStats.filter(({ stat }) => (stat.attempts || 0) > 0 && !(stat.nextReviewDate && stat.nextReviewDate <= TODAY) && !(stat.wrong > 0 && wrongRate(stat) >= 50));

  const pickUnique = (source, count, used) => {
    const shuffled = shuffleStable(source);
    const selected = [];
    for (const item of shuffled) {
      if (selected.length >= count) break;
      if (used.has(item.q.id)) continue;
      selected.push(item.q.id);
      used.add(item.q.id);
    }
    return selected;
  };
  const pickOrdered = (source, count, used) => {
    const selected = [];
    for (const item of source) {
      if (selected.length >= count) break;
      if (used.has(item.q.id)) continue;
      selected.push(item.q.id);
      used.add(item.q.id);
    }
    return selected;
  };

  const used = new Set();
  const result = [];

  result.push(...pickUnique(newQuestions, modeConfig.newCount, used));
  result.push(...pickOrdered(topical, modeConfig.topicCount, used));
  result.push(...pickOrdered(due, modeConfig.dueCount, used));
  result.push(...pickOrdered(weaknessTrap, modeConfig.weaknessCount, used));
  result.push(...pickOrdered(highYield, modeConfig.highYieldCount || 0, used));

  while (result.length < modeConfig.total) {
    const before = result.length;
    result.push(...pickUnique(newQuestions, 1, used));
    if (result.length >= modeConfig.total) break;
    result.push(...pickOrdered(topical, 1, used));
    if (result.length >= modeConfig.total) break;
    result.push(...pickOrdered(highYield, 1, used));
    if (result.length === before) break;
  }

  if (result.length < modeConfig.total) {
    result.push(...pickOrdered(due, modeConfig.total - result.length, used));
  }
  if (result.length < modeConfig.total) {
    result.push(...pickOrdered(weaknessTrap, modeConfig.total - result.length, used));
  }
  if (result.length < modeConfig.total) {
    result.push(...pickOrdered(highYield, modeConfig.total - result.length, used));
  }
  if (result.length < modeConfig.total) {
    result.push(...pickUnique(bookmarked, modeConfig.total - result.length, used));
  }
  if (result.length < modeConfig.total) {
    result.push(...pickUnique(regular, modeConfig.total - result.length, used));
  }
  if (result.length < modeConfig.total) {
    result.push(...pickUnique(withStats, modeConfig.total - result.length, used));
  }

  return result.slice(0, modeConfig.total);
}

function fillDailyQuestionIds(state, task, existingIds = [], targetCount = PRACTICE_PAGE_SIZE, rankedHighYieldTopics = null, excludedIds = []) {
  const baseIds = Array.isArray(existingIds) ? existingIds : [];
  const excluded = [...new Set([...baseIds, ...(Array.isArray(excludedIds) ? excludedIds : [])])];
  const generatedIds = generateDailyQuestionIds(state, task, excluded, rankedHighYieldTopics);
  const questionIds = [...baseIds, ...generatedIds]
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .slice(0, targetCount);

  if (questionIds.length >= targetCount) return questionIds;

  const used = new Set([...questionIds, ...excluded]);
  const { preferredYears, preferredCancers } = state.settings || {};
  const fallbackIds = getQuestionPool(state)
    .map((q) => getQuestionWithOverride(q.id, state))
    .filter(Boolean)
    .filter((q) => !used.has(q.id))
    .filter((q) => {
      const yearOk = !preferredYears || preferredYears.length === 0 || preferredYears.includes(Number(q.year));
      const cancerOk = !preferredCancers || preferredCancers.length === 0 || preferredCancers.includes(q.cancer);
      return yearOk && cancerOk;
    })
    .sort((a, b) => {
      const aStat = getStat(state, a.id);
      const bStat = getStat(state, b.id);
      return (aStat.attempts || 0) - (bStat.attempts || 0)
        || wrongRate(bStat) - wrongRate(aStat)
        || String(a.id).localeCompare(String(b.id));
    })
    .map((q) => q.id);

  return [...questionIds, ...fallbackIds].slice(0, targetCount);
}

const BOSS_DEFINITIONS = [
  { id: 'lung', name: 'Lung Boss', module: 'Lung', cancer: 'Lung', unlockPercent: 80, passScore: 80 },
  { id: 'breast', name: 'Breast Boss', module: 'Breast', cancer: 'Breast', unlockPercent: 80, passScore: 80 },
  { id: 'gi', name: 'GI Boss', module: 'GI', cancer: 'GI', unlockPercent: 80, passScore: 78 },
  { id: 'head-neck', name: 'Head & Neck Boss', module: 'Head & Neck', cancer: 'Head & Neck', unlockPercent: 80, passScore: 78 },
  { id: 'trial', name: 'Trial Boss', module: 'Trial Cards', cancer: 'Trial Cards', unlockPercent: 50, passScore: 85 },
  { id: 'final-board', name: 'Final Board Boss', module: 'Final Board', cancer: 'Mock', unlockPercent: 100, passScore: 75 },
];

function getModuleProgress(planProgress = {}) {
  return studyPlan100.reduce((acc, task) => {
    if (!acc[task.module]) acc[task.module] = { module: task.module, total: 0, completed: 0 };
    acc[task.module].total += 1;
    if (getPlanProgressValue(planProgress, task)) acc[task.module].completed += 1;
    return acc;
  }, {});
}

function examMatchesBoss(exam, boss) {
  if (!exam?.completedAt) return false;
  if (boss.id === 'final-board') {
    return exam.questionCount >= 50 && exam.score >= boss.passScore;
  }
  if (boss.id === 'trial') {
    return exam.mode === 'trial-boss' && exam.score >= boss.passScore;
  }
  const cancerResults = (exam.results || []).filter((result) => result.cancer === boss.cancer);
  return cancerResults.length >= 20 && exam.score >= boss.passScore && cancerResults.length / Math.max(1, exam.results?.length || 1) >= 0.75;
}

function getBossRows(state, readiness = getReadinessMetrics(state)) {
  const progress = getModuleProgress(state.planProgress || {});
  const trialCards = getFlashcardList(state).filter((card) => card.sourceType === 'trial' || card.type === 'Trial Card').length;
  const completedYears = new Set((state.mockExams || [])
    .filter((exam) => exam.completedAt && exam.year)
    .map((exam) => Number(exam.year)));
  return BOSS_DEFINITIONS.map((boss) => {
    let unlockValue;
    let unlocked;
    if (boss.id === 'trial') {
      unlockValue = trialCards;
      unlocked = trialCards >= 50;
    } else if (boss.id === 'final-board') {
      unlockValue = completedYears.size;
      unlocked = QUESTION_YEARS.every((year) => completedYears.has(year));
    } else {
      const row = progress[boss.module] || { total: 0, completed: 0 };
      unlockValue = row.total ? Math.round((row.completed / row.total) * 100) : 0;
      unlocked = unlockValue >= boss.unlockPercent;
    }
    const defeated = boss.id === 'final-board'
      ? unlocked && readiness.wrongRetestConversion >= 90 && (state.mockExams || []).some((exam) => exam.completedAt && exam.score >= boss.passScore && exam.questionCount >= 50)
      : (state.mockExams || []).some((exam) => examMatchesBoss(exam, boss));
    return { ...boss, unlockValue, unlocked, defeated };
  });
}

function syncBossGameState(state, readiness = getReadinessMetrics(state)) {
  const bosses = getBossRows(state, readiness);
  const unlockedBosses = [...new Set([...(state.game?.unlockedBosses || []), ...bosses.filter((boss) => boss.unlocked).map((boss) => boss.id)])];
  const previousDefeated = new Set(state.game?.defeatedBosses || []);
  const newlyDefeated = bosses.filter((boss) => boss.defeated && !previousDefeated.has(boss.id));
  const defeatedBosses = [...new Set([...(state.game?.defeatedBosses || []), ...newlyDefeated.map((boss) => boss.id)])];
  const game = newlyDefeated.reduce(
    (nextGame, boss) => awardXp(nextGame, boss.id === 'final-board' ? XP_RULES.fullMock75 : XP_RULES.cancerBoss, `${boss.name} defeated`, { bossId: boss.id }),
    { ...(state.game || defaultState.game), unlockedBosses, defeatedBosses }
  );
  return { ...state, game: { ...game, unlockedBosses, defeatedBosses } };
}

function buildTrialCardFromName(trialName, sourceQuestion = null) {
  const cancer = sourceQuestion?.cancer || 'Trial Cards';
  return {
    id: `trial-card-${trialName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${Date.now()}`,
    sourceType: 'trial',
    sourceId: sourceQuestion?.id || null,
    sourceQuestionId: sourceQuestion?.id || null,
    cancer,
    topic: sourceQuestion?.topic || 'Pivotal trial',
    front: `${trialName} 的 population / intervention / comparator / endpoint / exam trap？`,
    back: 'Population:\nIntervention:\nComparator:\nPrimary endpoint:\nKey result:\nToxicity / exam trap:',
    cloze: `${trialName} primary endpoint = {{c1::}}; key eligible population = {{c2::}}`,
    type: 'Trial Card',
    trial: [trialName],
    tags: sourceQuestion?.tags || { domain: cancer, subtopic: 'Pivotal trial', trial: [trialName], cardEligible: true, examWeight: 4 },
    examValue: 5,
    errorType: 'Trial confusion',
    intervalDays: 1,
    nextReviewDate: TODAY,
    mastery: 0,
    difficulty: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function getDueFlashcards(state) {
  return getFlashcardList(state)
    .filter((card) => !card.nextReviewDate || card.nextReviewDate <= TODAY)
    .sort((a, b) => (a.nextReviewDate || '').localeCompare(b.nextReviewDate || '') || (a.mastery || 0) - (b.mastery || 0));
}

function getTodayPlanTask(state) {
  return studyPlan100.find((task) => !getPlanProgressValue(state.planProgress, task)) || studyPlan100[studyPlan100.length - 1];
}

function getPlanActivityStartDate(state, date = TODAY) {
  const resetDate = String(state?.cloudMeta?.planResetAt || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(resetDate)) return resetDate;

  const questDates = Object.keys(state?.dailyQuestProgress || {}).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key));
  const sessionDates = Object.values(state?.sessions || {})
    .map((session) => session?.date)
    .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key));
  const dates = [...questDates, ...sessionDates].sort();
  return dates[0] || date;
}

function getPlanRecoveryStatus(state, planProgress = {}, date = TODAY) {
  const total = studyPlan100.length;
  const completed = studyPlan100.filter((task) => getPlanProgressValue(planProgress, task)).length;
  const uncompleted = studyPlan100.filter((task) => !getPlanProgressValue(planProgress, task));
  const startDate = getPlanActivityStartDate(state, date);
  const elapsedDays = Math.max(1, daysBetween(startDate, date) + 1);
  const expectedCompleted = Math.min(total, elapsedDays);
  const behindDays = Math.max(0, expectedCompleted - completed);
  const nextTask = uncompleted[0] || studyPlan100[studyPlan100.length - 1];
  const recoveryWindow = uncompleted.slice(1, Math.max(2, Math.min(uncompleted.length, behindDays + 5)));
  const catchUpTask = recoveryWindow.find((task) => task.priority === 'High' || task.highYieldWeight >= 4 || task.goldenTrials?.length)
    || recoveryWindow[0]
    || nextTask;
  const deferrableTask = uncompleted.find((task) => task.priority !== 'High' && (task.highYieldWeight || 3) <= 2 && task !== nextTask)
    || null;
  const mode = behindDays === 0
    ? 'On pace'
    : behindDays <= 3
      ? 'Mini recovery'
      : behindDays <= 7
        ? 'Catch-up block'
        : 'Plan rebuild';
  const guidance = behindDays === 0
    ? '維持今日主線，Review Queue 清到不累就好。'
    : behindDays <= 3
      ? '今天只加一個 15-25 分鐘 mini catch-up，不把兩天硬塞回一天。'
      : behindDays <= 7
        ? '接下來 3 天每天補一個高權重小任務，低權重背景先延後。'
        : '建議保留高權重主線，另外安排正式 catch-up day 重新配速。';

  return {
    startDate,
    elapsedDays,
    expectedCompleted,
    completed,
    behindDays,
    mode,
    guidance,
    nextTask,
    catchUpTask,
    deferrableTask,
    recoveryPercent: expectedCompleted ? Math.min(100, Math.round((completed / expectedCompleted) * 100)) : 100,
  };
}

function getDailyQuestBucket(state, date = TODAY) {
  const saved = state.dailyQuestProgress?.[date] || {};
  if (saved.tasks) return saved;
  if (!saved.planTaskId) return { activeTaskId: null, tasks: {} };
  return {
    activeTaskId: saved.planTaskId,
    tasks: {
      [saved.planTaskId]: saved,
    },
  };
}

function getSavedDailyQuestTask(state, date, taskId) {
  const bucket = getDailyQuestBucket(state, date);
  const task = getStudyPlanTaskById(taskId);
  return bucket.tasks?.[taskId]
    || (task ? bucket.tasks?.[getPlanTaskStorageId(task)] : null)
    || (task ? bucket.tasks?.[task.id] : null)
    || {};
}

function writeDailyQuestTask(state, date, taskId, progress) {
  const bucket = getDailyQuestBucket(state, date);
  const task = getStudyPlanTaskById(taskId);
  const storageId = task ? getPlanTaskStorageId(task) : taskId;
  const existingTasks = { ...(bucket.tasks || {}) };
  if (task && storageId !== String(task.id)) delete existingTasks[task.id];
  return {
    ...bucket,
    activeTaskId: storageId,
    tasks: {
      ...existingTasks,
      [storageId]: progress,
    },
  };
}

function getDailyQuestProgress(state, date = TODAY, task = getTodayPlanTask(state), practiceDone = false) {
  const planTaskId = getPlanTaskStorageId(task) || 'day-1';
  const activeSaved = getSavedDailyQuestTask(state, date, planTaskId);
  const memoryDone = Boolean(activeSaved.memoryDone);
  const bossDone = Boolean(activeSaved.bossDone);
  const practiceStar = Boolean(activeSaved.practiceDone || practiceDone);
  const stars = [practiceStar, memoryDone, bossDone].filter(Boolean).length;
  return {
    ...makePlanTaskSnapshot(task),
    planTaskId,
    practiceDone: practiceStar,
    memoryDone,
    bossDone,
    stars,
    xpClaimed: Boolean(activeSaved.xpClaimed),
    stageClearedAt: activeSaved.stageClearedAt || null,
    recallRatings: activeSaved.recallRatings || {},
    bossResults: activeSaved.bossResults || {},
    failedMasteryReviewDate: activeSaved.failedMasteryReviewDate || null,
    perfectClear: Boolean(activeSaved.perfectClear),
  };
}

function getHighValueCardsCreatedToday(state, date = TODAY) {
  return getFlashcardList(state).filter((card) => (
    String(card.createdAt || '').startsWith(date)
    && normalizeExamValue(card.examValue) >= 4
  ));
}

function hasDailyPracticeRating(state, id, date = TODAY) {
  const stat = getStat(state, id);
  return (stat.answerHistory || []).some((event) => (
    event?.date === date
    && event?.mode === 'daily'
    && event?.questionId === id
  ));
}

function getDailyWrongErrorTypeStatus(state, questionIds = [], date = TODAY) {
  const wrongRated = questionIds
    .map((id) => {
      const question = getQuestionWithOverride(id, state);
      const draft = state.sessions?.[date]?.practiceDrafts?.[id] || {};
      const stat = getStat(state, id);
      const latestDailyEvent = [...(stat.answerHistory || [])]
        .reverse()
        .find((event) => event?.date === date && event?.mode === 'daily' && event?.questionId === id);
      const selected = String(draft.selected || latestDailyEvent?.selected || stat.userAnswer || '').trim().toUpperCase();
      const correctAnswer = String(draft.correctAnswer || latestDailyEvent?.correctAnswer || stat.correctAnswer || question?.answer || '').trim().toUpperCase();
      const isWrong = hasDailyPracticeRating(state, id, date) && selected && correctAnswer && selected !== correctAnswer;
      return isWrong ? { id, errorType: draft.errorType || latestDailyEvent?.errorType || stat.lastErrorType || '' } : null;
    })
    .filter(Boolean);
  return {
    wrongRatedCount: wrongRated.length,
    classifiedCount: wrongRated.filter((row) => row.errorType).length,
    complete: wrongRated.every((row) => row.errorType),
  };
}

function getTaskCriteriaItems(task) {
  return task?.completionCriteria || dailyCompletionCriteria;
}

function getTaskKnowledgeItems(task) {
  return [...new Set([...(task?.goldenTrials || []), ...(task?.focusTags || [])])];
}

function getPlanItemProgressForTask(state, taskId) {
  return normalizePlanItemProgress(state?.planItemProgress)[taskId] || { criteria: {}, knowledge: {}, updatedAt: null };
}

function isTaskItemGroupComplete(items, progressGroup = {}) {
  return items.length === 0 || items.every((item) => Boolean(progressGroup[item]));
}

function isTaskFullyConfirmed(task, itemProgress) {
  return isTaskItemGroupComplete(getTaskCriteriaItems(task), itemProgress?.criteria)
    && isTaskItemGroupComplete(getTaskKnowledgeItems(task), itemProgress?.knowledge);
}

function buildFullPlanItemProgress(task, checked) {
  const now = new Date().toISOString();
  return {
    criteria: checked ? Object.fromEntries(getTaskCriteriaItems(task).map((item) => [item, true])) : {},
    knowledge: checked ? Object.fromEntries(getTaskKnowledgeItems(task).map((item) => [item, true])) : {},
    updatedAt: now,
  };
}

function updateDailyQuestMemoryProgress(state, date, task, practiceDone, cardId, rating = 'Read') {
  const current = getDailyQuestProgress(state, date, task, practiceDone);
  const nextRatings = { ...(current.recallRatings || {}), [cardId]: rating };
  const reviewedCount = Object.keys(nextRatings).length;
  const memoryDone = current.memoryDone || reviewedCount >= 5;
  const next = {
    ...current,
    recallRatings: nextRatings,
    memoryCardsReviewed: reviewedCount,
    memoryDone,
  };
  next.stars = [next.practiceDone, next.memoryDone, next.bossDone].filter(Boolean).length;
  return next;
}

function buildTopicRecallCards(task) {
  const firstTrial = task?.goldenTrials?.[0] || 'Golden Trial';
  const secondTrial = task?.goldenTrials?.[1] || firstTrial;
  const focus = (task?.focusTags || []).join(', ') || task?.topic || 'core trap';
  return [
    {
      id: `recall-${task?.id || 'x'}-topic`,
      sourceType: 'topic-recall',
      type: 'Algorithm Card',
      cancer: task?.cancer || 'Today',
      topic: task?.topic || 'Today topic',
      front: `${task?.topic || 'Today topic'} 的核心考點是什麼？`,
      back: task?.details || '用自己的話說出適應症、治療順序、endpoint 與常見陷阱。',
    },
    {
      id: `recall-${task?.id || 'x'}-trial`,
      sourceType: 'topic-recall',
      type: 'Trial Card',
      cancer: task?.cancer || 'Today',
      topic: task?.topic || 'Golden trial',
      front: `${firstTrial} 的 population / endpoint / implication？`,
      back: `${firstTrial}: population、intervention、primary endpoint、臨床意義與常考陷阱。`,
    },
    {
      id: `recall-${task?.id || 'x'}-focus`,
      sourceType: 'topic-recall',
      type: 'Algorithm Card',
      cancer: task?.cancer || 'Today',
      topic: task?.topic || 'Focus',
      front: `今天 ${task?.module || task?.cancer || 'topic'} 要主動回想哪些 focus tags？`,
      back: focus,
    },
    {
      id: `recall-${task?.id || 'x'}-algorithm`,
      sourceType: 'topic-recall',
      type: 'Algorithm Card',
      cancer: task?.cancer || 'Today',
      topic: task?.topic || 'Algorithm',
      front: `${task?.topic || 'Today topic'} 的 treatment sequencing / algorithm 怎麼走？`,
      back: task?.details || '先說 staging / biomarker，再說 first choice、contraindication、progression next step。',
    },
    {
      id: `recall-${task?.id || 'x'}-trap`,
      sourceType: 'topic-recall',
      type: 'Trap Card',
      cancer: task?.cancer || 'Today',
      topic: task?.topic || 'Exam trap',
      front: `${secondTrial} 或今日主題最容易被考成什麼陷阱？`,
      back: `${secondTrial}: endpoint、eligibility、toxicity、或和相似 trial 的差異。Focus: ${focus}`,
    },
  ];
}

function getQuestMemoryCards(state, task) {
  const allCards = getFlashcardList(state);
  const taskText = getTaskSearchText(task);
  const matchesTask = (card) => {
    const cardTags = normalizeTextList(card.tags);
    const cardTrials = normalizeTextList(card.trial);
    const cardText = `${card.cancer || ''} ${card.topic || ''} ${card.type || ''} ${card.front || ''} ${card.back || ''} ${cardTags.join(' ')} ${cardTrials.join(' ')}`.toLowerCase();
    const trialHit = (task?.goldenTrials || []).some((trial) => cardText.includes(String(trial).toLowerCase()));
    const focusHit = (task?.focusTags || []).some((tag) => cardText.includes(String(tag).toLowerCase()));
    const keywordHits = getTaskKeywords(task).filter((keyword) => cardText.includes(keyword)).length;
    return (Boolean(card.cancer && card.cancer === task?.cancer) && (focusHit || trialHit || keywordHits >= 2))
      || Boolean(card.topic && taskText.includes(String(card.topic).toLowerCase()))
      || trialHit;
  };
  const due = allCards.filter((card) => !card.nextReviewDate || card.nextReviewDate <= TODAY);
  const topicDue = due.filter(matchesTask);
  const topicCards = allCards.filter(matchesTask);
  const picked = [];
  const used = new Set();
  buildTopicRecallCards(task).forEach((card) => {
    if (picked.length >= 5 || used.has(card.id)) return;
    picked.push(card);
    used.add(card.id);
  });
  [...topicDue, ...topicCards, ...due].forEach((card) => {
    if (picked.length >= 5 || used.has(card.id)) return;
    picked.push(card);
    used.add(card.id);
  });
  return picked.slice(0, 5);
}

function getQuestReviewHistory(state, flashcardState) {
  const cardsById = new Map(getFlashcardList(flashcardState).map((card) => [card.id, card]));
  return Object.entries(state.dailyQuestProgress || {})
    .flatMap(([date]) => {
      const bucket = getDailyQuestBucket(state, date);
      return Object.entries(bucket.tasks || {}).map(([taskId, saved]) => {
        const planTaskId = saved.planTaskId || taskId;
        const task = getStudyPlanTaskById(planTaskId)
          || getStudyPlanTaskById(saved.legacyPlanTaskId)
          || getStudyPlanTaskById(taskId)
          || null;
        const taskLabel = task
          ? `${task.day}｜${task.topic}`
          : [saved.planDay, saved.planTopic].filter(Boolean).join('｜') || `Task ${planTaskId}`;
        const topicRecallCards = new Map(buildTopicRecallCards(task).map((card) => [card.id, card]));
        const recallRows = Object.entries(saved.recallRatings || {}).map(([cardId, rating]) => {
          const card = cardsById.get(cardId) || topicRecallCards.get(cardId) || {
            id: cardId,
            type: 'Flashcard',
            front: cardId,
            back: '',
          };
          return {
            id: cardId,
            rating,
            type: card.type || card.sourceType || 'Flashcard',
            front: card.front || cardId,
            back: card.back || '',
            topic: card.topic || task?.topic || '',
          };
        });
        return {
          id: `${date}-${planTaskId}`,
          date,
          taskId: planTaskId,
          legacyTaskId: saved.legacyPlanTaskId || task?.id || null,
          taskLabel,
          cancer: task?.cancer || saved.cancer || 'Quest',
          stars: saved.stars || [saved.practiceDone, saved.memoryDone, saved.bossDone].filter(Boolean).length,
          memoryDone: Boolean(saved.memoryDone),
          practiceDone: Boolean(saved.practiceDone),
          bossDone: Boolean(saved.bossDone),
          reviewedCount: saved.memoryCardsReviewed || recallRows.length,
          recallRows,
        };
      });
    })
    .filter((row) => row.reviewedCount > 0 || row.memoryDone || row.stars > 0)
    .sort((a, b) => b.date.localeCompare(a.date) || b.taskId - a.taskId)
    .slice(0, 14);
}

function buildBossChallenges(task) {
  const goldenTrials = [...new Set(task?.goldenTrials || [])];
  const relatedTrials = [...new Set(task?.relatedTrials || [])];
  const firstTrial = goldenTrials[0] || relatedTrials[0] || '本日無可回想 Trial';
  const goldenTrialList = goldenTrials.length ? goldenTrials.join('、') : '本日無 Golden Trial';
  const relatedTrialList = relatedTrials.length ? relatedTrials.join('、') : '本日無 Related Trial';
  const topicLabel = `${task?.day || 'Today'}｜${task?.topic || 'today topic'}`;
  return [
    {
      id: 'trial',
      title: 'Boss 1｜Trial Recall',
      prompt: `${topicLabel}\n${firstTrial}: population / endpoint / implication`,
      answerHint: '說出 P/I/C/O、primary endpoint，以及正式考最可能改寫的陷阱。',
      available: goldenTrials.length + relatedTrials.length > 0,
    },
    {
      id: 'golden-trial-list',
      title: 'Boss 2｜Golden Trial 整理',
      prompt: `${topicLabel}\n確認本日 Golden Trial：${goldenTrialList}`,
      answerHint: goldenTrials.length
        ? `本日 Golden Trial 共 ${goldenTrials.length} 個：${goldenTrialList}。確認名稱後再按 Pass。`
        : '本日沒有已通過審核且分配完成的 Golden Trial。',
      available: goldenTrials.length > 0,
    },
    {
      id: 'related-trial-list',
      title: 'Boss 3｜Related Trial 整理',
      prompt: `${topicLabel}\n確認本日 Related Trial：${relatedTrialList}`,
      answerHint: relatedTrials.length
        ? `本日 Related Trial 共 ${relatedTrials.length} 個：${relatedTrialList}。確認它們與 Golden Trial 的差異後再按 Pass。`
        : '本日沒有已通過審核且分配完成的 Related Trial。',
      available: relatedTrials.length > 0,
    },
  ];
}

function getCancerSummary(state) {
  return cancerCategories.map((cancer) => {
    const ids = getQuestionPool(state)
      .map((q) => getQuestionWithOverride(q.id, state))
      .filter((q) => (q?.tags?.cancerDomain || q?.cancer) === cancer)
      .map((q) => q.id);
    const attempts = ids.reduce((sum, id) => sum + getStat(state, id).attempts, 0);
    const wrong = ids.reduce((sum, id) => sum + getStat(state, id).wrong, 0);
    const correct = ids.reduce((sum, id) => sum + getStat(state, id).correct, 0);
    const retestAttempts = ids.reduce((sum, id) => sum + (getStat(state, id).wrongRetestAttempts || 0), 0);
    const retestCorrect = ids.reduce((sum, id) => sum + (getStat(state, id).wrongRetestCorrect || 0), 0);
    const highConfidenceWrong = ids.reduce((sum, id) => sum + (getStat(state, id).highConfidenceWrong || 0), 0);
    const attemptedQuestions = ids.filter((id) => getStat(state, id).attempts > 0).length;
    const coverage = ids.length ? Math.round((attemptedQuestions / ids.length) * 100) : 0;
    const accuracy = attempts ? Math.round((correct / attempts) * 100) : 0;
    const retestAccuracy = retestAttempts ? Math.round((retestCorrect / retestAttempts) * 100) : 0;
    const status = coverage >= 80 && accuracy >= 80 ? 'Green' : (coverage < 60 || accuracy < 70 ? 'Red' : 'Yellow');
    return {
      cancer,
      total: ids.length,
      attemptedQuestions,
      attempts,
      correct,
      wrong,
      coverage,
      accuracy,
      retestAttempts,
      retestAccuracy,
      highConfidenceWrong,
      status,
      wrongRate: attempts ? Math.round((wrong / attempts) * 100) : 0,
    };
  }).sort((a, b) => (a.status === 'Red' ? -1 : 1) - (b.status === 'Red' ? -1 : 1) || b.wrongRate - a.wrongRate || b.attempts - a.attempts);
}

function getRecentDateKeys(endDate = TODAY, count = 7) {
  return Array.from({ length: count }, (_item, index) => addDays(endDate, index - count + 1));
}

function getAnswerEventsByDate(state) {
  const byDate = {};
  Object.values(state.stats || {}).forEach((stat) => {
    (stat.answerHistory || []).forEach((event) => {
      if (!event?.date || event.isCorrect == null) return;
      if (!byDate[event.date]) byDate[event.date] = { attempts: 0, correct: 0, wrong: 0 };
      byDate[event.date].attempts += 1;
      byDate[event.date].correct += event.isCorrect ? 1 : 0;
      byDate[event.date].wrong += event.isCorrect ? 0 : 1;
    });
  });
  return byDate;
}

function getTodayAttemptSummary(state, date = TODAY) {
  const fromHistory = getAnswerEventsByDate(state)[date];
  if (fromHistory) return fromHistory;

  return Object.values(state.stats || {}).reduce((acc, stat) => {
    if (stat.lastAttemptAt !== date || !['correct', 'wrong'].includes(stat.lastResult)) return acc;
    acc.attempts += 1;
    acc.correct += stat.lastResult === 'correct' ? 1 : 0;
    acc.wrong += stat.lastResult === 'wrong' ? 1 : 0;
    return acc;
  }, { attempts: 0, correct: 0, wrong: 0 });
}

function getFocusMinutesByDate(state) {
  return normalizeFocusSessions(state?.focusSessions).reduce((acc, session) => {
    acc[session.date] = (acc[session.date] || 0) + (session.durationMinutes || 0);
    return acc;
  }, {});
}

function sumFocusMinutesByDate(state, date = TODAY) {
  return getFocusMinutesByDate(state)[date] || 0;
}

function getFocusStreak(state, date = TODAY) {
  const byDate = getFocusMinutesByDate(state);
  let streak = 0;
  let cursor = date;
  while ((byDate[cursor] || 0) > 0) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function formatFocusDuration(totalSeconds = 0) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getRivalStudyCycle(rival, elapsedMinutes = 0) {
  const focusMinutes = Math.max(1, rival.focusMinutes || 1);
  const restMinutes = Math.max(0, rival.restMinutes || 0);
  const cycleMinutes = focusMinutes + restMinutes;
  const fullCycles = Math.floor(elapsedMinutes / cycleMinutes);
  const cycleRemainder = elapsedMinutes % cycleMinutes;
  const activeInCurrentCycle = Math.min(cycleRemainder, focusMinutes);
  const activeMinutes = (fullCycles * focusMinutes) + activeInCurrentCycle;
  const isResting = cycleRemainder >= focusMinutes;
  const nextSwitchInMinutes = isResting
    ? Math.max(1, Math.ceil(cycleMinutes - cycleRemainder))
    : Math.max(1, Math.ceil(focusMinutes - cycleRemainder));

  return {
    activeMinutes,
    isResting,
    nextSwitchInMinutes,
  };
}

function buildFocusLeaderboard(userMinutes = 0, elapsedSeconds = 0) {
  const safeMinutes = Math.max(0, Math.round(Number(userMinutes) || 0));
  const elapsedMinutes = Math.min(90, Math.max(0, Number(elapsedSeconds) || 0) / 60);
  const rivals = FOCUS_RIVALS.map((rival) => {
    const cycle = getRivalStudyCycle(rival, elapsedMinutes);
    const minutes = Math.max(0, Math.floor(safeMinutes + rival.startOffset + (cycle.activeMinutes * rival.minutesPerMinute)));
    return {
      ...rival,
      minutes,
      status: cycle.isResting ? '休息中' : '讀書中',
      nextSwitchInMinutes: cycle.nextSwitchInMinutes,
      kind: 'rival',
    };
  });
  return [
    ...rivals,
    {
      id: 'you',
      name: '你',
      title: 'Oncology Board Climber',
      initials: 'ME',
      minutes: safeMinutes,
      kind: 'user',
    },
  ].sort((a, b) => b.minutes - a.minutes || (a.kind === 'user' ? -1 : 1));
}

function StudyLeaderboard({ rows }) {
  const userRank = rows.findIndex((row) => row.kind === 'user') + 1;
  return (
    <section className="study-leaderboard" aria-label="Study focus leaderboard">
      <div className="study-leaderboard-head">
        <div>
          <span>讀書時長排行榜</span>
          <strong>今日專注排名 #{userRank || '-'}</strong>
        </div>
        <em>{rows.length} players</em>
      </div>
      <div className="study-leaderboard-list">
        {rows.map((row, index) => (
          <div className={`study-leaderboard-row ${row.kind === 'user' ? 'you' : ''}`} key={row.id}>
            <span className="leaderboard-rank">{index + 1}</span>
            <span className="leaderboard-avatar">{row.initials}</span>
            <div>
              <strong>{row.name}</strong>
              <em>
                {row.kind === 'user'
                  ? row.title
                  : `${row.title} · ${row.status} · ${row.nextSwitchInMinutes} 分後切換`}
              </em>
            </div>
            <span className="leaderboard-minutes">{row.minutes} 分</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function FocusMarquee() {
  const [messages, setMessages] = useState(() => [...FOCUS_MARQUEE_MESSAGES, ...FOCUS_MARQUEE_MESSAGES]);

  useEffect(() => {
    const shuffled = [...FOCUS_MARQUEE_MESSAGES];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    setMessages([...shuffled, ...shuffled]);
  }, []);

  return (
    <div className="focus-marquee" aria-label="Focus encouragement ticker">
      <div className="focus-marquee-track">
        {messages.map((message, index) => (
          <span key={`${message}-${index}`}>{message}</span>
        ))}
      </div>
    </div>
  );
}

function PomodoroPanel({
  timer,
  remainingSeconds,
  rows,
  todayMinutes,
  focusStreak,
  onPresetChange,
  onStart,
  onPause,
  onResume,
  onCancel,
  onFinishLegacy,
}) {
  const active = timer.activeSession;
  const preset = POMODORO_PRESETS[active?.preset || timer.selectedPreset] || POMODORO_PRESETS.standard;
  const isPomodoro = active?.source === 'pomodoro';
  const phase = isPomodoro ? active.phase : 'focus';
  const phaseTotalSeconds = (phase === 'rest' ? preset.restMinutes : preset.focusMinutes) * 60;
  const progress = active && isPomodoro
    ? Math.max(0, Math.min(1, 1 - (remainingSeconds / phaseTotalSeconds)))
    : 0;
  const userRank = rows.findIndex((row) => row.kind === 'user') + 1;
  const timerLabel = active
    ? (isPomodoro ? formatFocusDuration(remainingSeconds) : '自由計時進行中')
    : formatFocusDuration(preset.focusMinutes * 60);

  return (
    <main className="panel pomodoro-page">
      <div className="section-head pomodoro-page-head">
        <div>
          <div className="eyebrow dark">Focus Studio</div>
          <h2>蕃茄鐘</h2>
          <p className="muted">完成一整段專注才會加入今日讀書排行；休息時間不計分。</p>
        </div>
        <div className="pomodoro-summary-chips">
          <span><strong>{todayMinutes}</strong> 今日分鐘</span>
          <span><strong>#{userRank || '-'}</strong> 今日排名</span>
          <span><strong>{focusStreak}</strong> 天 streak</span>
        </div>
      </div>

      <section className="pomodoro-studio">
        <article className={`pomodoro-clock-card ${phase === 'rest' ? 'resting' : ''}`}>
          <div className="pomodoro-presets" aria-label="蕃茄鐘模式">
            {Object.values(POMODORO_PRESETS).map((option) => (
              <button
                className={(active?.preset || timer.selectedPreset) === option.id ? 'active' : ''}
                disabled={Boolean(active)}
                key={option.id}
                onClick={() => onPresetChange(option.id)}
                type="button"
              >
                <strong>{option.focusMinutes}/{option.restMinutes}</strong>
                <span>{option.label}</span>
              </button>
            ))}
          </div>

          <div className="pomodoro-dial" style={{ '--pomodoro-progress': `${progress * 360}deg` }}>
            <div className="pomodoro-dial-inner">
              <span>{active ? (phase === 'rest' ? '休息時間' : '專注時間') : '準備專注'}</span>
              <strong>{timerLabel}</strong>
              <em>{active?.status === 'paused' ? '已暫停' : `${preset.focusMinutes} 分專注 · ${preset.restMinutes} 分休息`}</em>
            </div>
          </div>

          <div className="pomodoro-actions">
            {!active && (
              <button className="primary pomodoro-primary" type="button" onClick={onStart}>
                <Play size={18} fill="currentColor" /> 開始專注
              </button>
            )}
            {active && isPomodoro && active.status === 'running' && (
              <button className="secondary" type="button" onClick={onPause}><Pause size={18} /> 暫停</button>
            )}
            {active && isPomodoro && active.status === 'paused' && (
              <button className="good" type="button" onClick={onResume}><Play size={18} fill="currentColor" /> 繼續</button>
            )}
            {active && !isPomodoro && (
              <button className="good" type="button" onClick={onFinishLegacy}>結束舊計時並記錄</button>
            )}
            {active && (
              <button className="danger-soft" type="button" onClick={onCancel}><RotateCcw size={18} /> 取消本輪</button>
            )}
          </div>
          {active && isPomodoro && phase === 'rest' && (
            <p className="pomodoro-phase-note">本輪專注已完整記錄。休息結束後會停下來，等你手動開始下一輪。</p>
          )}
        </article>

        <article className="pomodoro-video-card">
          <div className="pomodoro-video-head">
            <div>
              <span>Study ambience</span>
              <strong>專注影片</strong>
            </div>
            <a href={`https://www.youtube.com/watch?v=${POMODORO_VIDEO_ID}`} target="_blank" rel="noreferrer">
              前往 YouTube <ExternalLink size={15} />
            </a>
          </div>
          <div className="pomodoro-video-frame">
            <iframe
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              src={`https://www.youtube-nocookie.com/embed/${POMODORO_VIDEO_ID}?rel=0`}
              title="蕃茄鐘專注影片"
            />
          </div>
          <p className="muted">若影片禁止嵌入，計時器仍可獨立使用，並可由上方連結開啟 YouTube。</p>
        </article>
      </section>

      <FocusMarquee />
      <StudyLeaderboard rows={rows} />
    </main>
  );
}

function getWeakCancerRowsFromStoredStats(state) {
  const rows = Object.values(state.stats || {}).reduce((acc, stat) => {
    const recentEvent = [...(stat.answerHistory || [])].reverse().find((event) => event?.cancer);
    const cancer = recentEvent?.cancer || stat.cancer || 'Unclassified';
    if (!acc[cancer]) acc[cancer] = { cancer, attempts: 0, correct: 0, wrong: 0 };
    acc[cancer].attempts += stat.attempts || 0;
    acc[cancer].correct += stat.correct || 0;
    acc[cancer].wrong += stat.wrong || 0;
    return acc;
  }, {});

  return Object.values(rows).map((row) => ({
    ...row,
    total: row.attempts,
    attemptedQuestions: row.attempts,
    coverage: 0,
    accuracy: row.attempts ? Math.round((row.correct / row.attempts) * 100) : 0,
    wrongRate: row.attempts ? Math.round((row.wrong / row.attempts) * 100) : 0,
    status: row.wrong > 0 ? 'Red' : 'Green',
  }));
}

function getStatsDashboard(state, planSummary, readiness, cancerSummary, date = TODAY) {
  const stats = Object.values(state.stats || {}).map((stat) => ({ ...emptyStat(), ...stat }));
  const attempts = stats.reduce((sum, stat) => sum + (stat.attempts || 0), 0);
  const correct = stats.reduce((sum, stat) => sum + (stat.correct || 0), 0);
  const wrong = stats.reduce((sum, stat) => sum + (stat.wrong || 0), 0);
  const reviewed = Object.keys(state.stats || {}).filter((id) => (state.stats?.[id]?.attempts || 0) > 0).length;
  const answerEventsByDate = getAnswerEventsByDate(state);
  const activeDates = new Set([
    ...Object.keys(answerEventsByDate),
    ...Object.keys(state.sessions || {}).filter((key) => state.sessions?.[key]?.questionIds?.length),
    ...Object.keys(getFocusMinutesByDate(state)),
    ...Object.values(state.flashcardStats || {}).map((stat) => stat.lastReviewedAt).filter(Boolean),
  ]);
  const todayAttempts = getTodayAttemptSummary(state, date);
  const todaySession = state.sessions?.[date] || {};
  const todayQuestionCount = (todaySession.questionIds || []).length;
  const todayRatedCount = (todaySession.questionIds || []).filter((id) => hasDailyPracticeRating(state, id, date)).length;
  const todayFlashcards = getTodayFlashcardReviewCount(state, date);
  const todayReviewQuestions = getTodayReviewQuestionCount(state, date);
  const todayWrongNotes = getTodayWrongNoteCount(state, date);
  const todayFocusMinutes = sumFocusMinutesByDate(state, date);
  const totalFocusMinutes = normalizeFocusSessions(state.focusSessions).reduce((sum, session) => sum + (session.durationMinutes || 0), 0);
  const focusStreak = getFocusStreak(state, date);
  const recentDates = getRecentDateKeys(date, 7);
  const focusMinutesByDate = getFocusMinutesByDate(state);
  const weeklyFocusTrend = recentDates.map((key) => ({
    date: key,
    label: key.slice(5).replace('-', '/'),
    minutes: focusMinutesByDate[key] || 0,
  }));
  const weeklyFocusMinutes = weeklyFocusTrend.reduce((sum, row) => sum + row.minutes, 0);
  const maxWeeklyFocusMinutes = Math.max(0, ...weeklyFocusTrend.map((row) => row.minutes));
  const flashcardsByDate = Object.values(state.flashcardStats || {}).reduce((acc, stat) => {
    if (!stat.lastReviewedAt) return acc;
    acc[stat.lastReviewedAt] = (acc[stat.lastReviewedAt] || 0) + 1;
    return acc;
  }, {});
  const recentActivity = recentDates.map((key) => {
    const row = answerEventsByDate[key] || { attempts: 0, correct: 0, wrong: 0 };
    return {
      date: key,
      attempts: row.attempts,
      correct: row.correct,
      wrong: row.wrong,
      accuracy: row.attempts ? Math.round((row.correct / row.attempts) * 100) : 0,
      flashcards: flashcardsByDate[key] || 0,
    };
  });
  const maxRecentAttempts = Math.max(1, ...recentActivity.map((row) => row.attempts + row.flashcards));
  const flashcardList = getFlashcardList(state);
  const masteredCards = flashcardList.filter((card) => (state.flashcardStats?.[card.id]?.mastery ?? card.mastery ?? 0) >= 4).length;
  const dueCards = getDueFlashcards(state).length;
  const criticalErrors = readiness.criticalErrors || [];
  const weakCancerRows = (cancerSummary.length ? cancerSummary : getWeakCancerRowsFromStoredStats(state))
    .filter((row) => row.attempts > 0)
    .sort((a, b) => b.wrongRate - a.wrongRate || b.wrong - a.wrong)
    .slice(0, 5);
  const recentQuestStars = Object.entries(state.dailyQuestProgress || {})
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 7)
    .reduce((sum, entry) => sum + (entry[1]?.stars || 0), 0);

  return {
    attempts,
    correct,
    wrong,
    reviewed,
    accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
    averageDailyQuestions: activeDates.size ? Math.round((attempts / activeDates.size) * 10) / 10 : 0,
    activeDays: activeDates.size,
    todayAttempts,
    todayAccuracy: todayAttempts.attempts ? Math.round((todayAttempts.correct / todayAttempts.attempts) * 100) : 0,
    todayQuestionCount,
    todayRatedCount,
    todayFlashcards,
    todayReviewQuestions,
    todayWrongNotes,
    todayFocusMinutes,
    totalFocusMinutes,
    focusStreak,
    weeklyFocusTrend,
    weeklyFocusMinutes,
    weeklyAverageFocusMinutes: Math.round(weeklyFocusMinutes / 7),
    maxWeeklyFocusMinutes,
    recentActivity,
    maxRecentAttempts,
    weakCancerRows,
    criticalErrorCount: criticalErrors.length,
    planPercent: planSummary.percent,
    planCompleted: planSummary.completed,
    planTotal: planSummary.total,
    goldenPercent: planSummary.goldenPercent,
    goldenCompleted: planSummary.goldenCompleted,
    goldenTotal: planSummary.goldenTotal,
    flashcardTotal: flashcardList.length,
    masteredCards,
    dueCards,
    recentQuestStars,
  };
}


function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function weightedRecentMockAccuracy(mockExams = []) {
  const completed = [...mockExams]
    .filter((exam) => exam?.completedAt && Number.isFinite(exam.score))
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .slice(0, 3);
  if (!completed.length) return 0;
  const weights = [0.5, 0.3, 0.2];
  const totalWeight = completed.reduce((sum, _exam, index) => sum + weights[index], 0);
  return clampPercent(completed.reduce((sum, exam, index) => sum + exam.score * weights[index], 0) / totalWeight);
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

function getCoreTopicNames() {
  return new Set(studyPlan100.filter((task) => task.priority === 'High').map((task) => `${task.cancer}::${task.topic}`));
}

function getTopicMasteryRows(state) {
  const topicMap = new Map();
  getQuestionPool(state)
    .map((q) => getQuestionWithOverride(q.id, state))
    .filter(Boolean)
    .forEach((q) => {
      const key = `${q.cancer}::${q.topic || 'General'}`;
      const stat = getStat(state, q.id);
      const row = topicMap.get(key) || { key, cancer: q.cancer, topic: q.topic || 'General', total: 0, attempted: 0, attempts: 0, correct: 0, masterySum: 0, highConfidenceWrong: 0 };
      row.total += 1;
      row.attempts += stat.attempts || 0;
      row.correct += stat.correct || 0;
      row.masterySum += stat.mastery || 0;
      row.highConfidenceWrong += stat.highConfidenceWrong || 0;
      if ((stat.attempts || 0) > 0) row.attempted += 1;
      topicMap.set(key, row);
    });

  const coreNames = getCoreTopicNames();
  return [...topicMap.values()].map((row) => {
    const coverage = row.total ? Math.round((row.attempted / row.total) * 100) : 0;
    const accuracy = row.attempts ? Math.round((row.correct / row.attempts) * 100) : 0;
    const avgMastery = row.total ? Math.round((row.masterySum / row.total) * 10) / 10 : 0;
    const isCore = coreNames.has(row.key) || row.total >= 3;
    const status = coverage >= 80 && accuracy >= 80 && avgMastery >= 4 ? 'Green' : (coverage < 60 || accuracy < 70 || row.highConfidenceWrong > 0 ? 'Red' : 'Yellow');
    return { ...row, coverage, accuracy, avgMastery, isCore, status };
  }).sort((a, b) => (a.status === 'Red' ? -1 : 1) - (b.status === 'Red' ? -1 : 1) || a.accuracy - b.accuracy || b.highConfidenceWrong - a.highConfidenceWrong);
}

function summarizeTaxonomyGroups(state, groupName, getLabels) {
  const groupMap = new Map();
  getQuestionPool(state)
    .map((q) => getQuestionWithOverride(q.id, state))
    .filter(Boolean)
    .forEach((q) => {
      const labels = getLabels(q).filter(Boolean);
      labels.forEach((label) => {
        const key = `${groupName}::${label}`;
        const stat = getStat(state, q.id);
        const row = groupMap.get(key) || {
          key,
          groupName,
          label,
          total: 0,
          attempted: 0,
          attempts: 0,
          correct: 0,
          wrong: 0,
          highConfidenceWrong: 0,
        };
        row.total += 1;
        row.attempts += stat.attempts || 0;
        row.correct += stat.correct || 0;
        row.wrong += stat.wrong || 0;
        row.highConfidenceWrong += stat.highConfidenceWrong || 0;
        if ((stat.attempts || 0) > 0) row.attempted += 1;
        groupMap.set(key, row);
      });
    });

  return [...groupMap.values()].map((row) => {
    const coverage = row.total ? Math.round((row.attempted / row.total) * 100) : 0;
    const accuracy = row.attempts ? Math.round((row.correct / row.attempts) * 100) : 0;
    const wrongRateValue = row.attempts ? Math.round((row.wrong / row.attempts) * 100) : 0;
    const status = coverage >= 80 && accuracy >= 80 ? 'Green' : (coverage < 60 || accuracy < 70 || row.highConfidenceWrong > 0 ? 'Red' : 'Yellow');
    return { ...row, coverage, accuracy, wrongRate: wrongRateValue, status };
  }).sort((a, b) => (a.status === 'Red' ? -1 : 1) - (b.status === 'Red' ? -1 : 1) || b.wrongRate - a.wrongRate || b.attempts - a.attempts);
}

function getTaxonomyAnalytics(state) {
  return {
    clinicalSetting: summarizeTaxonomyGroups(state, 'Clinical setting', (q) => [q.tags?.clinicalSetting || q.topic || 'General']),
    evidenceType: summarizeTaxonomyGroups(state, 'Evidence type', (q) => [q.tags?.evidenceType || 'Guideline principle']),
    biomarker: summarizeTaxonomyGroups(state, 'Biomarker', (q) => q.tags?.biomarker?.length ? q.tags.biomarker : ['No biomarker']),
    treatmentModality: summarizeTaxonomyGroups(state, 'Treatment modality', (q) => [q.tags?.treatmentModality || 'Unspecified modality']),
  };
}

function getCriticalErrorItems(state) {
  return getQuestionPool(state)
    .map((q) => ({ q: getQuestionWithOverride(q.id, state), stat: getStat(state, q.id) }))
    .filter(({ q, stat }) => q && ((stat.highConfidenceWrong || 0) > 0 || (stat.repeatedWrong || 0) >= 2 || (stat.wrong || 0) >= 2))
    .sort((a, b) => (b.stat.highConfidenceWrong || 0) - (a.stat.highConfidenceWrong || 0) || (b.stat.repeatedWrong || 0) - (a.stat.repeatedWrong || 0) || wrongRate(b.stat) - wrongRate(a.stat));
}

function getReadinessMetrics(state) {
  const mockExams = state.mockExams || [];
  const recentCompleted = [...mockExams]
    .filter((exam) => exam?.completedAt && Number.isFinite(exam.score))
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  const recentMockScores = recentCompleted.slice(0, 5).map((exam) => exam.score);
  const recentMockAverage = recentMockScores.length ? clampPercent(recentMockScores.slice(0, 3).reduce((sum, score) => sum + score, 0) / Math.min(3, recentMockScores.length)) : 0;
  const recentMixedMockAccuracy = weightedRecentMockAccuracy(mockExams);

  const cancerRows = getCancerSummary(state);
  const coveredCancers = cancerRows.filter((row) => row.total > 0 && row.coverage >= 80 && row.accuracy >= 80).length;
  const cancerCoverageScore = cancerRows.length ? clampPercent((coveredCancers / cancerRows.length) * 100) : 0;

  const stats = Object.values(state.stats || {}).map((stat) => ({ ...emptyStat(), ...stat }));
  const wrongRetestAttempts = stats.reduce((sum, stat) => sum + (stat.wrongRetestAttempts || 0), 0);
  const wrongRetestCorrect = stats.reduce((sum, stat) => sum + (stat.wrongRetestCorrect || 0), 0);
  const wrongRetestConversion = wrongRetestAttempts ? clampPercent((wrongRetestCorrect / wrongRetestAttempts) * 100) : 0;
  const highConfidenceWrong = stats.reduce((sum, stat) => sum + (stat.highConfidenceWrong || 0), 0);
  const confidenceAttempts = stats.reduce((sum, stat) => sum + (stat.confidenceHistory || []).filter(Boolean).length, 0);
  const highConfidenceWrongRate = confidenceAttempts ? clampPercent((highConfidenceWrong / confidenceAttempts) * 100) : 0;
  const confidenceCalibrationScore = clampPercent(100 - highConfidenceWrongRate);

  const topicRows = getTopicMasteryRows(state);
  const coreTopics = topicRows.filter((row) => row.isCore);
  const masteredCoreTopics = coreTopics.filter((row) => row.avgMastery >= 4 && row.coverage >= 70 && row.accuracy >= 75).length;
  const topicMasteryScore = coreTopics.length ? clampPercent((masteredCoreTopics / coreTopics.length) * 100) : 0;
  const redTopics = topicRows.filter((row) => row.status === 'Red');

  const readinessScore = clampPercent(
    0.35 * recentMixedMockAccuracy +
    0.20 * cancerCoverageScore +
    0.20 * wrongRetestConversion +
    0.15 * confidenceCalibrationScore +
    0.10 * topicMasteryScore
  );

  const scoreVolatility = standardDeviation(recentMockScores);
  const minRecentMock = recentMockScores.length ? Math.min(...recentMockScores.slice(0, 3)) : 0;
  let readinessLevel = 'Not ready';
  let probability80 = clampPercent((readinessScore - 55) * 2);
  if (readinessScore >= 82 && recentMockAverage >= 80 && highConfidenceWrongRate < 5) {
    readinessLevel = 'High probability ≥80';
    probability80 = clampPercent(78 + (readinessScore - 82) * 1.7 - scoreVolatility);
  } else if (readinessScore >= 76 || recentMockAverage >= 78) {
    readinessLevel = 'Borderline';
    probability80 = clampPercent(45 + (readinessScore - 76) * 3 + (recentMockAverage - 78) * 2 - scoreVolatility);
  }

  const gates = [
    { label: 'Mixed mock ≥80%', pass: recentMockAverage >= 80, value: `${recentMockAverage || 0}%` },
    { label: 'Wrong retest ≥90%', pass: wrongRetestConversion >= 90, value: `${wrongRetestConversion}%` },
    { label: 'High-confidence wrong <5%', pass: highConfidenceWrongRate < 5 && confidenceAttempts > 0, value: `${highConfidenceWrongRate}%` },
    { label: 'Cancer coverage ≥80%', pass: cancerCoverageScore >= 80, value: `${cancerCoverageScore}%` },
    { label: 'Red topics ≤3', pass: redTopics.length <= 3, value: `${redTopics.length}` },
  ];

  return {
    recentMockScores,
    recentMockAverage,
    recentMixedMockAccuracy,
    minRecentMock,
    scoreVolatility,
    cancerCoverageScore,
    wrongRetestConversion,
    highConfidenceWrongRate,
    confidenceCalibrationScore,
    topicMasteryScore,
    readinessScore,
    predictedScore: readinessScore,
    probability80,
    readinessLevel,
    safeExamZone: gates.every((gate) => gate.pass),
    gates,
    cancerRows,
    topicRows,
    redTopics,
    criticalErrors: getCriticalErrorItems(state),
  };
}

function getQuickReadinessMetrics(state) {
  const mockExams = state.mockExams || [];
  const recentCompleted = [...mockExams]
    .filter((exam) => exam?.completedAt && Number.isFinite(exam.score))
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  const recentMockScores = recentCompleted.slice(0, 5).map((exam) => exam.score);
  const recentMockAverage = recentMockScores.length ? clampPercent(recentMockScores.slice(0, 3).reduce((sum, score) => sum + score, 0) / Math.min(3, recentMockScores.length)) : 0;
  const recentMixedMockAccuracy = weightedRecentMockAccuracy(mockExams);
  const stats = Object.values(state.stats || {});
  const wrongRetestAttempts = stats.reduce((sum, stat) => sum + (stat.wrongRetestAttempts || 0), 0);
  const wrongRetestCorrect = stats.reduce((sum, stat) => sum + (stat.wrongRetestCorrect || 0), 0);
  const wrongRetestConversion = wrongRetestAttempts ? clampPercent((wrongRetestCorrect / wrongRetestAttempts) * 100) : 0;
  const highConfidenceWrong = stats.reduce((sum, stat) => sum + (stat.highConfidenceWrong || 0), 0);
  const confidenceAttempts = stats.reduce((sum, stat) => sum + (stat.confidenceHistory || []).filter(Boolean).length, 0);
  const highConfidenceWrongRate = confidenceAttempts ? clampPercent((highConfidenceWrong / confidenceAttempts) * 100) : 0;
  const confidenceCalibrationScore = clampPercent(100 - highConfidenceWrongRate);
  const attemptedQuestions = stats.filter((stat) => (stat.attempts || 0) > 0).length;
  const coverageScore = clampPercent((attemptedQuestions / Math.max(1, QUESTION_BANK_TOTAL)) * 100);
  const readinessScore = clampPercent(
    0.45 * recentMixedMockAccuracy +
    0.25 * wrongRetestConversion +
    0.20 * confidenceCalibrationScore +
    0.10 * coverageScore
  );
  const scoreVolatility = standardDeviation(recentMockScores);
  const probability80 = recentMockAverage >= 80
    ? clampPercent(65 + (recentMockAverage - 80) * 2 - scoreVolatility)
    : clampPercent((readinessScore - 55) * 2);
  const readinessLevel = probability80 >= 75 ? 'High probability >=80' : probability80 >= 45 ? 'Borderline' : 'Not ready';

  return {
    recentMockScores,
    recentMockAverage,
    recentMixedMockAccuracy,
    minRecentMock: recentMockScores.length ? Math.min(...recentMockScores.slice(0, 3)) : 0,
    scoreVolatility,
    cancerCoverageScore: coverageScore,
    wrongRetestConversion,
    highConfidenceWrongRate,
    confidenceCalibrationScore,
    topicMasteryScore: 0,
    readinessScore,
    predictedScore: readinessScore,
    probability80,
    readinessLevel,
    safeExamZone: probability80 >= 75,
    gates: EMPTY_ARRAY,
    cancerRows: EMPTY_ARRAY,
    topicRows: EMPTY_ARRAY,
    redTopics: EMPTY_ARRAY,
    criticalErrors: EMPTY_ARRAY,
  };
}

function MetricCard({ label, value, sub }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

function formatNewsDate(value) {
  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export function NewsPanel({
  libraryState,
  notePreview,
  planTasks,
  defaultTaskId,
  questions,
  flashcards,
  onOpenQuestion,
  onImportLearningDrafts,
  onSyncLibrary,
  onOpenNotePreview,
  onCloseNotePreview,
}) {
  const [selectedTaskId, setSelectedTaskId] = useState(defaultTaskId || 1);
  const selectedTask = getStudyPlanTaskById(selectedTaskId) || planTasks[0];
  const criteria = useMemo(() => getNotionNewsCriteriaForTask(selectedTask), [selectedTask]);
  const rankedItems = useMemo(
    () => rankNotionNewsItems(libraryState.items, criteria),
    [criteria, libraryState.items],
  );
  const matchedItems = rankedItems.filter(hasCriteriaMatches);
  const sortedItems = matchedItems.length ? matchedItems : rankedItems;
  const latestDate = sortedItems[0]?.lastEditedTime || sortedItems[0]?.createdTime;
  const sourceLabel = libraryState.source === 'live' && libraryState.status !== 'error'
    ? 'live'
    : libraryState.source === 'snapshot' ? 'snapshot' : 'cached';
  const topicCounts = sortedItems.reduce((acc, item) => {
    (item.cancerTypes || []).forEach((label) => {
      acc[label] = (acc[label] || 0) + 1;
    });
    return acc;
  }, {});
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5);
  const criteriaGroups = [
    ['Cancer type', criteria.cancerTypes],
    ['tag', criteria.tags],
    ['治療', criteria.treatments],
    ['drug', criteria.drugs],
  ].filter(([, values]) => values.length > 0);
  const leadItem = sortedItems[0];
  const cardItems = sortedItems.slice(1, 5);
  const briefItemsBase = sortedItems.slice(5, 11);
  const briefItems = briefItemsBase.length > 0 ? [...briefItemsBase, ...briefItemsBase] : [];
  const tickerItems = sortedItems.slice(0, 6);

  useEffect(() => {
    if (defaultTaskId) setSelectedTaskId(defaultTaskId);
  }, [defaultTaskId]);

  return (
    <main className="panel news-panel">
      <div className="news-masthead">
        <div className="news-kicker">
          <span>腫專考古每日整理速報</span>
          <span>{sortedItems.length} matched notes · {sourceLabel} · {latestDate ? formatNewsDate(latestDate) : '-'}</span>
        </div>
        <h2>Oncology Review Times</h2>
        <p>每天從 Fellow training 抓 Notion 筆記，依 Day task 屬性集合排序成新聞首頁。</p>
      </div>

      <section className="news-controls" aria-label="NEWS day selector">
        <label>
          <span>Day</span>
          <select value={selectedTask ? getPlanTaskStorageId(selectedTask) : ''} onChange={(event) => setSelectedTaskId(event.target.value)}>
            {planTasks.map((task) => (
              <option key={getPlanTaskStorageId(task)} value={getPlanTaskStorageId(task)}>{task.day} · {task.topic}</option>
            ))}
          </select>
        </label>
        <div className="news-selected-task">
          <strong>{selectedTask?.day} · {selectedTask?.topic}</strong>
          <span>{selectedTask?.details}</span>
          <div className="news-library-actions">
            <small>Shared Library · {libraryState.items.length} notes · synced {formatLibrarySyncTime(libraryState.fetchedAt)}</small>
            <button type="button" className="secondary tiny" disabled={libraryState.status === 'loading'} onClick={onSyncLibrary}>
              <RefreshCw size={14} className={libraryState.status === 'loading' ? 'spin' : ''} />
              {libraryState.status === 'loading' ? 'Syncing…' : 'Sync Library'}
            </button>
          </div>
        </div>
      </section>

      {tickerItems.length > 0 && (
        <section className="news-ticker" aria-label="今日重點跑馬燈">
          <div className="news-ticker-label">Breaking</div>
          <div className="news-ticker-window">
            <div className="news-ticker-track">
              {[...tickerItems, ...tickerItems].map((item, index) => (
                <a className="news-ticker-item" href={item.url} target="_blank" rel="noreferrer" key={`${item.id}-ticker-${index}`}>
                  {item.title}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="news-criteria-strip" aria-label="Notion NEWS query criteria">
        {criteriaGroups.map(([label, values]) => (
          <div className="news-criteria-group" key={label}>
            <span>{label}</span>
            {values.map((value) => <em key={`${label}-${value}`}>{value}</em>)}
          </div>
        ))}
      </section>

      {(sourceLabel !== 'live' || libraryState.status === 'loading' || libraryState.error) && (
        <div className="news-status-line">
          {libraryState.status === 'loading'
            ? '正在更新共用 Notion Library；完成前先顯示目前索引。'
            : libraryState.error || `目前顯示 ${sourceLabel} Library；登入 Cloud Sync 後可取得最新索引。`}
        </div>
      )}

      <section className="news-topic-strip" aria-label="Top NEWS topics">
        {topTopics.map(([topic, count]) => (
          <span className="news-topic-chip" key={topic}>
            {topic}
            <strong>{count}</strong>
          </span>
        ))}
      </section>

      <section className="news-front-page" aria-label="NEWS front page">
        <div className="news-front-main">
          {leadItem && (
            <article className="news-lead-story">
              <div className="news-meta-line">
                <span>{leadItem.source}</span>
                {[...(leadItem.cancerTypes || []), ...(leadItem.tags || []), ...(leadItem.treatments || [])].slice(0, 5).map((label) => (
                  <em key={`${leadItem.id}-lead-${label}`}>{label}</em>
                ))}
              </div>
              <h3>{leadItem.title}</h3>
              <p>{selectedTask?.details}</p>
              {leadItem.match && (
                <div className="news-match-line">
                  <span>matched</span>
                  {[...(leadItem.match.cancerTypes || []), ...(leadItem.match.tags || []), ...(leadItem.match.treatments || []), ...(leadItem.match.drugs || [])].map((label) => (
                    <em key={`${leadItem.id}-lead-match-${label}`}>{label}</em>
                  ))}
                </div>
              )}
              <div className="news-story-actions">
                {getNotionPageId(leadItem) && (
                  <button type="button" className="primary" onClick={() => onOpenNotePreview(leadItem)}>Preview & create</button>
                )}
                <a className="news-read-link" href={leadItem.url} target="_blank" rel="noreferrer">開啟 Notion 筆記</a>
              </div>
            </article>
          )}

          <div className="news-section-title">Today's Cards</div>
          <section className="news-card-grid" aria-label="今日整理卡片">
            {cardItems.map((item) => {
              const meta = [...(item.cancerTypes || []), ...(item.tags || []), ...(item.treatments || [])].slice(0, 4);
              const keyTerms = [...(item.genes || []), ...(item.drugs || [])].slice(0, 4);
              return (
                <article className="news-card" key={item.id}>
                  <div className="news-meta-line">
                    {meta.map((label) => <em key={`${item.id}-card-${label}`}>{label}</em>)}
                  </div>
                  <h3>{item.title}</h3>
                  {keyTerms.length > 0 && <p>{keyTerms.join(' / ')}</p>}
                  <div className="news-card-actions">
                    {getNotionPageId(item) && (
                      <button type="button" onClick={() => onOpenNotePreview(item)}>Preview & create</button>
                    )}
                    <a href={item.url} target="_blank" rel="noreferrer">Notion <ExternalLink size={13} /></a>
                  </div>
                </article>
              );
            })}
          </section>
        </div>

        {briefItems.length > 0 && (
          <aside className="news-rail" aria-label="自動滾動速報">
            <div className="news-rail-stack">
              {briefItems.map((item, index) => (
                <button className="news-brief news-brief-link" type="button" onClick={() => onOpenNotePreview(item)} key={`${item.id}-brief-${index}`}>
                  <div className="news-brief-date">{formatNewsDate(item.lastEditedTime || item.createdTime)}</div>
                  <h3>{item.title}</h3>
                  <p>{[...(item.cancerTypes || []), ...(item.tags || []), ...(item.treatments || []), ...(item.drugs || [])].slice(0, 5).join(' / ')}</p>
                  <small>Preview & create →</small>
                </button>
              ))}
            </div>
          </aside>
        )}
      </section>
      <NotionPreviewPanel
        preview={notePreview}
        questions={questions}
        flashcards={flashcards}
        onOpenQuestion={onOpenQuestion}
        onImportLearningDrafts={onImportLearningDrafts}
        onClose={onCloseNotePreview}
      />
    </main>
  );
}

function WeeklyFocusChart({ rows, maxMinutes }) {
  const chartWidth = 420;
  const chartHeight = 180;
  const plotTop = 18;
  const plotBottom = 134;
  const plotHeight = plotBottom - plotTop;
  const safeMax = Math.max(1, maxMinutes || 0);
  const step = rows.length > 1 ? chartWidth / (rows.length - 1) : chartWidth;
  const points = rows.map((row, index) => {
    const x = rows.length > 1 ? index * step : chartWidth / 2;
    const y = plotBottom - ((row.minutes / safeMax) * plotHeight);
    return { ...row, x, y };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <div className="weekly-focus-chart">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="最近 7 日讀書時長折線圖">
        <line className="weekly-focus-grid" x1="0" y1={plotTop} x2={chartWidth} y2={plotTop} />
        <line className="weekly-focus-grid" x1="0" y1={(plotTop + plotBottom) / 2} x2={chartWidth} y2={(plotTop + plotBottom) / 2} />
        <line className="weekly-focus-axis" x1="0" y1={plotBottom} x2={chartWidth} y2={plotBottom} />
        {points.map((point) => {
          const barHeight = Math.max(4, (point.minutes / safeMax) * plotHeight);
          return (
            <g key={point.date}>
              <rect
                className="weekly-focus-bar"
                x={point.x - 13}
                y={plotBottom - barHeight}
                width="26"
                height={barHeight}
                rx="7"
              />
              <text className="weekly-focus-value" x={point.x} y={Math.max(12, point.y - 8)}>{point.minutes}</text>
              <text className="weekly-focus-label" x={point.x} y="166">{point.label}</text>
            </g>
          );
        })}
        <polyline className="weekly-focus-line" points={linePoints} />
        {points.map((point) => (
          <circle className="weekly-focus-dot" cx={point.x} cy={point.y} r="4.5" key={`${point.date}-dot`} />
        ))}
      </svg>
    </div>
  );
}

function StatsDashboard({ stats }) {
  const todayRows = [
    ['今日作答', stats.todayAttempts.attempts, `${stats.todayAttempts.correct} correct / ${stats.todayAttempts.wrong} wrong`],
    ['今日正確率', `${stats.todayAccuracy}%`, stats.todayAttempts.attempts ? 'based on today attempts' : '尚未作答'],
    ['Daily Practice', `${stats.todayRatedCount}/${stats.todayQuestionCount || 0}`, 'rated / loaded questions'],
    ['Review Queue', stats.todayReviewQuestions, 'review-mode questions'],
    ['Flashcards', stats.todayFlashcards, 'cards reviewed today'],
    ['錯題筆記', stats.todayWrongNotes, 'notes added today'],
    ['專注時長', `${stats.todayFocusMinutes} 分`, `${stats.focusStreak} day focus streak`],
  ];

  return (
    <main className="panel stats-dashboard">
      <div className="section-head">
        <div>
          <h2>Stats Dashboard</h2>
          <p className="muted">把累計作答、今日進度、弱點、100-Day Plan 和 flashcards 統一看。</p>
        </div>
        <span className="pill soft">{TODAY}</span>
      </div>

      <section className="stats-hero-grid">
        <MetricCard label="累計 attempts" value={stats.attempts} sub={`${stats.reviewed} questions reviewed`} />
        <MetricCard label="Correct / Wrong" value={`${stats.correct}/${stats.wrong}`} sub={`${stats.accuracy}% accuracy`} />
        <MetricCard label="平均每日題數" value={stats.averageDailyQuestions} sub={`${stats.activeDays} active days`} />
        <MetricCard label="專注總時長" value={`${Math.round(stats.totalFocusMinutes / 60)}h`} sub={`今日 ${stats.todayFocusMinutes} 分 · streak ${stats.focusStreak}`} />
      </section>

      <section className="stats-layout">
        <article className="stats-panel focus-trend-panel">
          <div className="stats-panel-head">
            <strong>最近 7 日讀書時長</strong>
            <span>{stats.weeklyFocusMinutes} 分 / 週</span>
          </div>
          <WeeklyFocusChart rows={stats.weeklyFocusTrend} maxMinutes={stats.maxWeeklyFocusMinutes} />
          <div className="focus-trend-summary">
            <div>
              <span>週總時長</span>
              <strong>{stats.weeklyFocusMinutes} 分</strong>
            </div>
            <div>
              <span>日均</span>
              <strong>{stats.weeklyAverageFocusMinutes} 分</strong>
            </div>
            <div>
              <span>最高單日</span>
              <strong>{stats.maxWeeklyFocusMinutes} 分</strong>
            </div>
          </div>
        </article>

        <article className="stats-panel">
          <div className="stats-panel-head">
            <strong>最近 7 日趨勢</strong>
            <span>questions + cards</span>
          </div>
          <div className="trend-list">
            {stats.recentActivity.map((row) => {
              const total = row.attempts + row.flashcards;
              return (
                <div className="trend-row" key={row.date}>
                  <span>{row.date.slice(5)}</span>
                  <div className="trend-track" aria-label={`${row.date} total activity ${total}`}>
                    <i style={{ width: `${Math.max(4, (total / stats.maxRecentAttempts) * 100)}%` }} />
                  </div>
                  <strong>{total}</strong>
                  <em>{row.attempts ? `${row.accuracy}%` : '--'}</em>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="stats-layout single">
        <article className="stats-panel">
          <div className="stats-panel-head">
            <strong>今日統計</strong>
            <span>{stats.todayAttempts.attempts ? `${stats.todayAccuracy}%` : 'not started'}</span>
          </div>
          <div className="today-stats-grid">
            {todayRows.map(([label, value, sub]) => (
              <div className="today-stat" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <em>{sub}</em>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="stats-layout three">
        <article className="stats-panel">
          <div className="stats-panel-head">
            <strong>弱點癌別</strong>
            <span>wrong-rate rank</span>
          </div>
          {!stats.weakCancerRows.length ? <p className="muted">有作答紀錄後會自動排序弱點。</p> : (
            <div className="rank-list">
              {stats.weakCancerRows.map((row) => (
                <div className="rank-row" key={row.cancer}>
                  <div>
                    <strong>{row.cancer}</strong>
                    <span>{row.wrong} wrong / {row.attempts} attempts</span>
                  </div>
                  <em>{row.wrongRate}%</em>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="stats-panel">
          <div className="stats-panel-head">
            <strong>100-Day Plan</strong>
            <span>{stats.planCompleted}/{stats.planTotal}</span>
          </div>
          <div className="stats-progress-block">
            <div className="plan-cancer-head">
              <span>總進度</span>
              <strong>{stats.planPercent}%</strong>
            </div>
            <div className="progress-bar large"><span style={{ width: `${stats.planPercent}%` }} /></div>
            <div className="plan-cancer-head">
              <span>Golden trial</span>
              <strong>{stats.goldenCompleted}/{stats.goldenTotal}</strong>
            </div>
            <div className="progress-bar"><span style={{ width: `${stats.goldenPercent}%` }} /></div>
          </div>
        </article>

        <article className="stats-panel">
          <div className="stats-panel-head">
            <strong>Flashcards</strong>
            <span>{stats.dueCards} due</span>
          </div>
          <div className="stats-progress-block">
            <div className="plan-cancer-head">
              <span>Mastered cards</span>
              <strong>{stats.masteredCards}/{stats.flashcardTotal}</strong>
            </div>
            <div className="progress-bar large">
              <span style={{ width: `${stats.flashcardTotal ? Math.round((stats.masteredCards / stats.flashcardTotal) * 100) : 0}%` }} />
            </div>
            <div className="quest-star-summary">
              <span>Recent Quest stars</span>
              <strong>{stats.recentQuestStars}</strong>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}

function RewardDashboard({ state, dailyChest, bossRows, checkedInToday, checkInStreak, onCheckIn, onClaimDailyChest }) {
  const xp = state.game?.xp || 0;
  const levelProgress = getLevelProgress(xp);
  const recentEvents = state.game?.xpEvents || [];
  return (
    <section className="reward-dashboard">
      <div className="reward-head">
        <div>
          <div className="eyebrow">Game Dashboard</div>
          <h3>Daily Chest</h3>
          <p className="muted">每天用小任務推進寶箱；滿 100 可開一次。</p>
        </div>
        <div className="reward-level">
          <strong>Lv {levelProgress.level}</strong>
          <span>{xp} XP</span>
        </div>
      </div>

      <div className="reward-grid">
        <article className="reward-card primary-reward">
          <div className="reward-card-head">
            <strong>今日寶箱</strong>
            <span>{dailyChest.progress}/100</span>
          </div>
          <div className={checkedInToday ? 'daily-checkin-mini done' : 'daily-checkin-mini'}>
            <span>每日打卡 · 連續 {checkInStreak} 天</span>
            <button className={checkedInToday ? 'tiny good' : 'tiny'} type="button" disabled={checkedInToday} onClick={onCheckIn}>
              {checkedInToday ? '已打卡' : '打卡'}
            </button>
          </div>
          <div className="progress-bar large"><span style={{ width: `${dailyChest.progress}%` }} /></div>
          <div className="daily-chest-tasks">
            {dailyChest.rows.map((row) => (
              <div className={row.value >= row.max ? 'chest-task done' : 'chest-task'} key={row.key}>
                <span>{row.value >= row.max ? '✓' : '○'}</span>
                <strong>{row.label}</strong>
                <em>{row.value}/{row.max} · +{row.points}/{row.totalPoints}</em>
              </div>
            ))}
          </div>
          <button className="primary" disabled={dailyChest.progress < 100 || dailyChest.claimed} onClick={onClaimDailyChest}>
            {dailyChest.claimed ? '今日寶箱已開' : dailyChest.progress >= 100 ? '開啟今日寶箱' : '寶箱尚未滿'}
          </button>
        </article>

        <article className="reward-card">
          <div className="reward-card-head">
            <strong>Level XP</strong>
            <span>{levelProgress.current}/{levelProgress.needed}</span>
          </div>
          <div className="progress-bar"><span style={{ width: `${levelProgress.percent}%` }} /></div>
          <p className="muted">下一級需要累積到 {levelProgress.nextLevelXp} XP。</p>
          <div className="reward-stat-row">
            <span>Streak</span>
            <strong>{state.game?.streak || 0} days</strong>
          </div>
          <div className="reward-stat-row">
            <span>Trial Gems</span>
            <strong>{state.game?.trialGems || 0}</strong>
          </div>
        </article>

        <article className="reward-card">
          <div className="reward-card-head">
            <strong>Boss Progress</strong>
            <span>{bossRows.filter((boss) => boss.unlocked).length}/{bossRows.length}</span>
          </div>
          <div className="boss-progress-list">
            {bossRows.slice(0, 5).map((boss) => (
              <div className="boss-progress-row" key={boss.id}>
                <span>{boss.name}</span>
                <strong>{boss.defeated ? 'Chest opened' : `${boss.unlockValue}%`}</strong>
                <div className="progress-bar"><span style={{ width: `${boss.defeated ? 100 : Math.min(100, boss.unlockValue) }%` }} /></div>
              </div>
            ))}
          </div>
        </article>

        <article className="reward-card">
          <div className="reward-card-head">
            <strong>XP Event Log</strong>
            <span>recent 10</span>
          </div>
          {!recentEvents.length ? <p className="muted">還沒有 XP event。</p> : (
            <div className="xp-event-list">
              {recentEvents.slice(0, 10).map((event) => (
                <div className="xp-event" key={event.id}>
                  <strong>+{event.amount}</strong>
                  <span>{event.reason}</span>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function PracticeModeSelector({ value, onChange, compact = false }) {
  return (
    <div className={compact ? 'practice-mode compact' : 'practice-mode'}>
      <span>今日練習模式</span>
      <div className="practice-mode-options" role="group" aria-label="今日練習模式">
        {Object.entries(PRACTICE_MODES).map(([key, mode]) => (
          <button
            key={key}
            type="button"
            className={value === key ? 'active' : ''}
            onClick={() => onChange(key)}
          >
            {mode.shortLabel}
          </button>
        ))}
      </div>
    </div>
  );
}


function QuestionCard({ question, stat, onUpdateStat, compact = false, hideAnswerUntilSubmit = false, practiceMode = false, practiceDraft = null, onPracticeChange = null, batchSubmitted = false, batchFinalized = false, onEdit }) {
  const initialAnswer = stat.correctAnswer || question.answer || '';
  const [selected, setSelected] = useState(practiceMode ? '' : stat.userAnswer || '');
  const [correctAnswer, setCorrectAnswer] = useState(initialAnswer);
  const [explanation, setExplanation] = useState(stat.explanation || question.explanation || '');
  const [wrongNotes, setWrongNotes] = useState(stat.wrongNotes || '');
  const [confidence, setConfidence] = useState(practiceDraft?.confidence || stat.lastConfidence || 3);
  const [errorType, setErrorType] = useState(practiceDraft?.errorType || stat.lastErrorType || '');
  const [open, setOpen] = useState(!compact);
  const [revealed, setRevealed] = useState(
    practiceMode ? false : (!hideAnswerUntilSubmit || Boolean(stat.lastAttemptAt))
  );
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [recordedThisAttempt, setRecordedThisAttempt] = useState(false);
  const latestStatRef = useRef(stat);

  useEffect(() => {
    latestStatRef.current = stat;
  }, [stat]);

  useEffect(() => {
    const nextAnswer = stat.correctAnswer || question.answer || '';

    if (practiceMode && practiceDraft) {
      setSelected(practiceDraft.selected ?? '');
      setCorrectAnswer(practiceDraft.correctAnswer ?? nextAnswer);
      setExplanation(practiceDraft.explanation ?? (stat.explanation || question.explanation || ''));
      setWrongNotes(practiceDraft.wrongNotes ?? (stat.wrongNotes || ''));
      setConfidence(practiceDraft.confidence ?? stat.lastConfidence ?? 3);
      setErrorType(practiceDraft.errorType ?? stat.lastErrorType ?? '');
      setRevealed(batchSubmitted || practiceDraft.revealed || false);
    } else {
      setSelected(practiceMode ? '' : stat.userAnswer || '');
      setCorrectAnswer(nextAnswer);
      setExplanation(stat.explanation || question.explanation || '');
      setWrongNotes(stat.wrongNotes || '');
      setConfidence(stat.lastConfidence || 3);
      setErrorType(stat.lastErrorType || '');
      setRevealed(
        practiceMode ? false : (!hideAnswerUntilSubmit || Boolean(stat.lastAttemptAt))
      );
    }

    setNotesExpanded(false);
    setFeedback('');
    setRecordedThisAttempt(false);
    latestStatRef.current = stat;
    // Local answer state should reset only when the rendered question changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  useEffect(() => {
    if (practiceMode) setRevealed(batchSubmitted);
  }, [batchSubmitted, practiceMode]);

  const onPracticeChangeRef = useRef(onPracticeChange);
  useEffect(() => { onPracticeChangeRef.current = onPracticeChange; }, [onPracticeChange]);

  useEffect(() => {
    if (!practiceMode || !onPracticeChangeRef.current) return;
    const current = practiceDraft || {};
    const patch = {
      selected,
      revealed,
      correctAnswer,
      explanation,
      wrongNotes,
      confidence,
      errorType,
    };

    const same =
      current.selected === patch.selected &&
      current.revealed === patch.revealed &&
      current.correctAnswer === patch.correctAnswer &&
      current.explanation === patch.explanation &&
      current.wrongNotes === patch.wrongNotes &&
      current.confidence === patch.confidence &&
      current.errorType === patch.errorType;

    if (!same) {
      const timeout = window.setTimeout(() => {
        onPracticeChangeRef.current?.(patch);
      }, 250);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [selected, revealed, correctAnswer, explanation, wrongNotes, confidence, errorType, practiceMode, practiceDraft]);

  const answerIsSingleChoice = /^[A-E]$/.test(String(correctAnswer || '').trim().toUpperCase());
  const isCorrectSelection = selected && answerIsSingleChoice && selected === String(correctAnswer).trim().toUpperCase();
  const selectedErrorRemediation = errorType ? getRemediationForErrorType(errorType) : null;
  const taxonomyChips = [
    question.tags?.cancerType,
    question.tags?.stage,
    question.tags?.clinicalSetting,
    question.tags?.treatmentModality,
    question.tags?.evidenceType,
    question.tags?.questionType,
    ...(question.tags?.biomarker || []),
  ].filter(Boolean);
  const ratingSchedulePreviews = Object.fromEntries(
    Object.keys(FLASHCARD_RATINGS).map((rating) => [rating, getReviewSchedulePreview(rating, stat)])
  );
  const hasRecordedCurrentPracticeAttempt = practiceMode && (
    recordedThisAttempt
    || (stat.answerHistory || []).some((event) => event?.date === TODAY && event?.mode === 'daily' && event?.questionId === question.id)
    || (practiceDraft?.rated && stat.lastAttemptAt === TODAY && (stat.attempts || 0) > 0)
  );
  const hasRecordedCurrentAnswer = recordedThisAttempt || (
    practiceMode
      ? (stat.answerHistory || []).some((event) => event?.date === TODAY && event?.mode === 'daily' && event?.questionId === question.id)
      : stat.lastAttemptAt === TODAY && Boolean(stat.lastResult)
  );
  const hasRecordedCurrentWrongAttempt = !isCorrectSelection && (
    recordedThisAttempt
    || practiceDraft?.rated
    || (stat.lastAttemptAt === TODAY && stat.lastResult === 'wrong' && (stat.attempts || 0) > 0)
  );

  const recordRating = (rating, { countAttempt = true, allowMissingErrorType = false } = {}) => {
    if (practiceMode && hasRecordedCurrentPracticeAttempt && countAttempt) {
      setFeedback('此題已評分，跳過重複紀錄。');
      return false;
    }

    const previous = latestStatRef.current || stat;
    const newAttempts = (previous.attempts || 0) + (countAttempt ? 1 : 0);
    // Determine correctness by comparing selected option to correctAnswer
    const isCorrect = answerIsSingleChoice && selected === String(correctAnswer).trim().toUpperCase();
    const newCorrect = previous.correct + (countAttempt && isCorrect ? 1 : 0);
    const newWrong = previous.wrong + (countAttempt && !isCorrect ? 1 : 0);

    if (!isCorrect && !errorType && !allowMissingErrorType) {
      setFeedback('答錯題必須先選擇 Error type，才能送出評分並排入訂正清單。');
      return false;
    }

    if (!hideAnswerUntilSubmit) {
      playResultFeedback(isCorrect ? 'correct' : 'wrong');
    }

    const ratingScoreMap = { Again: 4, Hard: 3, Good: 2, Easy: 1 };
    const score = ratingScoreMap[rating] || 3;
    const prevDifficulty = previous.difficulty || 3;
    const newDifficulty = Math.round(((prevDifficulty * (previous.attempts || 0)) + score) / newAttempts * 10) / 10;

    let nextMastery = previous.mastery || 0;
    if (rating === 'Again') nextMastery = Math.max(0, nextMastery - 1);
    if (rating === 'Hard') nextMastery = Math.max(0, nextMastery);
    if (rating === 'Good') nextMastery = Math.min(5, nextMastery + 1);
    if (rating === 'Easy') nextMastery = Math.min(5, nextMastery + 2);

    const interval = nextIntervalByRating(rating, previous);
    const normalizedConfidence = Number(confidence) || 3;
    const wasPreviouslyWrong = (previous.wrong || 0) > 0;
    const remediation = !isCorrect && errorType ? getRemediationForErrorType(errorType) : null;
    const remediationEvent = remediation ? {
      date: TODAY,
      questionId: question.id,
      errorType,
      task: remediation.task,
      cardType: remediation.cardType,
      action: remediation.action,
    } : null;
    const answerEvent = {
      date: TODAY,
      mode: practiceMode ? 'daily' : 'review',
      questionId: question.id,
      cancer: question.cancer,
      topic: question.topic,
      selected: selected || null,
      correctAnswer: correctAnswer || previous.correctAnswer || question.answer || null,
      isCorrect,
      confidence: normalizedConfidence,
      rating,
      errorType: isCorrect ? '' : errorType || 'pending',
      remediationTask: remediation?.task || '',
      remediationCardType: remediation?.cardType || '',
    };

    const nextStat = {
      ...previous,
      attempts: newAttempts,
      correct: newCorrect,
      wrong: newWrong,
      lastResult: isCorrect ? 'correct' : 'wrong',
      lastAttemptAt: TODAY,
      nextReviewDate: addDays(TODAY, interval),
      mastery: nextMastery,
      difficulty: newDifficulty,
      intervalDays: interval,
      userAnswer: selected || previous.userAnswer || null,
      correctAnswer: correctAnswer || previous.correctAnswer || question.answer || null,
      explanation,
      wrongNotes,
      lastRating: rating,
      lastConfidence: normalizedConfidence,
      lastErrorType: isCorrect ? '' : errorType,
      confidenceHistory: countAttempt ? [...(previous.confidenceHistory || []), normalizedConfidence].slice(-50) : (previous.confidenceHistory || []),
      answerHistory: countAttempt ? [...(previous.answerHistory || []), answerEvent].slice(-50) : (previous.answerHistory || []),
      highConfidenceWrong: (previous.highConfidenceWrong || 0) + (countAttempt && !isCorrect && normalizedConfidence >= 4 ? 1 : 0),
      repeatedWrong: countAttempt ? (isCorrect ? 0 : (previous.repeatedWrong || 0) + 1) : (previous.repeatedWrong || 0),
      wrongRetestAttempts: (previous.wrongRetestAttempts || 0) + (countAttempt && wasPreviouslyWrong ? 1 : 0),
      wrongRetestCorrect: (previous.wrongRetestCorrect || 0) + (countAttempt && wasPreviouslyWrong && isCorrect ? 1 : 0),
      errorTypes: isCorrect || !errorType || (previous.errorTypes || []).at(-1) === errorType ? (previous.errorTypes || []) : [...(previous.errorTypes || []), errorType].slice(-20),
      lastRemediationTask: remediationEvent || previous.lastRemediationTask || null,
      remediationTasks: remediationEvent ? [remediationEvent, ...(previous.remediationTasks || [])].slice(0, 20) : (previous.remediationTasks || []),
    };

    latestStatRef.current = nextStat;
    onUpdateStat(question.id, nextStat);
    if (countAttempt) setRecordedThisAttempt(true);

    setFeedback(!isCorrect && !errorType
      ? `已記錄錯誤 1 次，請選擇 Error type 完成訂正。預設下次複習 ${interval} 天後。`
      : `紀錄：${rating}，下次複習 ${interval} 天後${remediation ? `。訂正重點：${remediation.task}` : ''}`);

    // Mark practiceDraft as rated so UI/logic won't double-record
    if (practiceMode && onPracticeChange) {
      onPracticeChange({ rated: true, rating });
    }
    return true;
  };

  const recordUngradedAttempt = () => {
    if (practiceMode && hasRecordedCurrentPracticeAttempt) {
      setFeedback('此題已記錄作答，跳過重複紀錄。');
      return false;
    }

    const previous = latestStatRef.current || stat;
    const normalizedConfidence = Number(confidence) || 3;
    const answerEvent = {
      date: TODAY,
      mode: practiceMode ? 'daily' : 'review',
      questionId: question.id,
      cancer: question.cancer,
      topic: question.topic,
      selected: selected || null,
      correctAnswer: null,
      isCorrect: null,
      confidence: normalizedConfidence,
      rating: 'Ungraded',
      errorType: '',
      remediationTask: '',
      remediationCardType: '',
    };
    const nextStat = {
      ...previous,
      ungradedAttempts: (previous.ungradedAttempts || 0) + 1,
      lastResult: 'ungraded',
      lastRating: 'Ungraded',
      lastAttemptAt: TODAY,
      userAnswer: selected || previous.userAnswer || null,
      correctAnswer: correctAnswer || previous.correctAnswer || question.answer || null,
      explanation,
      wrongNotes,
      lastConfidence: normalizedConfidence,
      confidenceHistory: [...(previous.confidenceHistory || []), normalizedConfidence].slice(-50),
      answerHistory: [...(previous.answerHistory || []), answerEvent].slice(-50),
    };

    latestStatRef.current = nextStat;
    onUpdateStat(question.id, nextStat);
    setRecordedThisAttempt(true);
    if (practiceMode && onPracticeChange) {
      onPracticeChange({ rated: true, rating: 'Ungraded' });
    }
    setFeedback('已記錄作答；此題尚未設定正解，所以不列入 correct / wrong。');
    return true;
  };

  const submitAnswer = () => {
    if (!selected) {
      setFeedback('請先選擇一個答案。');
      return;
    }
    setRevealed(true);
    if (answerIsSingleChoice) {
      playResultFeedback(isCorrectSelection ? 'correct' : 'wrong');
    } else {
      triggerHapticFeedback('tap');
    }
    if (answerIsSingleChoice && isCorrectSelection) {
      const recorded = recordRating('Good');
      if (!recorded) {
        setFeedback('答對。');
      }
      return;
    }

    if (answerIsSingleChoice) {
      recordRating('Again', { allowMissingErrorType: true });
      return;
    }

    recordUngradedAttempt();
  };

  const saveNote = () => {
    onUpdateStat(question.id, {
      ...stat,
      userAnswer: selected || null,
      correctAnswer: correctAnswer || null,
      explanation,
      wrongNotes,
    });
    setFeedback('已儲存詳解/筆記。');
  };

  const toggleBookmark = () => {
    onUpdateStat(question.id, { ...stat, bookmarked: !stat.bookmarked });
  };

  const updateRecordedErrorType = (nextErrorType) => {
    setErrorType(nextErrorType);
    if (practiceMode && batchSubmitted) {
      onPracticeChange?.({ errorType: nextErrorType });
      setFeedback(nextErrorType ? `已選擇錯因：${nextErrorType}` : '請選擇錯因。');
      return;
    }
    if (!hasRecordedCurrentWrongAttempt || !nextErrorType || isCorrectSelection) return;

    const remediation = getRemediationForErrorType(nextErrorType);
    const remediationEvent = {
      date: TODAY,
      questionId: question.id,
      errorType: nextErrorType,
      task: remediation.task,
      cardType: remediation.cardType,
      action: remediation.action,
    };

    const baseStat = latestStatRef.current || stat;
    const nextStat = {
      ...baseStat,
      lastErrorType: nextErrorType,
      errorTypes: (baseStat.errorTypes || []).at(-1) === nextErrorType ? (baseStat.errorTypes || []) : [...(baseStat.errorTypes || []), nextErrorType].slice(-20),
      lastRemediationTask: remediationEvent,
      remediationTasks: [remediationEvent, ...(baseStat.remediationTasks || [])].slice(0, 20),
    };

    latestStatRef.current = nextStat;
    onUpdateStat(question.id, nextStat);
    onPracticeChange?.({ errorType: nextErrorType });
    setFeedback(`已補上錯因：${nextErrorType}。訂正重點：${remediation.task}`);
  };

  return (
    <article className="question-card" data-question-id={question.id}>
      <div className="question-top">
        <div>
          <button className="link-button" onClick={() => setOpen(!open)}>{open ? '收合' : '展開'}</button>
          <span className="qid">{question.id}</span>
          {question.notionUrl && (
            <a className="notion-link" href={normalizeNotionExternalUrl(question.notionUrl)} target="_blank" rel="noreferrer" title="Open Notion explanation">🔗</a>
          )}
          <span className="pill">{question.cancer}</span>
          <span className="pill soft">{question.topic}</span>
          {question.trials?.map((trial, index) => <span key={`${trial}-${index}`} className="pill trial">{trial}</span>)}
          {taxonomyChips.slice(0, compact ? 3 : 7).map((tag, index) => <span key={`${tag}-${index}`} className="pill tag">{tag}</span>)}
        </div>
        <div className="question-actions">
            {onEdit && <button className="secondary" onClick={() => onEdit(question.id)}>編輯題目</button>}
            {question.notionUrl && (
              <button className="secondary" onClick={() => window.open(normalizeNotionExternalUrl(question.notionUrl), '_blank')}>Notion 詳解</button>
            )}
            <button className={stat.bookmarked ? 'bookmark active' : 'bookmark'} onClick={toggleBookmark}>
              {stat.bookmarked ? '★ 已標記' : '☆ 標記'}
            </button>
        </div>
      </div>

      <p className="stem">{question.stem}</p>
      {!compact && question.tags?.hashTags?.length > 0 && (
        <div className="taxonomy-tags" aria-label="Question taxonomy tags">
          {question.tags.hashTags.map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}
        </div>
      )}

      {open && (
        <>
          {question.questionFigures?.length > 0 && (
            <div className="question-figures">
              <div className="figure-grid">
                {question.questionFigures.map((src, index) => (
                  <a key={src} href={src} target="_blank" rel="noreferrer" className="figure-card">
                    <img src={src} alt={`${question.id} question figure ${index + 1}`} />
                    <span>Question Figure {index + 1}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="options">
            {Object.entries(question.options || {}).map(([key, value]) => {
              const showCorrect = revealed && answerIsSingleChoice && key === String(correctAnswer).trim().toUpperCase();
              const showWrong = revealed && selected === key && answerIsSingleChoice && key !== String(correctAnswer).trim().toUpperCase();
              const className = [
                'option',
                selected === key ? 'selected' : '',
                showCorrect ? 'correct-option' : '',
                showWrong ? 'wrong-option' : '',
              ].filter(Boolean).join(' ');

              return (
                <label key={key} className={className}>
                  <input
                    type="radio"
                    name={`q-${question.id}`}
                    checked={selected === key}
                    disabled={hideAnswerUntilSubmit && revealed}
                    onChange={() => {
                      setSelected(key);
                      if (practiceMode && onPracticeChangeRef.current) {
                        onPracticeChangeRef.current({ selected: key });
                      }
                    }}
                  />
                  <span className="option-key">{key}</span>
                  <span>{value}</span>
                </label>
              );
            })}
          </div>

          {practiceMode && !revealed && (
            <div className="answer-row">
              <label>
                Confidence
                <select value={confidence} onChange={(e) => setConfidence(Number(e.target.value))}>
                  <option value={1}>1 完全猜</option>
                  <option value={2}>2 不太確定</option>
                  <option value={3}>3 有印象</option>
                  <option value={4}>4 有把握</option>
                  <option value={5}>5 非常確定</option>
                </select>
              </label>
            </div>
          )}

          {hideAnswerUntilSubmit && !revealed && !practiceMode && (
            <div className="submit-row">
              <button className="primary" onClick={submitAnswer}>送出作答後顯示正解與詳解</button>
              {feedback && <span className="save-message">{feedback}</span>}
            </div>
          )}

          {revealed && (
            <>
              <div className="feedback-box">
                <div>
                  <strong>{feedback || '已揭示答案。'}</strong>
                  <p className="muted">你的答案：{selected || '未選'} ｜ 正解：{correctAnswer || '尚未輸入'}</p>
                </div>
                {answerIsSingleChoice && (
                  <span className={isCorrectSelection ? 'result-pill correct' : 'result-pill wrong'}>
                    {isCorrectSelection ? 'Correct' : 'Wrong'}
                  </span>
                )}
              </div>

              <div className="answer-row">
                {(!practiceMode || (batchSubmitted && !question.answer)) && <label>
                  正解
                  <select
                    disabled={practiceMode && batchFinalized}
                    value={correctAnswer}
                    onChange={(e) => {
                      setCorrectAnswer(e.target.value);
                      setErrorType('');
                      if (practiceMode) onPracticeChange?.({ correctAnswer: e.target.value, errorType: '' });
                    }}
                  >
                    <option value="" disabled={practiceMode && batchSubmitted}>尚未輸入</option>
                    {['A', 'B', 'C', 'D', 'E'].map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>}
                <label>
                  Confidence
                  <select disabled={practiceMode && batchSubmitted} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))}>
                    <option value={1}>1 完全猜</option>
                    <option value={2}>2 不太確定</option>
                    <option value={3}>3 有印象</option>
                    <option value={4}>4 有把握</option>
                    <option value={5}>5 非常確定</option>
                  </select>
                </label>
                {!isCorrectSelection && answerIsSingleChoice && (
                  <label>
                    Error type
                    <select value={errorType} onChange={(e) => updateRecordedErrorType(e.target.value)}>
                      <option value="">選擇錯因</option>
                      {ERROR_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </label>
                )}
                {!isCorrectSelection && answerIsSingleChoice && selectedErrorRemediation && (
                  <div className="remediation-preview">
                    <strong>{selectedErrorRemediation.task}</strong>
                    <span>{selectedErrorRemediation.action}</span>
                  </div>
                )}
                {(!practiceMode || batchSubmitted) && <label>
                  Mastery
                  <select disabled={practiceMode} value={stat.mastery || 0} onChange={(e) => onUpdateStat(question.id, { ...stat, mastery: Number(e.target.value) })}>
                    {[0, 1, 2, 3, 4, 5].map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>}
                {(!practiceMode || batchSubmitted) && (answerIsSingleChoice ? (
                  <div className="rating-buttons">
                    <button
                      className="rating-button again"
                      title={`Again（重複）：重新學習，下次 ${ratingSchedulePreviews.Again.dueLabel}`}
                      onClick={() => practiceMode ? onPracticeChange?.({ rated: true, rating: 'Again' }) : recordRating('Again', { countAttempt: !hasRecordedCurrentPracticeAttempt })}
                    >
                      🔁 Again
                      <div className="rating-sub">重學 · {ratingSchedulePreviews.Again.shortLabel}</div>
                    </button>
                    <button
                      className="rating-button hard"
                      title={`Hard（難）：答對但不穩，下次 ${ratingSchedulePreviews.Hard.dueLabel}`}
                      onClick={() => practiceMode ? onPracticeChange?.({ rated: true, rating: 'Hard' }) : recordRating('Hard', { countAttempt: !hasRecordedCurrentPracticeAttempt })}
                    >
                      🟠 Hard
                      <div className="rating-sub">偏難 · {ratingSchedulePreviews.Hard.shortLabel}</div>
                    </button>
                    <button
                      className="rating-button good"
                      title={`Good（好）：正常答對，下次 ${ratingSchedulePreviews.Good.dueLabel}`}
                      onClick={() => practiceMode ? onPracticeChange?.({ rated: true, rating: 'Good' }) : recordRating('Good', { countAttempt: !hasRecordedCurrentPracticeAttempt })}
                    >
                      ✅ Good
                      <div className="rating-sub">正常 · {ratingSchedulePreviews.Good.shortLabel}</div>
                    </button>
                    <button
                      className="rating-button easy"
                      title={`Easy（非常熟）：秒答且熟悉，下次 ${ratingSchedulePreviews.Easy.dueLabel}`}
                      onClick={() => practiceMode ? onPracticeChange?.({ rated: true, rating: 'Easy' }) : recordRating('Easy', { countAttempt: !hasRecordedCurrentPracticeAttempt })}
                    >
                      ✨ Easy
                      <div className="rating-sub">熟悉 · {ratingSchedulePreviews.Easy.shortLabel}</div>
                    </button>
                  </div>
                ) : (
                  <button className="primary" disabled={hasRecordedCurrentAnswer} onClick={recordUngradedAttempt}>
                    {hasRecordedCurrentAnswer ? '已記錄未判分作答' : '記錄未判分作答'}
                  </button>
                ))}
                {!practiceMode && <button className="secondary" onClick={saveNote}>儲存詳解/筆記</button>}
                {practiceMode && (
                  <button className="secondary" onClick={() => setNotesExpanded(true)}>放大閱讀/編輯</button>
                )}
              </div>

              <div className={practiceMode ? 'textareas practice-note-grid' : 'textareas'}>
                <label>
                  詳解 / guideline / trial note
                  <textarea
                    value={explanation}
                    onFocus={() => practiceMode && setNotesExpanded(true)}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder="例如：KEYNOTE-671 為 perioperative pembrolizumab + platinum-doublet chemotherapy，primary endpoint 為 EFS 與 OS..."
                  />
                </label>
                <label>
                  錯誤原因 / 弱點標籤
                  <textarea
                    value={wrongNotes}
                    onFocus={() => practiceMode && setNotesExpanded(true)}
                    onChange={(e) => setWrongNotes(e.target.value)}
                    placeholder="例如：忘記 eligibility、HR、primary endpoint、biomarker cutoff、toxicity..."
                  />
                </label>
              </div>

              {practiceMode && notesExpanded && (
                <div className="note-reader-backdrop" role="dialog" aria-modal="true" aria-label={`${question.id} 詳解與錯誤原因放大閱讀`}>
                  <div className="note-reader-panel">
                    <div className="note-reader-head">
                      <div>
                        <span className="qid">{question.id}</span>
                        <span className="pill">{question.cancer}</span>
                        <span className="pill soft">{question.topic}</span>
                      </div>
                      <button className="secondary" onClick={() => setNotesExpanded(false)}>關閉</button>
                    </div>
                    <div className="note-reader-layout">
                      <label>
                        詳解 / guideline / trial note
                        <textarea
                          value={explanation}
                          onChange={(e) => setExplanation(e.target.value)}
                          autoFocus
                          placeholder="答案、考點、為什麼其他選項錯、相關 trial/guideline、記憶點。"
                        />
                      </label>
                      <label>
                        錯誤原因 / 弱點標籤
                        <textarea
                          value={wrongNotes}
                          onChange={(e) => setWrongNotes(e.target.value)}
                          placeholder="例如：忘記 eligibility、HR、primary endpoint、biomarker cutoff、toxicity..."
                        />
                      </label>
                    </div>
                    <div className="inline-actions note-reader-actions">
                      <button className="primary" onClick={saveNote}>儲存詳解/筆記</button>
                      <button className="secondary" onClick={() => setNotesExpanded(false)}>回到題目</button>
                      {feedback && <span className="save-message">{feedback}</span>}
                    </div>
                  </div>
                </div>
              )}

              {question.explanationFigures?.length > 0 && (
                <div className="explanation-figures">
                  <h4>詳解附圖</h4>
                  <div className="figure-grid">
                    {question.explanationFigures.map((src, index) => (
                      <a key={src} href={src} target="_blank" rel="noreferrer" className="figure-card">
                        <img src={src} alt={`${question.id} explanation figure ${index + 1}`} />
                        <span>Figure {index + 1}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <div className="stats-line">
        attempts {stat.attempts} · correct {stat.correct} · wrong {stat.wrong} · ungraded {stat.ungradedAttempts || 0} · wrong rate {wrongRate(stat)}% · high-confidence wrong {stat.highConfidenceWrong || 0} · next review {stat.nextReviewDate || 'not scheduled'}
        {stat.lastErrorType && <> · last error {stat.lastErrorType}</>}
        {stat.lastRemediationTask?.task && <> · repair {stat.lastRemediationTask.task}</>}
      </div>
    </article>
  );
}

function QuestionEditor({ question, override, onSave, onCancel }) {
  const [draft, setDraft] = useState({
    stem: question?.stem || '',
    options: {
      A: (override?.options?.A ?? question?.options?.A) || '',
      B: (override?.options?.B ?? question?.options?.B) || '',
      C: (override?.options?.C ?? question?.options?.C) || '',
      D: (override?.options?.D ?? question?.options?.D) || '',
      E: (override?.options?.E ?? question?.options?.E) || '',
    },
    answer: override?.answer ?? question?.answer ?? '',
    cancer: override?.cancer ?? question?.cancer ?? '',
    topic: override?.topic ?? question?.topic ?? '',
    trials: (override?.trials ?? question?.trials ?? []).join(', '),
    explanation: override?.explanation ?? question?.explanation ?? '',
    notionUrl: override?.notionUrl ?? question?.notionUrl ?? '',
  });

  useEffect(() => {
    if (!question) return;

    setDraft({
      stem: question.stem || '',
      options: {
        A: question.options?.A || '',
        B: question.options?.B || '',
        C: question.options?.C || '',
        D: question.options?.D || '',
        E: question.options?.E || '',
      },
      answer: question.answer || '',
      cancer: question.cancer || '',
      topic: question.topic || '',
      trials: (question.trials || []).join(', '),
      explanation: question.explanation || '',
      notionUrl: question.notionUrl || '',
    });
    // Editing form state should reset only when a different question is selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id]);

  const save = () => {
    const nextOverride = {
      stem: draft.stem,
      options: { ...draft.options },
      answer: draft.answer,
      cancer: draft.cancer,
      topic: draft.topic,
      trials: draft.trials.split(',').map((t) => t.trim()).filter(Boolean),
      explanation: draft.explanation,
      notionUrl: draft.notionUrl,
    };
    onSave(question.id, nextOverride);
    onCancel();
  };

  const clearOverride = () => {
    if (window.confirm('確定清除此題的編輯內容嗎？')) {
      onSave(question.id, null);
      onCancel();
    }
  };

  return (
    <div className="question-editor panel">
      <div className="section-head">
        <div>
          <h3>{question.id} 編輯題目</h3>
          <p className="muted">覆蓋題幹、選項、答案、癌別、題目主題、trial、詳解。</p>
        </div>
        <div className="inline-actions mini">
          <button className="secondary" onClick={onCancel}>取消</button>
        </div>
      </div>

      <label>
        題幹
        <textarea value={draft.stem} onChange={(e) => setDraft((p) => ({ ...p, stem: e.target.value }))} />
      </label>

      <div className="options-grid">
        <label>
          選項 A
          <input name="draft_optionA" value={draft.options.A} onChange={(e) => setDraft((p) => ({ ...p, options: { ...p.options, A: e.target.value } }))} />
        </label>
        <label>
          選項 B
          <input name="draft_optionB" value={draft.options.B} onChange={(e) => setDraft((p) => ({ ...p, options: { ...p.options, B: e.target.value } }))} />
        </label>
        <label>
          選項 C
          <input name="draft_optionC" value={draft.options.C} onChange={(e) => setDraft((p) => ({ ...p, options: { ...p.options, C: e.target.value } }))} />
        </label>
        <label>
          選項 D
          <input name="draft_optionD" value={draft.options.D} onChange={(e) => setDraft((p) => ({ ...p, options: { ...p.options, D: e.target.value } }))} />
        </label>
        <label>
          選項 E
          <input name="draft_optionE" value={draft.options.E} onChange={(e) => setDraft((p) => ({ ...p, options: { ...p.options, E: e.target.value } }))} />
        </label>
      </div>

      <div className="two-columns">
        <label>
          答案
          <select name="draft_answer" value={draft.answer} onChange={(e) => setDraft((p) => ({ ...p, answer: e.target.value }))}>
            <option value="">尚未輸入</option>
            {['A', 'B', 'C', 'D', 'E'].map((optionKey) => <option key={optionKey} value={optionKey}>{optionKey}</option>)}
          </select>
        </label>
        <label>
          Cancer
          <input name="draft_cancer" value={draft.cancer} onChange={(e) => setDraft((p) => ({ ...p, cancer: e.target.value }))} />
        </label>
      </div>

      <div className="two-columns">
        <label>
          Topic
          <input name="draft_topic" value={draft.topic} onChange={(e) => setDraft((p) => ({ ...p, topic: e.target.value }))} />
        </label>
        <label>
          Trials
          <input name="draft_trials" value={draft.trials} onChange={(e) => setDraft((p) => ({ ...p, trials: e.target.value }))} placeholder="Use comma-separated values" />
        </label>
      </div>

      <label>
        詳解
        <textarea name="draft_explanation" value={draft.explanation} onChange={(e) => setDraft((p) => ({ ...p, explanation: e.target.value }))} />
      </label>

      <label>
        Notion URL
        <input name="draft_notionUrl" value={draft.notionUrl} onChange={(e) => setDraft((p) => ({ ...p, notionUrl: e.target.value }))} placeholder="https://www.notion.so/..." />
      </label>

      <div className="inline-actions">
        <button className="primary" onClick={save}>儲存編輯</button>
        {override && <button className="secondary" onClick={clearOverride}>清除編輯</button>}
      </div>
    </div>
  );
}


function SyncPanel({
  user,
  syncStatus,
  syncError,
  configStatus,
  onLogin,
  onRegister,
  onLogout,
  onPushLocalToCloud,
  onPullCloudToLocal,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submitLogin = () => {
    if (!email || !password) return;
    onLogin(email, password);
  };

  const submitRegister = () => {
    if (!email || !password) return;
    onRegister(email, password);
  };

  return (
    <main className="panel">
      <div className="section-head">
        <div>
          <h2>Cloud Sync：手機同步</h2>
          <p className="muted">登入同一組帳號後，MacBook、iPhone、iPad 會讀取同一份作答紀錄、錯題率、專注時間、讀書時長排行榜與 100-Day Plan checklist。</p>
        </div>
        <span className={user ? 'cloud-badge online' : 'cloud-badge offline'}>
          {user ? 'Cloud sync on' : 'Local only'}
        </span>
      </div>

      <div className="sync-status-card">
        <strong>同步狀態</strong>
        <p>{syncStatus}</p>
        {syncError && <p className="error-text">{syncError}</p>}
        {!configStatus?.configured && (
          <p className="error-text">Firebase 設定不完整：請確認 Vercel Environment Variables 已設定 VITE_FIREBASE_API_KEY、AUTH_DOMAIN、PROJECT_ID、APP_ID。</p>
        )}
        {configStatus?.usingFallback && (
          <p className="muted">目前使用內建 Firebase production 設定。若仍無法登入，請到 Firebase Console → Authentication → Settings → Authorized domains 加入 oncology-tracker.vercel.app。</p>
        )}
      </div>

      {!user ? (
        <div className="auth-grid">
          <label>
            Email
            <input name="sync_email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" autoComplete="email" />
          </label>
          <label>
            Password
            <input name="sync_password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 個字元" type="password" autoComplete="current-password" />
          </label>
          <div className="inline-actions">
            <button className="primary" onClick={submitLogin}>登入同步</button>
            <button className="secondary" onClick={submitRegister}>建立帳號</button>
          </div>
          <p className="muted">第一次使用請先按「建立帳號」。之後手機打開同一個網站，用同一組 email/password 登入即可同步。</p>
        </div>
      ) : (
        <div className="cloud-actions">
          <div>
            <strong>目前帳號</strong>
            <p>{user.email}</p>
          </div>
          <div className="inline-actions">
            <button className="secondary" onClick={onPushLocalToCloud}>把本機資料上傳到雲端</button>
            <button className="secondary" onClick={onPullCloudToLocal}>從雲端覆蓋本機資料</button>
            <button className="danger" onClick={onLogout}>登出</button>
          </div>
        </div>
      )}

      <div className="subsection">
        <h3>手機使用方式</h3>
        <ol className="sync-steps">
          <li>把專案 deploy 到 Vercel 或 Firebase Hosting。</li>
          <li>手機 Safari/Chrome 打開正式網址。</li>
          <li>登入同一組帳號。</li>
          <li>Daily Practice、Review Queue、專注時間、讀書時長排行榜、100-Day Plan 會自動同步。</li>
        </ol>
      </div>
    </main>
  );
}

function getFirebaseErrorMessage(error) {
  const code = error?.code || '';
  const message = error?.message || '未知錯誤';

  if (code === 'auth/network-request-failed') {
    return [
      'Firebase 登入請求沒有成功送出。',
      '請確認目前網路沒有封鎖 identitytoolkit.googleapis.com，並到 Firebase Console → Authentication → Settings → Authorized domains 加入 oncology-tracker.vercel.app。',
      firebaseConfigStatus.usingFallback ? '目前 app 已使用內建 Firebase production 設定。' : '也請確認 Vercel 已設定 VITE_FIREBASE_* 環境變數。',
    ].join(' ');
  }

  if (code === 'auth/unauthorized-domain') {
    return '這個網域尚未允許使用 Firebase Auth。請到 Firebase Console → Authentication → Settings → Authorized domains 加入 oncology-tracker.vercel.app。';
  }

  if (code === 'auth/invalid-api-key' || code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.') {
    return 'Firebase API key 無效或 production 沒有讀到 Vercel 環境變數。請確認 VITE_FIREBASE_API_KEY。';
  }

  if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return '帳號或密碼不正確；第一次使用請按「建立帳號」。';
  }

  if (code === 'auth/email-already-in-use') {
    return '這個 email 已建立過帳號，請直接按「登入同步」。';
  }

  if (code === 'auth/weak-password') {
    return '密碼至少需要 6 個字元。';
  }

  return message;
}

// Legacy standalone panel kept for data-migration safety; replaced by QuestionManagerPanel.
// eslint-disable-next-line no-unused-vars
function ManualExplanationPanel({ state, onUpdateStat }) {
  const [year, setYear] = useState('113');
  const [number, setNumber] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [wrongNotes, setWrongNotes] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const question = useMemo(() => {
    const numericNumber = Number(String(number).replace(/\D/g, ''));
    if (!numericNumber) return null;
    return questionBank.find((q) => Number(q.year) === Number(year) && Number(q.number) === numericNumber) || null;
  }, [year, number]);

  useEffect(() => {
    if (!question) {
      setCorrectAnswer('');
      setExplanation('');
      setWrongNotes('');
      setSaveMessage('');
      return;
    }
    const stat = getStat(state, question.id);
    setCorrectAnswer(stat.correctAnswer || question.answer || '');
    setExplanation(stat.explanation || question.explanation || '');
    setWrongNotes(stat.wrongNotes || '');
    setSaveMessage('');
    // Manual editor fields should reset only when switching to another question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id, state]);

  const saveManualExplanation = () => {
    if (!question) {
      setSaveMessage('找不到這個年度與題號，請確認題號。');
      return;
    }

    const stat = getStat(state, question.id);
    onUpdateStat(question.id, {
      ...stat,
      correctAnswer: correctAnswer || null,
      explanation,
      wrongNotes,
      manualEditedAt: new Date().toISOString(),
    });
    setSaveMessage(`${question.id} 已儲存正解與詳解。`);
  };

  const exportManualExplanations = () => {
    const manualItems = Object.entries(state.stats)
      .filter(([, stat]) => stat.explanation || stat.correctAnswer || stat.wrongNotes)
      .map(([id, stat]) => {
        const q = getQuestionWithOverride(id, state);
        return {
          id,
          year: q?.year || null,
          number: q?.number || null,
          cancer: q?.cancer || null,
          topic: q?.topic || null,
          correctAnswer: stat.correctAnswer || null,
          explanation: stat.explanation || '',
          wrongNotes: stat.wrongNotes || '',
          manualEditedAt: stat.manualEditedAt || null,
        };
      });

    const blob = new Blob([JSON.stringify(manualItems, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manual-explanations-${TODAY}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="panel">
      <div className="section-head">
        <div>
          <h2>Manual Add：手動加入正解與詳解</h2>
          <p className="muted">輸入年度與題號後，可直接補正解、詳解、trial note、錯誤原因。資料會儲存在 localStorage，並優先覆蓋內建詳解。</p>
        </div>
        <button className="secondary" onClick={exportManualExplanations}>匯出手動詳解 JSON</button>
      </div>

      <div className="manual-grid">
        <label>
          年度
          <select name="manual_year" value={year} onChange={(e) => setYear(e.target.value)}>
            {QUESTION_YEARS.map((questionYear) => (
              <option key={questionYear} value={questionYear}>{questionYear}</option>
            ))}
          </select>
        </label>

        <label>
          題號
          <input
            name="manual_number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="例如：23、023、Q023"
          />
        </label>

        <label>
          正解
          <select value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)}>
            <option value="">尚未輸入</option>
            {['A', 'B', 'C', 'D', 'E'].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      </div>

      {!question && (
        <div className="empty-state small">
          <h3>尚未選到題目</h3>
          <p>請輸入年度與題號。例如：年度選 113，題號輸入 23。</p>
        </div>
      )}

      {question && (
        <>
          <div className="found-question">
            <div>
              <span className="qid">{question.id}</span>
              <span className="pill">{question.cancer}</span>
              <span className="pill soft">{question.topic}</span>
              {question.trials?.map((trial) => <span key={trial} className="pill trial">{trial}</span>)}
            </div>
            <p className="stem">{question.stem}</p>
            <div className="options compact-options">
              {Object.entries(question.options || {}).map(([key, value]) => (
                <div key={key} className="option readonly-option">
                  <span className="option-key">{key}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="textareas">
            <label>
              詳解 / guideline / trial note
              <textarea
                name="manual_explanation"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="建議格式：答案、考點、為什麼其他選項錯、相關 trial/guideline、記憶點。"
              />
            </label>
            <label>
              錯誤原因 / 弱點標籤
              <textarea
                name="manual_wrongNotes"
                value={wrongNotes}
                onChange={(e) => setWrongNotes(e.target.value)}
                placeholder="例如：endpoint 不熟、biomarker cutoff 忘記、drug toxicity 混淆、trial population 不熟。"
              />
            </label>
          </div>

          <div className="inline-actions">
            <button className="primary" onClick={saveManualExplanation}>儲存這題詳解</button>
            {saveMessage && <span className="save-message">{saveMessage}</span>}
          </div>
        </>
      )}
    </main>
  );
}

// Legacy standalone panel kept for data-migration safety; replaced by QuestionManagerPanel.
// eslint-disable-next-line no-unused-vars
function QuestionEditPanel({ state, onSaveOverride }) {
  const [year, setYear] = useState('113');
  const [number, setNumber] = useState('');
  const [foundQuestion, setFoundQuestion] = useState(null);
  const [stem, setStem] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [optionE, setOptionE] = useState('');
  const [answer, setAnswer] = useState('');
  const [cancer, setCancer] = useState('');
  const [topic, setTopic] = useState('');
  const [trials, setTrials] = useState('');
  const [explanation, setExplanation] = useState('');
  const [notionUrl, setNotionUrl] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const numericNumber = Number(String(number).replace(/\D/g, ''));
    if (!numericNumber) {
      setFoundQuestion(null);
      return;
    }
    const q = questionBank.find((qq) => Number(qq.year) === Number(year) && Number(qq.number) === numericNumber) || null;
    setFoundQuestion(q);
    if (!q) {
      setStem(''); setOptionA(''); setOptionB(''); setOptionC(''); setOptionD(''); setOptionE(''); setAnswer(''); setCancer(''); setTopic(''); setTrials(''); setExplanation('');
      setMessage('找不到該題，請確認年度與題號');
      return;
    }
    const override = state.questionOverrides?.[q.id] || {};
    setStem(override.stem ?? q.stem ?? '');
    setOptionA(override.options?.A ?? q.options?.A ?? '');
    setOptionB(override.options?.B ?? q.options?.B ?? '');
    setOptionC(override.options?.C ?? q.options?.C ?? '');
    setOptionD(override.options?.D ?? q.options?.D ?? '');
    setOptionE(override.options?.E ?? q.options?.E ?? '');
    setAnswer(override.answer ?? q.answer ?? '');
    setCancer(override.cancer ?? q.cancer ?? '');
    setTopic(override.topic ?? q.topic ?? '');
    setTrials((override.trials || q.trials || []).join(', '));
    setExplanation(override.explanation ?? q.explanation ?? '');
    setNotionUrl(override.notionUrl ?? q.notionUrl ?? '');
    setMessage('');
  }, [year, number, state.questionOverrides]);

  const save = () => {
    if (!foundQuestion) { setMessage('找不到題目，無法儲存'); return; }
    const id = foundQuestion.id;
    const nextOverride = {
      stem,
      options: { A: optionA, B: optionB, C: optionC, D: optionD, E: optionE },
      answer,
      cancer,
      topic,
      trials: trials.split(',').map((t) => t.trim()).filter(Boolean),
      explanation,
      notionUrl,
    };
    onSaveOverride(id, nextOverride);
    setMessage(`${id} 已儲存修正`);
  };

  const restore = () => {
    if (!foundQuestion) { setMessage('找不到題目'); return; }
    if (!window.confirm('確定還原回原始題目？這會移除所有覆寫內容。')) return;
    onSaveOverride(foundQuestion.id, null);
    setMessage(`${foundQuestion.id} 已還原為原始題目`);
  };

  return (
    <main className="panel">
      <div className="section-head">
        <div>
          <h2>Question Edit</h2>
          <p className="muted">搜尋題目後可直接修改題幹、選項、答案與其他欄位，變更會存在本機並同步到雲端。</p>
        </div>
      </div>

      <div className="filters">
        <select name="edit_year" value={year} onChange={(e) => setYear(e.target.value)}>
          {QUESTION_YEARS.map((questionYear) => (
            <option key={questionYear}>{questionYear}</option>
          ))}
        </select>
        <input name="edit_number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="題號 (數字)" />
        <div className="inline-actions">
          <button className="secondary" onClick={() => { setNumber(''); setMessage(''); }}>清除</button>
        </div>
      </div>

      {foundQuestion ? (
        <div className="question-editor panel">
          <h3>{foundQuestion.id} 編輯題目</h3>
          <label>
            題幹
            <textarea name="edit_stem" value={stem} onChange={(e) => setStem(e.target.value)} />
          </label>
          <div className="options-grid">
              <label>選項 A<input name="edit_optionA" value={optionA} onChange={(e) => setOptionA(e.target.value)} /></label>
              <label>選項 B<input name="edit_optionB" value={optionB} onChange={(e) => setOptionB(e.target.value)} /></label>
              <label>選項 C<input name="edit_optionC" value={optionC} onChange={(e) => setOptionC(e.target.value)} /></label>
              <label>選項 D<input name="edit_optionD" value={optionD} onChange={(e) => setOptionD(e.target.value)} /></label>
              <label>選項 E<input name="edit_optionE" value={optionE} onChange={(e) => setOptionE(e.target.value)} /></label>
            </div>
            <div className="two-columns">
              <label>正解<select name="edit_answer" value={answer} onChange={(e) => setAnswer(e.target.value)}><option value="">尚未輸入</option>{['A','B','C','D','E'].map((x)=>(<option key={x} value={x}>{x}</option>))}</select></label>
              <label>Cancer<input name="edit_cancer" value={cancer} onChange={(e) => setCancer(e.target.value)} /></label>
            </div>
            <div className="two-columns">
              <label>Topic<input name="edit_topic" value={topic} onChange={(e) => setTopic(e.target.value)} /></label>
              <label>Trials<input name="edit_trials" value={trials} onChange={(e) => setTrials(e.target.value)} placeholder="逗號分隔" /></label>
            </div>
            <label>詳解<textarea name="edit_explanation" value={explanation} onChange={(e) => setExplanation(e.target.value)} /></label>
            <label>Notion URL<input name="edit_notionUrl" value={notionUrl} onChange={(e) => setNotionUrl(e.target.value)} placeholder="https://www.notion.so/..." /></label>

          <div className="inline-actions">
            <button className="primary" onClick={save}>儲存修正</button>
            <button className="secondary" onClick={restore}>還原原始題目</button>
            {message && <span className="save-message">{message}</span>}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p className="muted">請輸入年度與題號以載入題目。</p>
          {message && <div className="error-text">{message}</div>}
        </div>
      )}
    </main>
  );
}

function QuestionManagerPanel({
  state,
  questions,
  search,
  bankYear,
  bankCancer,
  editingQuestionId,
  onSearch,
  onYearChange,
  onCancerChange,
  onEdit,
  onSaveOverride,
  onSaveCustomQuestion,
  onDeleteQuestion,
  onUpdateStat,
}) {
  const [mode, setMode] = useState('browse');
  const [questionPage, setQuestionPage] = useState(0);
  const selectedQuestion = editingQuestionId ? getQuestionWithOverride(editingQuestionId, state) : null;
  const questionPageCount = Math.max(1, Math.ceil(questions.length / QUESTION_MANAGER_PAGE_SIZE));
  const currentQuestionPage = Math.min(questionPage, questionPageCount - 1);
  const visibleQuestions = questions.slice(
    currentQuestionPage * QUESTION_MANAGER_PAGE_SIZE,
    (currentQuestionPage + 1) * QUESTION_MANAGER_PAGE_SIZE
  );

  useEffect(() => {
    setQuestionPage(0);
  }, [search, bankYear, bankCancer]);

  const startNewQuestion = () => {
    const id = `custom-${Date.now()}`;
    const draft = normalizeQuestion({
      id,
      year: 'Custom',
      number: null,
      stem: '',
      options: { A: '', B: '', C: '', D: '', E: '' },
      answer: '',
      cancer: bankCancer !== 'All' ? bankCancer : 'Custom',
      topic: 'Manual',
      trials: [],
      explanation: '',
      sourceType: 'custom',
      createdAt: new Date().toISOString(),
    });
    onSaveCustomQuestion(draft);
    onEdit(id);
    setMode('edit');
  };

  const deleteSelected = () => {
    if (!selectedQuestion) return;
    const label = selectedQuestion.sourceType === 'custom' ? '刪除這題自訂題目' : '從題庫列表隱藏這題';
    if (!window.confirm(`${label}？作答紀錄會保留。`)) return;
    onDeleteQuestion(selectedQuestion.id);
    onEdit(null);
    setMode('browse');
  };

  const saveExplanation = (question, patch) => {
    const stat = getStat(state, question.id);
    onUpdateStat(question.id, {
      ...stat,
      correctAnswer: patch.correctAnswer || null,
      explanation: patch.explanation,
      wrongNotes: patch.wrongNotes,
      explanationImages: patch.explanationImages || [],
      manualEditedAt: new Date().toISOString(),
    });
  };

  return (
    <main className="panel question-manager-panel">
      <div className="section-head">
        <div>
          <h2>Question Manager</h2>
          <p className="muted">同一頁完成搜尋題庫、手動新增題目、補詳解、修改欄位與刪除/隱藏題目。</p>
        </div>
        <div className="inline-actions">
          <button className="primary" onClick={startNewQuestion}>新增題目</button>
          <button className="secondary" onClick={() => setMode(mode === 'browse' ? 'edit' : 'browse')} disabled={!selectedQuestion}>
            {mode === 'browse' ? '編輯選取題' : '回到瀏覽'}
          </button>
        </div>
      </div>

      <div className="filters">
        <input name="question_manager_search" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="搜尋題幹、trial、癌別、藥名、stage、biomarker、治療線..." />
        <select name="question_manager_year" value={bankYear} onChange={(e) => onYearChange(e.target.value)}>
          <option>All</option>
          {QUESTION_YEARS.map((questionYear) => (
            <option key={questionYear}>{questionYear}</option>
          ))}
          <option>Custom</option>
        </select>
        <select name="question_manager_cancer" value={bankCancer} onChange={(e) => onCancerChange(e.target.value)}>
          <option>All</option>
          {cancerCategories.map((c) => <option key={c}>{c}</option>)}
          <option>Custom</option>
        </select>
      </div>

      <div className="question-manager-layout">
        <section className="question-manager-list" aria-label="Question list">
          <div className="list-summary">
            <strong>{questions.length}</strong>
            <span className="muted">符合條件，第 {currentQuestionPage + 1}/{questionPageCount} 頁</span>
          </div>
          {visibleQuestions.map((q) => (
            <button
              type="button"
              key={q.id}
              className={editingQuestionId === q.id ? 'manager-question-row active' : 'manager-question-row'}
              onClick={() => { onEdit(q.id); setMode('browse'); }}
            >
              <span className="qid">{q.id}</span>
              <strong>{q.stem || '尚未輸入題幹'}</strong>
              <span>{q.cancer} · {q.tags?.cancerType || q.topic} · {q.tags?.clinicalSetting || q.topic}</span>
            </button>
          ))}
          <div className="pagination-row">
            <button className="secondary" type="button" disabled={currentQuestionPage === 0} onClick={() => setQuestionPage((page) => Math.max(0, page - 1))}>上一頁</button>
            <span>{currentQuestionPage + 1} / {questionPageCount}</span>
            <button className="secondary" type="button" disabled={currentQuestionPage + 1 >= questionPageCount} onClick={() => setQuestionPage((page) => Math.min(questionPageCount - 1, page + 1))}>下一頁</button>
          </div>
        </section>

        <section className="question-manager-detail" aria-label="Question detail">
          {!selectedQuestion ? (
            <div className="empty-state">
              <h3>選一題或新增題目</h3>
              <p>左側可搜尋題庫；右側會顯示題目、詳解與編輯器。</p>
            </div>
          ) : mode === 'edit' ? (
            <div>
              <QuestionEditor
                question={selectedQuestion}
                override={state.questionOverrides?.[selectedQuestion.id]}
                onSave={(id, override) => {
                  if (selectedQuestion.sourceType === 'custom') {
                    onSaveCustomQuestion(normalizeQuestion({ ...selectedQuestion, ...override, id, sourceType: 'custom', updatedAt: new Date().toISOString() }));
                  } else {
                    onSaveOverride(id, override);
                  }
                }}
                onCancel={() => setMode('browse')}
              />
              <div className="inline-actions danger-zone">
                <button className="danger" onClick={deleteSelected}>{selectedQuestion.sourceType === 'custom' ? '刪除題目' : '隱藏題目'}</button>
              </div>
            </div>
          ) : (
            <QuestionManagerDetail
              question={selectedQuestion}
              stat={getStat(state, selectedQuestion.id)}
              onEdit={() => setMode('edit')}
              onDelete={deleteSelected}
              onSaveExplanation={saveExplanation}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function QuestionManagerDetail({ question, stat, onEdit, onDelete, onSaveExplanation }) {
  const [correctAnswer, setCorrectAnswer] = useState(stat.correctAnswer || question.answer || '');
  const [explanation, setExplanation] = useState(stat.explanation || question.explanation || '');
  const [wrongNotes, setWrongNotes] = useState(stat.wrongNotes || '');
  const [explanationImages, setExplanationImages] = useState(stat.explanationImages || []);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setCorrectAnswer(stat.correctAnswer || question.answer || '');
    setExplanation(stat.explanation || question.explanation || '');
    setWrongNotes(stat.wrongNotes || '');
    setExplanationImages(Array.isArray(stat.explanationImages) ? stat.explanationImages : []);
    setMessage('');
  }, [question.id, stat.correctAnswer, stat.explanation, stat.wrongNotes, stat.explanationImages, question.answer, question.explanation]);

  const save = () => {
    onSaveExplanation(question, { correctAnswer, explanation, wrongNotes, explanationImages });
    setMessage('已儲存正解與詳解。');
  };

  const addImageFiles = async (files) => {
    const imageFiles = [...files].filter((file) => file?.type?.startsWith('image/'));
    if (!imageFiles.length) return;
    const dataUrls = await Promise.all(imageFiles.map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    })));
    setExplanationImages((prev) => [...prev, ...dataUrls]);
    setMessage('圖片已加入，記得儲存。');
  };

  const handlePasteImage = (event) => {
    const files = [...(event.clipboardData?.items || [])]
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean);
    if (!files.length) return;
    event.preventDefault();
    addImageFiles(files);
  };

  const removeImage = (index) => {
    setExplanationImages((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    setMessage('圖片已移除，記得儲存。');
  };

  return (
    <div className="manager-detail-card">
      <div className="question-top">
        <div>
          <span className="qid">{question.id}</span>
          <span className="pill">{question.cancer}</span>
          <span className="pill soft">{question.topic}</span>
          {question.sourceType === 'custom' && <span className="priority high">Custom</span>}
        </div>
        <div className="inline-actions mini">
          <button className="secondary" onClick={onEdit}>修改題目</button>
          <button className="danger" onClick={onDelete}>{question.sourceType === 'custom' ? '刪除' : '隱藏'}</button>
        </div>
      </div>
      <p className="stem">{question.stem || '尚未輸入題幹。'}</p>
      <div className="options compact-options">
        {Object.entries(question.options || {}).map(([key, value]) => (
          <div key={key} className="option readonly-option">
            <span className="option-key">{key}</span>
            <span>{value}</span>
          </div>
        ))}
      </div>

      <div className="manual-grid">
        <label>
          正解
          <select value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)}>
            <option value="">尚未輸入</option>
            {['A', 'B', 'C', 'D', 'E'].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label>
          Trials
          <input value={(question.trials || []).join(', ')} readOnly />
        </label>
      </div>

      <div className="textareas manager-note-grid">
        <label>
          詳解 / guideline / trial note
          <textarea value={explanation} onPaste={handlePasteImage} onChange={(e) => setExplanation(e.target.value)} placeholder="答案、考點、為什麼其他選項錯、相關 trial/guideline、記憶點。可直接貼上 JPG/PNG 圖片。" />
        </label>
        <label>
          錯誤原因 / 弱點標籤
          <textarea value={wrongNotes} onPaste={handlePasteImage} onChange={(e) => setWrongNotes(e.target.value)} placeholder="例如：endpoint 不熟、biomarker cutoff 忘記、drug toxicity 混淆。可直接貼上 JPG/PNG 圖片。" />
        </label>
      </div>

      <div className="image-attach-row">
        <label className="file-button">
          選擇 JPG/PNG
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => {
              addImageFiles(event.target.files || []);
              event.target.value = '';
            }}
          />
        </label>
        <span className="muted">也可以直接在上方詳解或錯誤原因欄位貼上截圖。</span>
      </div>

      {explanationImages.length > 0 && (
        <div className="note-image-grid">
          {explanationImages.map((src, index) => (
            <div className="note-image-card" key={`${src.slice(0, 48)}-${index}`}>
              <img src={src} alt={`${question.id} note attachment ${index + 1}`} />
              <button className="tiny" type="button" onClick={() => removeImage(index)}>移除圖片</button>
            </div>
          ))}
        </div>
      )}

      <div className="inline-actions">
        <button className="primary" onClick={save}>儲存正解/詳解</button>
        {message && <span className="save-message">{message}</span>}
      </div>
    </div>
  );
}

function QuestPanel({
  task,
  progress,
  recallCards,
  reviewHistory,
  bossChallenges,
  highYieldTopics,
  completionStatus,
  checkedInToday,
  checkInStreak,
  onCheckIn,
  onCreatePractice,
  isCreatingPractice,
  practiceMode,
  hasPracticeSession,
  remainingErrorTypes,
  onPracticeModeChange,
  onMarkRecall,
  onSetBossResult,
  onClaimStageClear,
  onOpenPractice,
}) {
  const [openRecallId, setOpenRecallId] = useState(recallCards[0]?.id || '');
  const [openBossId, setOpenBossId] = useState(bossChallenges[0]?.id || '');
  const [selectedMemoryView, setSelectedMemoryView] = useState('today');
  const [openHistoryCardId, setOpenHistoryCardId] = useState('');
  const bossPassed = Object.values(progress.bossResults || {}).filter(Boolean).length;
  const bossAnswered = Object.keys(progress.bossResults || {}).length;
  const allStars = progress.stars >= 3;
  const selectedHistory = selectedMemoryView === 'today'
    ? null
    : reviewHistory.find((item) => item.id === selectedMemoryView) || null;

  useEffect(() => {
    if (selectedMemoryView !== 'today' && !reviewHistory.some((item) => item.id === selectedMemoryView)) {
      setSelectedMemoryView('today');
      setOpenHistoryCardId('');
    }
  }, [reviewHistory, selectedMemoryView]);

  const starRows = [
    {
      key: 'practice',
      title: 'Practice Star',
      done: progress.practiceDone,
      text: remainingErrorTypes > 0 ? `題目已完成；尚有 ${remainingErrorTypes} 題錯因需要分類。` : '完成今日 Daily Practice 題目並評分。',
      action: progress.practiceDone || hasPracticeSession ? onOpenPractice : onCreatePractice,
      actionText: progress.practiceDone
        ? '查看今日練習'
        : remainingErrorTypes > 0
          ? `完成 ${remainingErrorTypes} 題錯因`
          : hasPracticeSession ? '繼續今日練習' : isCreatingPractice ? '產生中...' : '產生今日練習',
    },
    {
      key: 'memory',
      title: 'Memory Star',
      done: progress.memoryDone,
      text: '確認讀過今日 5 張 Top Recall。',
      action: null,
      actionText: '',
    },
    {
      key: 'mastery',
      title: 'Mastery Star',
      done: progress.bossDone,
      text: 'Boss Challenge 至少 2/3 通過。',
      action: null,
      actionText: '',
    },
  ];

  return (
    <main className="panel quest-panel">
      <section className={checkedInToday ? 'daily-checkin-card done' : 'daily-checkin-card'}>
        <div>
          <div className="eyebrow dark">Daily Check-in</div>
          <h3>{checkedInToday ? '今天已打卡' : '先把今天打開'}</h3>
          <p className="muted">連續打卡 {checkInStreak} 天。打卡會同步到雲端，也會補進今日寶箱進度。</p>
        </div>
        <button className={checkedInToday ? 'good' : 'primary'} type="button" disabled={checkedInToday} onClick={onCheckIn}>
          {checkedInToday ? '已完成' : '今日打卡'}
        </button>
      </section>

      <div className="quest-hero">
        <div>
          <div className="eyebrow">Today Quest</div>
          <h2>{task.day} {task.cancer} Dungeon</h2>
          <p className="quest-topic">{task.topic}</p>
          <p className="muted">{task.details}</p>
          <div className="trial-tags">
            {(task.goldenTrials || []).map((trial, index) => <span key={`${trial}-${index}`}>{trial}</span>)}
            {(task.focusTags || []).map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}
            <span>Weight {task.highYieldWeight || 3}</span>
          </div>
        </div>
        <div className={allStars ? 'stage-clear-card cleared' : 'stage-clear-card'}>
          <strong>{allStars ? 'Stage Clear Ready' : `${progress.stars}/3 Stars`}</strong>
          <span>{progress.xpClaimed ? 'XP claimed' : allStars ? '+100 XP available' : 'Clear all stars to claim XP'}</span>
          <button className="primary" disabled={!allStars || progress.xpClaimed} onClick={onClaimStageClear}>
            {progress.xpClaimed ? 'Stage Clear' : 'Claim Stage Clear'}
          </button>
        </div>
      </div>

      <section className="quest-star-strip" aria-label="Today quest star progress">
        {starRows.map((star, index) => (
          <div className={star.done ? 'quest-star-token done' : 'quest-star-token'} key={star.key}>
            <span className="quest-star-icon">{star.done ? '★' : '☆'}</span>
            <span className="quest-star-label">{index + 1}. {star.title.replace(' Star', '')}</span>
          </div>
        ))}
      </section>

      <section className="quest-star-grid">
        {starRows.map((star) => (
          <div className={star.done ? 'quest-star done' : 'quest-star'} key={star.key}>
            <strong>{star.done ? '⭐' : '☆'} {star.title}</strong>
            <p>{star.text}</p>
            {star.action && (
              <button
                className="secondary"
                disabled={star.key === 'practice' && isCreatingPractice}
                onClick={star.action}
              >
                {star.actionText}
              </button>
            )}
            {star.key === 'practice' && (
              <PracticeModeSelector value={practiceMode} onChange={onPracticeModeChange} />
            )}
          </div>
        ))}
      </section>

      <section className="adaptive-practice-card">
        <div>
          <h3>今日高頻插隊</h3>
          <p className="muted">主線仍是 {task.day}；Daily Practice 會額外補強高頻、近年更新、錯題率與久未複習的主題。</p>
        </div>
        <div className="high-yield-list">
          {highYieldTopics.slice(0, 4).map((topic) => (
            <span key={topic.id} className="high-yield-chip">
              {topic.label}
              <strong>{topic.priorityScore}</strong>
            </span>
          ))}
        </div>
      </section>

      <section className="completion-criteria-card">
        <h3>今日完成標準</h3>
        <div className="completion-criteria-grid">
          {completionStatus.map((item) => (
            <div className={item.done ? 'completion-item done' : 'completion-item'} key={item.label}>
              <span>{item.done ? '✓' : '○'}</span>
              <div>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {allStars && (
        <section className="stage-clear-banner">
          <h3>{progress.perfectClear ? 'Perfect Clear' : 'Stage Clear'}</h3>
          <p>今日副本完成。XP +100，下一關會從 100-Day Plan 的下一個未完成任務開始。</p>
        </section>
      )}

      <section className="subsection quest-memory-section">
        <div className="section-head compact">
          <div>
            <h3>Memory Star｜Top Recall</h3>
            <p className="muted">用自己的判斷讀過今日重點，確認 5 張即可拿 Memory Star；切到日期時可回看紀錄。</p>
          </div>
          <span className="priority">{selectedMemoryView === 'today' ? 'Today' : 'History'}</span>
        </div>

        <div className="memory-view-switcher" aria-label="Memory review switcher">
          <button
            className={selectedMemoryView === 'today' ? 'memory-view-chip active' : 'memory-view-chip'}
            type="button"
            onClick={() => {
              setSelectedMemoryView('today');
              setOpenHistoryCardId('');
            }}
          >
            <span>今日</span>
            <strong>{recallCards.length} recalls · {progress.stars}/3 stars</strong>
          </button>
          {reviewHistory.map((item) => (
            <button
              className={selectedMemoryView === item.id ? 'memory-view-chip active' : 'memory-view-chip'}
              type="button"
              key={item.id}
              onClick={() => {
                setSelectedMemoryView(item.id);
                setOpenHistoryCardId('');
              }}
            >
              <span>{item.date}</span>
              <strong>{item.reviewedCount} recalls · {item.stars}/3 stars</strong>
              <em>{item.taskLabel}</em>
            </button>
          ))}
        </div>

        {selectedMemoryView === 'today' ? (
          <div className="recall-grid">
            {recallCards.map((card) => {
              const confirmed = Boolean(progress.recallRatings?.[card.id]);
              const open = openRecallId === card.id;
              return (
                <article className={confirmed ? 'recall-card done' : 'recall-card'} key={card.id}>
                  <div className="question-top">
                    <span className="pill">{card.type}</span>
                    {confirmed && <span className="priority high">已讀</span>}
                  </div>
                  <strong>{card.front}</strong>
                  {open && <p className="recall-back">{card.back}</p>}
                  <div className="inline-actions">
                    <button className="secondary" onClick={() => setOpenRecallId(open ? '' : card.id)}>{open ? '收合' : '看內容'}</button>
                    <button className="good recall-confirm-button" disabled={confirmed} onClick={() => onMarkRecall(card)}>
                      {confirmed ? '已確認讀過' : '確認讀過'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : selectedHistory ? (
          <div className="quest-history-detail">
            <div className="quest-history-summary">
              <div>
                <span className="pill">{selectedHistory.cancer}</span>
                <strong>{selectedHistory.taskLabel}</strong>
                <p>{selectedHistory.date} · {selectedHistory.reviewedCount} 張已讀</p>
              </div>
              <div className="quest-history-stars" aria-label="Quest stars">
                {['Practice', 'Memory', 'Mastery'].map((label, index) => {
                  const done = [selectedHistory.practiceDone, selectedHistory.memoryDone, selectedHistory.bossDone][index];
                  return <span className={done ? 'done' : ''} key={label}>{done ? '★' : '☆'} {label}</span>;
                })}
              </div>
            </div>

            {selectedHistory.recallRows.length === 0 ? (
              <p className="muted">這一天有星星進度，但沒有留下單張 recall 紀錄。</p>
            ) : (
              <div className="quest-history-cards">
                {selectedHistory.recallRows.map((card) => {
                  const open = openHistoryCardId === card.id;
                  return (
                    <article className="quest-history-card" key={card.id}>
                      <div className="question-top">
                        <span className="pill">{card.type}</span>
                        <span className="priority high">{card.rating === 'Read' ? '已讀' : card.rating}</span>
                      </div>
                      <strong>{card.front}</strong>
                      {open && <p className="recall-back">{card.back || '這張卡目前沒有背面內容。'}</p>}
                      <button className="secondary" type="button" onClick={() => setOpenHistoryCardId(open ? '' : card.id)}>
                        {open ? '收合' : '看內容'}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state small">
            <h3>還沒有可回看的記憶紀錄</h3>
            <p>完成一次 Topic Recall 或 Flashcard Review 後，日期會出現在上方，可直接切換回看。</p>
          </div>
        )}
      </section>

      <section className="subsection">
        <h3>Boss Challenge</h3>
        <p className="muted">目前 {bossPassed}/3 通過，{bossAnswered}/3 已判定。2/3 通過即可拿 Mastery Star。</p>
        <div className="boss-challenge-grid">
          {bossChallenges.map((boss) => {
            const result = progress.bossResults?.[boss.id];
            const open = openBossId === boss.id;
            return (
              <article className={result === true ? 'boss-challenge pass' : result === false ? 'boss-challenge fail' : 'boss-challenge'} key={boss.id}>
                <strong>{boss.title}</strong>
                <p>{boss.prompt}</p>
                {open && <p className="recall-back">{boss.answerHint}</p>}
                <div className="inline-actions">
                  <button className="secondary" onClick={() => setOpenBossId(open ? '' : boss.id)}>{open ? '收合提示' : '看提示'}</button>
                  <button className="good" disabled={!boss.available} onClick={() => onSetBossResult(boss.id, true)}>Pass</button>
                  <button className="bad" disabled={!boss.available} onClick={() => onSetBossResult(boss.id, false)}>Fail</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function formatLibrarySyncTime(value) {
  if (!value) return '尚未同步';
  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function NotionLibraryCard({ note, onPreview, localCardCount = 0, compact = false }) {
  const noteType = inferNotionNoteType(note);
  const labels = [
    ...(note.cancerTypes || []),
    ...(note.genes || []),
    ...(note.tags || []),
  ].slice(0, compact ? 3 : 5);
  return (
    <article className={`notion-library-card ${compact ? 'compact' : ''}`}>
      <div className="notion-library-card-top">
        <span>{noteType}</span>
        <em className={note.flashcardCreated || localCardCount > 0 ? 'ready' : 'missing'}>
          {note.flashcardCreated ? 'Notion: ready' : localCardCount > 0 ? `Tracker: ${localCardCount} cards` : 'Not yet carded'}
        </em>
      </div>
      <strong>{note.title}</strong>
      {labels.length > 0 && (
        <div className="knowledge-chip-row">
          {labels.map((label) => <span className="knowledge-tag" key={`${note.id}-${label}`}>{label}</span>)}
        </div>
      )}
      <small>{note.cancerTypes?.[0] || 'Unclassified'} · Updated {formatLibrarySyncTime(note.lastEditedTime || note.createdTime)}</small>
      <div className="notion-library-card-actions">
        {getNotionPageId(note) && <button type="button" className="primary tiny" onClick={() => onPreview(note)}>閱讀筆記</button>}
        <a href={note.url} target="_blank" rel="noreferrer">前往 Notion 編輯 <ExternalLink size={14} /></a>
      </div>
    </article>
  );
}

export function NotionLearningStudio({ note, questions, flashcards, onOpenQuestion, onImportLearningDrafts }) {
  const [artifactType, setArtifactType] = useState('flashcards');
  const [prompt, setPrompt] = useState('');
  const [promptMessage, setPromptMessage] = useState('');
  const [rawJson, setRawJson] = useState('');
  const [draftState, setDraftState] = useState({ items: [], errors: [], total: 0 });
  const [selectedDrafts, setSelectedDrafts] = useState({});
  const [importMessage, setImportMessage] = useState('');
  const relatedRows = useMemo(
    () => getRelatedQuestionsForNotionNote(note, questions),
    [note, questions],
  );
  const relatedQuestions = useMemo(
    () => relatedRows.map(({ question }) => question),
    [relatedRows],
  );
  const learningContext = useMemo(
    () => deriveNotionLearningContext(note, relatedQuestions),
    [note, relatedQuestions],
  );
  const generatedPrompt = useMemo(
    () => buildNotionLearningPrompt({ artifactType, note, relatedQuestions }),
    [artifactType, note, relatedQuestions],
  );
  const linkedCardCount = flashcards.filter((card) => card.notionPageId === note.id).length;
  const linkedGeneratedQuestionCount = questions.filter((question) => question.notionPageId === note.id).length;

  useEffect(() => {
    setPrompt(generatedPrompt);
    setPromptMessage('');
    setRawJson('');
    setDraftState({ items: [], errors: [], total: 0 });
    setSelectedDrafts({});
    setImportMessage('');
  }, [artifactType, generatedPrompt, note.id]);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setPromptMessage('已複製 source-grounded prompt，可以貼到 ChatGPT。');
    } catch {
      setPromptMessage('瀏覽器無法自動複製，請手動選取 prompt。');
    }
  };

  const validateDrafts = () => {
    try {
      const parsed = parseNotionLearningDrafts(rawJson, artifactType, note, relatedQuestions);
      const marked = markLearningDraftDuplicates(parsed.items, flashcards, questions);
      setDraftState({ ...parsed, items: marked });
      setSelectedDrafts(Object.fromEntries(marked.map((item) => [item.draftId, !item.duplicate])));
      setImportMessage(marked.length
        ? `已驗證 ${marked.length} 項；${marked.filter((item) => item.duplicate).length} 項重複，預設不匯入。`
        : '沒有可匯入的有效草稿。');
    } catch (error) {
      setDraftState({ items: [], errors: [error.message || 'JSON 格式錯誤。'], total: 0 });
      setSelectedDrafts({});
      setImportMessage('驗證失敗，尚未更動 Tracker。');
    }
  };

  const selectedItems = draftState.items.filter((item) => selectedDrafts[item.draftId] && !item.duplicate);
  const approveDrafts = () => {
    if (!selectedItems.length) return;
    const result = onImportLearningDrafts({ artifactType, note, items: selectedItems });
    setImportMessage(result.message);
    if (result.ok) {
      setRawJson('');
      setDraftState({ items: [], errors: [], total: 0 });
      setSelectedDrafts({});
    }
  };

  return (
    <section className="notion-learning-studio" aria-label="Notion learning draft studio">
      <div className="section-head">
        <div>
          <div className="knowledge-kicker">Phase 3 · Learning Draft Studio</div>
          <h3>把筆記轉成可審核的學習單位</h3>
          <p className="muted">先產生 prompt，再驗證與去重；只有按下核准後才加入 Tracker。全程不回寫 Notion。</p>
        </div>
        <div className="knowledge-chip-row">
          <span className="pill soft">{relatedRows.length} related questions</span>
          <span className="pill soft">{linkedCardCount} linked cards</span>
          <span className="pill soft">{linkedGeneratedQuestionCount} generated quizzes</span>
        </div>
      </div>

      <div className="notion-learning-context">
        <div>
          <strong>Auto mapping</strong>
          <span>{learningContext.cancer} · {learningContext.trials.join(', ') || 'No trial detected'}</span>
        </div>
        <div className="knowledge-chip-row">
          {learningContext.autoTags.slice(0, 12).map((tag) => <span className="knowledge-tag" key={tag}>#{tag}</span>)}
        </div>
      </div>

      {relatedRows.length > 0 && (
        <div className="notion-related-questions">
          <strong>Related existing questions</strong>
          <div>
            {relatedRows.slice(0, 8).map(({ question, score }) => (
              <button type="button" key={question.id} onClick={() => onOpenQuestion(question)}>
                <b>{question.id}</b>
                <span>{question.topic}</span>
                <em>match {score}</em>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="notion-artifact-tabs" role="group" aria-label="Learning artifact type">
        {NOTION_LEARNING_ARTIFACTS.map((artifact) => (
          <button
            type="button"
            className={artifactType === artifact.id ? 'active' : 'secondary'}
            onClick={() => setArtifactType(artifact.id)}
            key={artifact.id}
          >
            {artifact.label}
            <small>→ {artifact.target}</small>
          </button>
        ))}
      </div>

      <div className="notion-learning-workflow">
        <section>
          <div className="notion-learning-step"><span>1</span><strong>Generate prompt</strong></div>
          <textarea className="prompt-box" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          <div className="inline-actions">
            <button type="button" className="primary" onClick={copyPrompt}>複製 Prompt</button>
            <button type="button" className="secondary" onClick={() => setPrompt(generatedPrompt)}>重設 Prompt</button>
          </div>
          {promptMessage && <p className="save-message">{promptMessage}</p>}
        </section>

        <section>
          <div className="notion-learning-step"><span>2</span><strong>Paste and validate JSON</strong></div>
          <textarea
            value={rawJson}
            onChange={(event) => setRawJson(event.target.value)}
            placeholder="貼上 ChatGPT 回傳的 JSON array。尚未核准前不會寫入任何學習紀錄。"
          />
          <button type="button" className="secondary" onClick={validateDrafts} disabled={!rawJson.trim()}>驗證草稿</button>
        </section>
      </div>

      {(draftState.items.length > 0 || draftState.errors.length > 0) && (
        <section className="notion-draft-review">
          <div className="notion-learning-step"><span>3</span><strong>Review and approve</strong></div>
          {draftState.errors.length > 0 && (
            <ul className="notion-draft-errors">
              {draftState.errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          )}
          <div className="notion-draft-list">
            {draftState.items.map((item) => (
              <label className={item.duplicate ? 'notion-draft-card duplicate' : 'notion-draft-card'} key={item.draftId}>
                <input
                  type="checkbox"
                  checked={Boolean(selectedDrafts[item.draftId])}
                  disabled={item.duplicate}
                  onChange={(event) => setSelectedDrafts((prev) => ({ ...prev, [item.draftId]: event.target.checked }))}
                />
                <span>
                  <small>{item.kind === 'question' ? 'Quiz question' : item.type}{item.duplicate ? ' · Duplicate' : ''}</small>
                  <strong>{item.kind === 'question' ? item.stem : item.front}</strong>
                  <em>Evidence: {item.sourceEvidence}</em>
                </span>
              </label>
            ))}
          </div>
          <div className="inline-actions">
            <button type="button" className="primary" disabled={!selectedItems.length} onClick={approveDrafts}>
              核准並加入 {selectedItems.length} 項
            </button>
            <span className="muted">重複項目永遠不會匯入。</span>
          </div>
        </section>
      )}
      {importMessage && <p className="notion-library-message">{importMessage}</p>}
    </section>
  );
}

function NotionPreviewPanel({ preview, onClose, onOpenInternalPage, readerRef }) {
  const sections = preview?.item ? buildNotionNoteSections(preview.item) : EMPTY_ARRAY;
  if (!preview?.id) return null;
  const note = preview.item;
  const jumpToSection = (event, index) => {
    const panel = event.currentTarget.closest('.notion-preview-panel');
    panel?.querySelector(`[data-note-section="${index}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <section ref={readerRef} className="notion-preview-panel" aria-label="Fellow training note preview">
      <div className="notion-reader-head">
        <div>
          <div className="knowledge-kicker">Fellow training · Read-only</div>
          <h3>{note?.title || preview.title || 'Loading note...'}</h3>
          <div className="knowledge-chip-row">
            {note && <span className="pill soft">{inferNotionNoteType(note)}</span>}
            {(note?.cancerTypes || []).slice(0, 2).map((value) => <span className="knowledge-tag" key={value}>{value}</span>)}
            {(note?.genes || []).slice(0, 3).map((value) => <span className="knowledge-tag" key={value}>{value}</span>)}
          </div>
        </div>
        <div className="notion-reader-actions">
          {note?.url && <a className="notion-edit-link" href={note.url} target="_blank" rel="noreferrer">前往 Notion 編輯 <ExternalLink size={14} /></a>}
          <button type="button" className="secondary tiny" onClick={onClose}>關閉閱讀</button>
        </div>
      </div>
      {preview.status === 'loading' && <p className="notion-preview-status">正在載入筆記內容…</p>}
      {preview.status === 'error' && <p className="notion-preview-status error">{preview.error}</p>}
      {preview.status === 'ready' && preview.error && <p className="notion-preview-status">{preview.error}</p>}
      {preview.status === 'ready' && note && (
        <>
          <div className="notion-preview-layout">
            <aside className="notion-reader-toc">
              <strong>章節目錄</strong>
              {sections.length > 1 ? (
                <nav aria-label="筆記章節">
                  {sections.slice(0, 30).map((section, index) => (
                    <button
                      type="button"
                      className={`level-${section.level}`}
                      onClick={(event) => jumpToSection(event, index)}
                      key={`${section.id}-${index}`}
                    >
                      {section.title}
                    </button>
                  ))}
                </nav>
              ) : <p className="muted">這篇筆記沒有 heading。</p>}
              <small>Updated {formatLibrarySyncTime(note.lastEditedTime || note.createdTime)}</small>
            </aside>
            <article className="notion-preview-copy">
              {note.blocks?.length ? (
                <NotionBlocks blocks={note.blocks} onOpenNotionPage={onOpenInternalPage} />
              ) : sections.length ? sections.map((section, index) => (
                <section
                  className={`notion-note-section level-${section.level}`}
                  data-note-section={index}
                  key={`${section.id}-${index}`}
                >
                  {index === 0 && section.title === note.title
                    ? <h1>{section.title}</h1>
                    : section.level <= 2 ? <h2>{section.title}</h2> : <h3>{section.title}</h3>}
                  {section.body && <div>{section.body}</div>}
                </section>
              )) : <p>這篇筆記目前沒有可顯示的內容。</p>}
              {note.truncated && <p className="notion-preview-truncated">筆記超過安全讀取上限；請前往 Notion 查看其餘內容。</p>}
            </article>
          </div>
        </>
      )}
    </section>
  );
}

function KnowledgeHubPanel({
  topics,
  flashcards,
  planTasks,
  defaultTaskId,
  libraryState,
  notePreview,
  onOpenQuestion,
  onSyncLibrary,
  onOpenNotePreview,
  onCloseNotePreview,
  onOpenCards,
  onOpenPlan,
  onOpenReview,
}) {
  const [cancerFilter, setCancerFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [hubView, setHubView] = useState('today');
  const [selectedTaskId, setSelectedTaskId] = useState(defaultTaskId || 1);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryCancer, setLibraryCancer] = useState('All');
  const [libraryGene, setLibraryGene] = useState('All');
  const [libraryFlashcard, setLibraryFlashcard] = useState('All');
  const [libraryType, setLibraryType] = useState('All');
  const [librarySort, setLibrarySort] = useState('updated');
  const [libraryView, setLibraryView] = useState('grid');
  const readerRef = useRef(null);
  const isReading = Boolean(notePreview?.id);
  const normalizedQuery = query.trim().toLowerCase();
  const coreTopics = useMemo(
    () => topics.filter((topic) => KNOWLEDGE_CANCER_DOMAINS.has(topic.cancer)),
    [topics],
  );
  const programTopicCount = topics.length - coreTopics.length;
  const cancers = [...new Set(coreTopics.map((topic) => topic.cancer))];
  const selectedTopic = coreTopics.find((topic) => topic.id === selectedTopicId) || null;
  const libraryItems = libraryState.items;
  const selectedTask = getStudyPlanTaskById(selectedTaskId) || planTasks[0];
  const todayCriteria = useMemo(() => getNotionNewsCriteriaForTask(selectedTask), [selectedTask]);
  const todayRankedItems = useMemo(
    () => rankNotionNewsItems(libraryItems, todayCriteria),
    [libraryItems, todayCriteria],
  );
  const todayMatchedItems = todayRankedItems.filter(hasCriteriaMatches);
  const todayItems = (todayMatchedItems.length ? todayMatchedItems : todayRankedItems).slice(0, 12);
  const topicNoteIndex = useMemo(() => new Map(coreTopics.map((topic) => [
    topic.id,
    getLinkedNotionNotes(libraryItems, topic),
  ])), [coreTopics, libraryItems]);
  const filteredTopics = coreTopics.filter((topic) => (
    (cancerFilter === 'All' || topic.cancer === cancerFilter)
    && (!normalizedQuery
      || topic.searchText.includes(normalizedQuery)
      || (topicNoteIndex.get(topic.id) || []).some((note) => note.searchText.includes(normalizedQuery)))
  ));
  const selectedTopicNotes = useMemo(() => {
    if (!selectedTopic) return EMPTY_ARRAY;
    return [...new Map([
      ...(topicNoteIndex.get(selectedTopic.id) || []),
      ...selectedTopic.notionNotes.map((note) => ({
        ...note,
        id: note.url,
        source: 'Question link',
        cancerTypes: [selectedTopic.cancer],
        genes: [],
        tags: [],
        flashcardCreated: false,
      })),
    ].map((note) => [note.url, note])).values()];
  }, [selectedTopic, topicNoteIndex]);
  const linkedNoteCount = new Set([
    ...libraryItems.map((note) => note.url),
    ...coreTopics.flatMap((topic) => topic.notionNotes.map((note) => note.url)),
  ]).size;
  const linkedQuestionCount = new Set(coreTopics.flatMap((topic) => topic.questionRows.map(({ question }) => question.id))).size;
  const cardLinkSummary = useMemo(() => {
    const cardsById = new Map(flashcards.map((card) => [card.id, card]));
    const linkedIds = new Set(coreTopics.flatMap((topic) => topic.cards.map((card) => card.id)));
    let unclassified = 0;
    let outsidePlan = 0;

    cardsById.forEach((card, cardId) => {
      if (linkedIds.has(cardId)) return;
      if (KNOWLEDGE_CANCER_DOMAINS.has(getKnowledgeCardCancerDomain(card))) {
        outsidePlan += 1;
      } else {
        unclassified += 1;
      }
    });

    return {
      total: cardsById.size,
      linked: linkedIds.size,
      unclassified,
      outsidePlan,
    };
  }, [coreTopics, flashcards]);
  const libraryCancerOptions = [...new Set(libraryItems.flatMap((note) => note.cancerTypes))].sort();
  const libraryGeneOptions = [...new Set(libraryItems.flatMap((note) => note.genes))].sort();
  const filteredLibraryItems = sortNotionLibrary(filterNotionLibrary(libraryItems, {
    query: libraryQuery,
    cancer: libraryCancer,
    gene: libraryGene,
    flashcard: libraryFlashcard,
    type: libraryType,
  }), librarySort);
  const libraryTypes = [...new Set(libraryItems.map(inferNotionNoteType))].sort();
  const hasLibraryFilters = Boolean(libraryQuery.trim()
    || libraryCancer !== 'All'
    || libraryGene !== 'All'
    || libraryFlashcard !== 'All'
    || libraryType !== 'All');
  const clearLibraryFilters = () => {
    setLibraryQuery('');
    setLibraryCancer('All');
    setLibraryGene('All');
    setLibraryFlashcard('All');
    setLibraryType('All');
  };
  const openNoteReader = (note) => onOpenNotePreview(note);
  const changeHubView = (view) => {
    if (isReading) onCloseNotePreview();
    setHubView(view);
  };
  const openInternalNotionPage = (pageId) => {
    const normalizedId = String(pageId || '').replaceAll('-', '').toLowerCase();
    const item = libraryItems.find((note) => String(note.id || '').replaceAll('-', '').toLowerCase() === normalizedId);
    if (item) openNoteReader(item);
  };
  useEffect(() => {
    if (defaultTaskId) setSelectedTaskId(defaultTaskId);
  }, [defaultTaskId]);
  const notionCardCounts = useMemo(() => {
    const counts = new Map();
    flashcards.forEach((card) => {
      if (!card.notionPageId) return;
      counts.set(card.notionPageId, (counts.get(card.notionPageId) || 0) + 1);
    });
    return counts;
  }, [flashcards]);

  useEffect(() => {
    if (selectedTopicId && !coreTopics.some((topic) => topic.id === selectedTopicId)) {
      setSelectedTopicId('');
    }
  }, [coreTopics, selectedTopicId]);

  useEffect(() => {
    if (!isReading) return;
    const frame = window.requestAnimationFrame(() => {
      readerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isReading, notePreview?.id]);

  if (selectedTopic) {
    if (isReading) {
      return (
        <main className="panel knowledge-hub-panel">
          <NotionPreviewPanel
            preview={notePreview}
            onClose={onCloseNotePreview}
            onOpenInternalPage={openInternalNotionPage}
            readerRef={readerRef}
          />
        </main>
      );
    }
    return (
      <main className="panel knowledge-hub-panel">
        <button className="knowledge-back" type="button" onClick={() => setSelectedTopicId('')}>← 回到 Knowledge Hub</button>

        <section className="knowledge-detail-hero">
          <div>
            <div className="knowledge-kicker">{selectedTopic.cancer} · {selectedTopic.task.day}</div>
            <h2>{selectedTopic.title}</h2>
            <p>{selectedTopic.details}</p>
            <div className="knowledge-chip-row">
              <span className={`knowledge-status ${selectedTopic.status.toLowerCase().replaceAll(' ', '-')}`}>{selectedTopic.status}</span>
              <span className="pill soft">Plan {selectedTopic.completed ? 'completed' : 'in progress'}</span>
              <span className="pill soft">Weight {selectedTopic.highYieldWeight}</span>
            </div>
          </div>
          <div className="knowledge-detail-actions">
            <button className="primary" type="button" onClick={onOpenPlan}>Open 100-Day Plan</button>
            {selectedTopic.dueCount > 0 && <button className="secondary" type="button" onClick={onOpenReview}>Review due items</button>}
          </div>
        </section>

        <section className="knowledge-metrics">
          <MetricCard label="Related questions" value={selectedTopic.questionRows.length} sub={`${selectedTopic.coverage}% coverage`} />
          <MetricCard label="Accuracy" value={`${selectedTopic.accuracy}%`} sub={`${selectedTopic.attempts} attempts`} />
          <MetricCard label="Flashcards" value={selectedTopic.cards.length} sub={`${selectedTopic.dueCards.length} due`} />
          <MetricCard label="Critical errors" value={selectedTopic.criticalQuestions.length} sub={`${selectedTopic.dueQuestions.length} questions due`} />
        </section>

        <div className="knowledge-detail-grid">
          <section className="subsection knowledge-section">
            <div className="section-head">
              <div>
                <h3>Decision focus</h3>
                <p className="muted">這個 topic 在 100-Day Plan 的穩定學習範圍。</p>
              </div>
            </div>
            <div className="knowledge-chip-row">
              {selectedTopic.focusTags.map((tag) => <span className="knowledge-tag" key={tag}>#{tag}</span>)}
            </div>
          </section>

          <section className="subsection knowledge-section">
            <div className="section-head">
              <div>
                <h3>Trials</h3>
                <p className="muted">Plan、題目與卡片中出現的相關 trial。</p>
              </div>
              <span className="pill soft">{selectedTopic.trials.length}</span>
            </div>
            {selectedTopic.trials.length ? (
              <div className="knowledge-chip-row">
                {selectedTopic.trials.map((trial) => <span className="knowledge-trial" key={trial}>{trial}</span>)}
              </div>
            ) : <p className="muted">目前沒有已連結的 trial。</p>}
          </section>
        </div>

        <section className="subsection knowledge-section">
          <div className="section-head">
            <div>
              <h3>Related questions</h3>
              <p className="muted">由 cancer、topic、trial 與 focus tags 自動聚合；不會改動題庫內容。</p>
            </div>
            <span className="pill soft">{selectedTopic.questionRows.length}</span>
          </div>
          {selectedTopic.questionRows.length ? (
            <div className="knowledge-resource-list">
              {selectedTopic.questionRows.slice(0, 24).map(({ question, stat }) => (
                <button className="knowledge-resource-row" type="button" key={question.id} onClick={() => onOpenQuestion(question)}>
                  <span>
                    <strong>{question.id}</strong>
                    <small>{question.cancer} · {question.topic}</small>
                  </span>
                  <span className="knowledge-resource-copy">{question.stem}</span>
                  <span className="knowledge-resource-stat">{stat.attempts || 0} attempts · {wrongRate(stat)}% wrong</span>
                </button>
              ))}
            </div>
          ) : <p className="muted">目前題庫中沒有足夠明確的相關題目。</p>}
        </section>

        <div className="knowledge-detail-grid">
          <section className="subsection knowledge-section">
            <div className="section-head">
              <div>
                <h3>Flashcards</h3>
                <p className="muted">與此 topic 關聯的現有卡片。</p>
              </div>
              <button className="secondary tiny" type="button" onClick={onOpenCards}>Open Card Manager</button>
            </div>
            {selectedTopic.cards.length ? (
              <div className="knowledge-card-list">
                {selectedTopic.cards.slice(0, 10).map((card) => (
                  <article key={card.id}>
                    <span className="pill soft">{card.type}</span>
                    <strong>{getFlashcardFrontText(card)}</strong>
                  </article>
                ))}
              </div>
            ) : <p className="muted">目前沒有已連結的卡片。</p>}
          </section>

          <section className="subsection knowledge-section">
            <div className="section-head">
              <div>
                <h3>Critical errors</h3>
                <p className="muted">高信心錯題、連續錯題或累積錯誤。</p>
              </div>
              {selectedTopic.criticalQuestions.length > 0 && <button className="secondary tiny" type="button" onClick={onOpenReview}>Open Review</button>}
            </div>
            {selectedTopic.criticalQuestions.length ? (
              <div className="knowledge-error-list">
                {selectedTopic.criticalQuestions.slice(0, 8).map(({ question, stat }) => (
                  <button type="button" key={question.id} onClick={() => onOpenQuestion(question)}>
                    <strong>{question.id}</strong>
                    <span>{stat.lastErrorType || 'Unclassified error'}</span>
                    <em>{stat.highConfidenceWrong || 0} high-confidence · {stat.repeatedWrong || 0} repeated</em>
                  </button>
                ))}
              </div>
            ) : <p className="muted">此 topic 目前沒有 critical error。</p>}
          </section>
        </div>

        <section className="subsection knowledge-section linked-note-section">
          <div className="section-head">
            <div>
              <h3>Linked Fellow training notes</h3>
              <p className="muted">依 Cancer type、Gene tag、trial 與 topic 自動建立唯讀關聯；原始筆記仍以 Notion 為準。</p>
            </div>
            <span className="pill soft">{selectedTopicNotes.length}</span>
          </div>
          {selectedTopicNotes.length ? (
            <div className="linked-note-grid">
              {selectedTopicNotes.map((note) => (
                <NotionLibraryCard
                  note={note}
                  onPreview={openNoteReader}
                  localCardCount={notionCardCounts.get(note.id) || 0}
                  compact
                  key={note.url}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state small">
              <h3>尚未連結 Fellow training note</h3>
              <p>目前資料庫中沒有足夠明確的 Cancer／Gene／Trial metadata 可安全連到此 topic。</p>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="panel knowledge-hub-panel">
      <section className="knowledge-hub-hero">
        <div>
          <div className="knowledge-kicker">Oncology Knowledge Hub</div>
          <h2>{hubView === 'topics' ? '從主題進入所有學習資源' : 'Notion 筆記，集中閱讀'}</h2>
          <p>{hubView !== 'topics'
            ? '在 Tracker 搜尋與閱讀 Fellow training；需要修改時直接回到 Notion，維持唯一筆記來源。'
            : '以 100-Day Plan 為骨架，唯讀聚合 Questions、Trials、Flashcards、Critical Errors 與 Fellow training。'}</p>
        </div>
        <div className="knowledge-hub-summary">
          <strong>{coreTopics.length}</strong><span>clinical topics</span>
          <strong>{linkedQuestionCount}</strong><span>questions linked</span>
          <strong>{cardLinkSummary.total}</strong><span>cards total</span>
          <strong>{cardLinkSummary.linked}</strong><span>cards linked</span>
          <strong>{cardLinkSummary.unclassified}</strong><span>cards unclassified</span>
          <strong>{cardLinkSummary.outsidePlan}</strong><span>outside-plan cards</span>
          <strong>{linkedNoteCount}</strong><span>Fellow notes</span>
        </div>
      </section>

      <nav className="knowledge-view-tabs" aria-label="Knowledge 顯示模式">
        <button type="button" className={hubView === 'today' ? 'active' : ''} onClick={() => changeHubView('today')}>
          <BookOpen size={17} />
          今日推薦
        </button>
        <button type="button" className={hubView === 'notes' ? 'active' : ''} onClick={() => changeHubView('notes')}>
          <FileText size={17} />
          筆記庫
        </button>
        <button type="button" className={hubView === 'topics' ? 'active' : ''} onClick={() => changeHubView('topics')}>
          <LayoutGrid size={17} />
          主題地圖
        </button>
      </nav>

      {isReading && <NotionPreviewPanel
        preview={notePreview}
        onClose={onCloseNotePreview}
        onOpenInternalPage={openInternalNotionPage}
        readerRef={readerRef}
      />}

      {hubView === 'today' && !isReading && (
        <section className="notion-library-section notion-today-section">
          <div className="section-head">
            <div>
              <div className="knowledge-kicker">Today · 100-Day Plan</div>
              <h3>{selectedTask?.day} · {selectedTask?.topic}</h3>
              <p className="muted">{selectedTask?.details}</p>
            </div>
            <label className="notion-day-picker">
              <span>選擇讀書日</span>
              <select value={selectedTask ? getPlanTaskStorageId(selectedTask) : ''} onChange={(event) => setSelectedTaskId(event.target.value)}>
                {planTasks.map((task) => (
                  <option key={getPlanTaskStorageId(task)} value={getPlanTaskStorageId(task)}>{task.day} · {task.topic}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="notion-library-count">
            <strong>{todayItems.length}</strong>
            <span>篇依今日主題、癌別、治療與藥物排序的筆記</span>
          </div>
          {todayItems.length ? (
            <div className="notion-library-grid">
              {todayItems.map((note) => (
                <NotionLibraryCard
                  note={note}
                  onPreview={openNoteReader}
                  localCardCount={notionCardCounts.get(note.id) || 0}
                  key={note.id}
                />
              ))}
            </div>
          ) : <div className="empty-state small"><h3>今天尚無匹配筆記</h3><p>同步 Notion Library 後再試一次。</p></div>}
        </section>
      )}

      {hubView === 'topics' && !isReading && <><section className="knowledge-toolbar">
        <label>
          Search Knowledge
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Trial、biomarker、topic、question ID..." />
        </label>
        <label>
          Cancer
          <select value={cancerFilter} onChange={(event) => setCancerFilter(event.target.value)}>
            <option value="All">All cancers</option>
            {cancers.map((cancer) => <option value={cancer} key={cancer}>{cancer}</option>)}
          </select>
        </label>
      </section>

      <section className="knowledge-cancer-overview">
        {cancers.map((cancer) => {
          const cancerTopics = coreTopics.filter((topic) => topic.cancer === cancer);
          const active = cancerFilter === cancer;
          return (
            <button type="button" className={active ? 'active' : ''} key={cancer} onClick={() => setCancerFilter(active ? 'All' : cancer)}>
              <span>{cancer}</span>
              <strong>{cancerTopics.filter((topic) => topic.completed).length}/{cancerTopics.length}</strong>
              <small>plan topics complete</small>
            </button>
          );
        })}
      </section>

      <section className="knowledge-topic-section">
        <div className="section-head">
          <div>
            <h3>{cancerFilter === 'All' ? 'All topics' : cancerFilter}</h3>
            <p className="muted">顯示 {filteredTopics.length} 個 topic；點擊後進入聚合頁面。</p>
          </div>
          {programTopicCount > 0 && (
            <p className="knowledge-program-note">Mock、Weakness Repair 與 Final Review 等 {programTopicCount} 個訓練日仍保留在 100-Day Plan，不列為臨床知識主題。</p>
          )}
        </div>
        {filteredTopics.length ? (
          <div className="knowledge-topic-grid">
            {filteredTopics.map((topic) => (
              <button className="knowledge-topic-card" type="button" key={topic.id} onClick={() => setSelectedTopicId(topic.id)}>
                <div>
                  <span className="pill">{topic.cancer}</span>
                  <span className={`knowledge-status ${topic.status.toLowerCase().replaceAll(' ', '-')}`}>{topic.status}</span>
                </div>
                <strong>{topic.title}</strong>
                <p>{topic.details}</p>
                <div className="knowledge-topic-stats">
                  <span><b>{topic.questionRows.length}</b> questions</span>
                  <span><b>{topic.cards.length}</b> cards</span>
                  <span><b>{topic.trials.length}</b> trials</span>
                  <span><b>{topic.dueCount}</b> due</span>
                </div>
                <footer>
                  <span>{topic.coverage}% coverage · {topic.accuracy}% accuracy · {(topicNoteIndex.get(topic.id) || []).length} notes</span>
                  <b>Open topic →</b>
                </footer>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>找不到符合條件的 topic</h3>
            <p>請清除搜尋字詞或切換 Cancer 篩選。</p>
          </div>
        )}
      </section>
      </>}

      {hubView === 'notes' && !isReading && <section className="notion-library-section">
        <div className="section-head">
          <div>
            <div className="knowledge-kicker">Fellow Training Notes</div>
            <h3>所有筆記</h3>
            <p className="muted">搜尋、篩選並閱讀腫瘤筆記；Notion 保持為原始資料來源，Tracker 僅做唯讀整理。</p>
          </div>
          <div className="notion-library-sync">
            <span className={`notion-sync-status ${libraryState.status}`}>{libraryState.source === 'live' ? 'Live index' : 'Cached index'}</span>
            <small>Last sync {formatLibrarySyncTime(libraryState.fetchedAt)}</small>
            <button type="button" className="secondary" disabled={libraryState.status === 'loading'} onClick={onSyncLibrary}>
              <RefreshCw size={15} className={libraryState.status === 'loading' ? 'spin' : ''} />
              {libraryState.status === 'loading' ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
        </div>

        {libraryState.error && <p className="notion-library-message error">{libraryState.error}</p>}
        {libraryState.truncated && <p className="notion-library-message">Notion 回傳頁數超過安全上限；目前顯示最近更新的 {libraryItems.length} 篇。</p>}

        <div className="notion-library-toolbox">
          <label className="notion-library-search">
            <span>搜尋筆記</span>
            <input type="search" value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="Title、trial、drug、keyword…" />
          </label>
          <div className="notion-library-view" role="group" aria-label="筆記顯示方式">
            <button type="button" className={libraryView === 'grid' ? 'active' : ''} onClick={() => setLibraryView('grid')} aria-label="卡片檢視"><LayoutGrid size={17} /></button>
            <button type="button" className={libraryView === 'list' ? 'active' : ''} onClick={() => setLibraryView('list')} aria-label="清單檢視"><List size={18} /></button>
          </div>
        </div>

        <div className="notion-library-filters">
          <select aria-label="Cancer type" value={libraryCancer} onChange={(event) => setLibraryCancer(event.target.value)}>
            <option value="All">所有 Cancer types</option>
            {libraryCancerOptions.map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
          <select aria-label="Note type" value={libraryType} onChange={(event) => setLibraryType(event.target.value)}>
            <option value="All">所有筆記類型</option>
            {libraryTypes.map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
          <select aria-label="Gene tag" value={libraryGene} onChange={(event) => setLibraryGene(event.target.value)}>
            <option value="All">所有 Gene tags</option>
            {libraryGeneOptions.map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
          <select aria-label="Flashcard status" value={libraryFlashcard} onChange={(event) => setLibraryFlashcard(event.target.value)}>
            <option value="All">所有卡片狀態</option>
            <option value="Ready">已有 Flashcards</option>
            <option value="Missing">尚未製卡</option>
          </select>
          <select aria-label="Sort notes" value={librarySort} onChange={(event) => setLibrarySort(event.target.value)}>
            <option value="updated">最近更新</option>
            <option value="title">標題 A–Z</option>
            <option value="needs-cards">優先顯示未製卡</option>
          </select>
          {hasLibraryFilters && <button type="button" className="secondary tiny" onClick={clearLibraryFilters}>清除篩選</button>}
        </div>

        <div className="notion-library-count">
          <FileText size={16} />
          <strong>{filteredLibraryItems.length}</strong> of {libraryItems.length} notes
          <span>·</span>
          <strong>{libraryItems.filter((note) => note.flashcardCreated).length}</strong> marked Flashcard ready
        </div>

        {filteredLibraryItems.length ? (
          <div className={`notion-library-grid ${libraryView}`}>
            {filteredLibraryItems.slice(0, 60).map((note) => (
              <NotionLibraryCard
                note={note}
                onPreview={openNoteReader}
                localCardCount={notionCardCounts.get(note.id) || 0}
                key={note.id}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state small">
            <h3>找不到符合條件的 Fellow training note</h3>
            <p>請清除搜尋字詞，或調整 Cancer type、筆記類型、Gene tag 與 Flashcard 篩選。</p>
            {hasLibraryFilters && <button type="button" className="secondary" onClick={clearLibraryFilters}>清除所有篩選</button>}
          </div>
        )}
      </section>
      }
    </main>
  );
}

function FlashcardsPanel({
  state,
  allFlashcards,
  dueFlashcards,
  weakQuestions,
  onCreateTrialCard,
  onImportFlashcards,
  onUpdateCard,
  onDeleteCard,
  onOpenReview,
}) {
  const [trialName, setTrialName] = useState('');
  const [importJson, setImportJson] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [cardPrompt, setCardPrompt] = useState('');
  const [cardPromptMessage, setCardPromptMessage] = useState('');
  const [cardSearch, setCardSearch] = useState('');
  const [selectedCardId, setSelectedCardId] = useState('');
  const [editDraft, setEditDraft] = useState(() => makeFlashcardEditDraft({}));
  const trialCards = allFlashcards.filter((card) => card.sourceType === 'trial' || card.type === 'Trial Card');
  const weakCards = allFlashcards.filter((card) => (card.mastery || 0) <= 2);
  const managerCards = [...new Map(allFlashcards.map((card) => [getFlashcardEditId(card), card])).values()];
  const normalizedSearch = cardSearch.trim().toLowerCase();
  const filteredCards = managerCards.filter((card) => {
    if (!normalizedSearch) return true;
    return [getFlashcardFrontText(card), card.topic, card.cancer, ...normalizeTextList(card.trial), ...normalizeTextList(card.tags)]
      .some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
  });
  const selectedCard = managerCards.find((card) => getFlashcardEditId(card) === selectedCardId) || null;

  useEffect(() => {
    if (selectedCardId && !selectedCard) {
      setSelectedCardId('');
      setEditDraft(makeFlashcardEditDraft({}));
    }
  }, [selectedCardId, selectedCard]);

  const selectCardForEditing = (card) => {
    setSelectedCardId(getFlashcardEditId(card));
    setEditDraft(makeFlashcardEditDraft(card));
  };

  const saveCardEdit = () => {
    if (!selectedCard) return;
    onUpdateCard(selectedCardId, {
      front: editDraft.front,
      back: editDraft.back,
      type: editDraft.type,
      cancer: editDraft.cancer,
      topic: editDraft.topic,
      trial: splitEditableList(editDraft.trial),
      tags: splitEditableList(editDraft.tags),
      examValue: normalizeExamValue(editDraft.examValue),
      errorType: normalizeFlashcardErrorType(editDraft.errorType),
    });
  };

  const deleteSelectedCard = () => {
    if (!selectedCard || !window.confirm('確定要刪除這張 card？刪除後也會移除它的複習紀錄。')) return;
    onDeleteCard(selectedCardId);
    setSelectedCardId('');
    setEditDraft(makeFlashcardEditDraft({}));
  };

  const submitTrialCard = () => {
    onCreateTrialCard(trialName);
    setTrialName('');
  };

  const submitImport = () => {
    const result = onImportFlashcards(importJson);
    setImportMessage(result.message);
    if (result.ok) setImportJson('');
  };

  const copyCardPrompt = async () => {
    if (!cardPrompt) return;
    try {
      await navigator.clipboard.writeText(cardPrompt);
      setCardPromptMessage('已複製 prompt，可以貼到 ChatGPT。');
    } catch {
      setCardPromptMessage('瀏覽器無法自動複製，請手動選取 prompt 複製。');
    }
  };

  const buildAiCardPromptFromWeakQuestions = () => {
    const promptSourceQuestions = getQuestionPool(state)
      .map((q) => getQuestionWithOverride(q.id, state))
      .filter(Boolean)
      .map((q) => ({ q, stat: getStat(state, q.id) }))
      .filter(({ stat }) => (
        stat.wrong > 0 ||
        stat.bookmarked ||
        (stat.nextReviewDate && stat.nextReviewDate <= TODAY) ||
        (stat.highConfidenceWrong || 0) > 0 ||
        stat.mastery <= 2
      ))
      .sort((a, b) => {
        const aScore =
          (a.stat.nextReviewDate && a.stat.nextReviewDate <= TODAY ? 100 : 0) +
          a.stat.wrong * 10 +
          (a.stat.bookmarked ? 20 : 0) +
          (a.stat.highConfidenceWrong || 0) * 15 +
          (2 - Math.min(a.stat.mastery || 0, 2)) * 5;

        const bScore =
          (b.stat.nextReviewDate && b.stat.nextReviewDate <= TODAY ? 100 : 0) +
          b.stat.wrong * 10 +
          (b.stat.bookmarked ? 20 : 0) +
          (b.stat.highConfidenceWrong || 0) * 15 +
          (2 - Math.min(b.stat.mastery || 0, 2)) * 5;

        return bScore - aScore;
      })
      .slice(0, 12);

    const sourceText = promptSourceQuestions
      .map(({ q, stat }, index) => {
        const optionsText = Object.entries(q.options || {})
          .map(([key, value]) => `(${key}) ${value}`)
          .join('\n');

        const errorType = stat.lastErrorType || stat.errorTypes?.[stat.errorTypes.length - 1] || 'none';
        const remediation = errorType !== 'none' ? getRemediationForErrorType(errorType) : null;

        return `
[${index + 1}] ${q.id}
Cancer: ${q.cancer || ''}
Topic: ${q.topic || ''}
Year: ${q.year || ''}
Trials: ${(q.trials || []).join(', ') || 'none'}
Attempts: ${stat.attempts}
Wrong: ${stat.wrong}
Wrong rate: ${wrongRate(stat)}%
Mastery: ${stat.mastery}
Bookmarked: ${stat.bookmarked ? 'yes' : 'no'}
Last error type: ${errorType}
Correction focus: ${remediation?.task || 'none'}
Correction action: ${remediation?.action || 'none'}
Optional card type if this becomes a card later: ${remediation?.cardType || 'none'}

Stem:
${q.stem || ''}

Options:
${optionsText}

Correct answer:
${q.answer || stat.correctAnswer || ''}

Explanation:
${q.explanation || stat.explanation || ''}

User wrong note:
${stat.wrongNotes || ''}
`;
      })
      .join('\n\n---\n\n');

    const prompt = `
你是一位 hematology-oncology board exam coach。請根據以下錯題與 due questions 資料，產生高分導向 flashcards。

請只輸出 JSON array，不要加 markdown，不要加說明文字。

${FLASHCARD_SCHEMA_PROMPT}

請優先抽出可轉移的 decision rule，不要把「題目放正面、選項放背面」。每題產生 2–4 張卡，必須只在 Trial Card / Algorithm Card / Cloze Card / Trap Card 四種新版卡中選 type。若來源資料有 Optional card type，至少產生一張該 type 的卡；其餘再依內容補 pivotal trial、treatment sequencing、cutoff/duration/endpoint、常見錯選項。

以下是錯題與 due questions 來源資料：

${sourceText || '目前沒有符合條件的錯題或 due questions。'}
`.trim();

    setCardPrompt(prompt);
    setCardPromptMessage(`已產生 ${promptSourceQuestions.length} 題 due / weak questions 的 AI card prompt。`);
  };

  const buildTrialCardPromptFromWeakQuestions = () => {
    const trialSourceQuestions = getQuestionPool(state)
      .map((q) => getQuestionWithOverride(q.id, state))
      .filter(Boolean)
      .map((q) => ({ q, stat: getStat(state, q.id) }))
      .filter(({ q, stat }) => (
        q.trials &&
        q.trials.length > 0 &&
        (stat.wrong > 0 || stat.bookmarked || stat.mastery <= 2 || (stat.highConfidenceWrong || 0) > 0)
      ));

    const trialMap = new Map();

    trialSourceQuestions.forEach(({ q, stat }) => {
      (q.trials || []).forEach((trial) => {
        if (!trialMap.has(trial)) {
          trialMap.set(trial, []);
        }
        trialMap.get(trial).push({
          id: q.id,
          cancer: q.cancer,
          topic: q.topic,
          stem: q.stem,
          answer: q.answer,
          explanation: q.explanation || stat.explanation || '',
          wrongRate: wrongRate(stat),
        });
      });
    });

    const trialText = Array.from(trialMap.entries())
      .slice(0, 20)
      .map(([trial, sources]) => {
        const sourceText = sources
          .slice(0, 3)
          .map((s) => `
Source question: ${s.id}
Cancer: ${s.cancer || ''}
Topic: ${s.topic || ''}
Wrong rate: ${s.wrongRate}%
Stem: ${s.stem || ''}
Answer: ${s.answer || ''}
Explanation: ${s.explanation || ''}
`)
          .join('\n');

        return `
Trial: ${trial}
${sourceText}
`;
      })
      .join('\n---\n');

    const prompt = `
你是一位 hematology-oncology board exam coach。請根據以下 trial list 與錯題來源，產生高分導向 flashcards。

請只輸出 JSON array，不要加 markdown，不要加說明文字。

${FLASHCARD_SCHEMA_PROMPT}

每個 pivotal trial 至少產生 1–2 張卡。優先使用 Trial Card；若來源題目包含治療順序、數字 cutoff、或錯選項陷阱，可另外產生 Algorithm Card、Cloze Card、Trap Card。

Trial sources:

${trialText || '目前沒有符合條件的 trial 來源。'}
`.trim();

    setCardPrompt(prompt);
    setCardPromptMessage(`已產生 ${trialMap.size} 個 trial 的 Trial Cards prompt。`);
  };

  return (
    <main className="panel">
      <div className="section-head">
        <div>
          <h2>Card Manager</h2>
          <p className="muted">在同一頁新增、匯入、搜尋、修改與刪除 cards。</p>
        </div>
        <button className="primary" type="button" onClick={onOpenReview}>開始 Card Review</button>
      </div>

      <section className="readiness-hero">
        <MetricCard label="Cards total" value={allFlashcards.length} sub={`${dueFlashcards.length} due today`} />
        <MetricCard label="Trial cards" value={trialCards.length} sub="Trial Boss unlock target: 50" />
        <MetricCard label="Weak cards" value={weakCards.length} sub="mastery <=2" />
        <MetricCard label="Weak questions" value={weakQuestions.length} sub="wrong/bookmarked source pool" />
      </section>

      <div className="flashcard-create">
        <label>
          Quick Add Trial Name
          <input value={trialName} onChange={(e) => setTrialName(e.target.value)} placeholder="例如 KEYNOTE-671、PACIFIC、KATHERINE" />
        </label>
        <button className="secondary" onClick={submitTrialCard}>新增空白 Trial Card</button>
      </div>

      <div className="subsection import-card-panel">
        <h3>AI Card Prompt Generator</h3>
        <p className="muted">從 Due / weak questions 整理成 ChatGPT prompt，再貼回 ChatGPT 產生高品質 JSON cards。</p>
        <div className="inline-actions">
          <button className="secondary" onClick={buildAiCardPromptFromWeakQuestions}>產生今日 Due Cards Prompt</button>
          <button className="secondary" onClick={buildTrialCardPromptFromWeakQuestions}>產生 Trial Cards Prompt</button>
          <button className="primary" onClick={copyCardPrompt} disabled={!cardPrompt}>複製 Prompt</button>
        </div>
        {cardPromptMessage && <p className="save-message">{cardPromptMessage}</p>}
        <textarea
          className="prompt-box"
          value={cardPrompt}
          onChange={(e) => setCardPrompt(e.target.value)}
          placeholder="產生的 ChatGPT prompt 會出現在這裡。"
        />
      </div>

      <div className="subsection import-card-panel">
        <h3>Import Flashcards</h3>
        <p className="muted">貼上 ChatGPT 產生的 JSON array；每張卡至少需要 front/back，建議使用 Trial / Algorithm / Cloze / Trap Card schema。</p>
        <textarea
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          placeholder={'[\n  {\n    "front": "PACIFIC trial 的 P/I/C/O 與主要考試陷阱是什麼？",\n    "back": "Population: unresectable stage III NSCLC，完成 definitive concurrent platinum-based CCRT 後未 progression。Intervention: durvalumab consolidation。Comparator: placebo。Outcome: improved PFS and OS。Trap: 不是 CCRT 同時加 durvalumab，而是 CCRT 後 consolidation。",\n    "type": "Trial Card",\n    "cancer": "Lung",\n    "topic": "Unresectable stage III NSCLC",\n    "sourceQuestionId": "Day-3",\n    "trial": ["PACIFIC"],\n    "tags": ["PACIFIC", "durvalumab", "CCRT", "stage III NSCLC", "OS", "PFS"],\n    "examValue": 5,\n    "errorType": "Trial confusion"\n  }\n]'}
        />
        <div className="inline-actions">
          <button className="primary" onClick={submitImport}>Import Cards</button>
          {importMessage && <span className="save-message">{importMessage}</span>}
        </div>
      </div>

      <div className="subsection card-manager-section">
        <div className="section-head">
          <div>
            <h3>Browse / Edit Cards</h3>
            <p className="muted">搜尋 front、topic、cancer、trial 或 tag，再點選卡片編輯。</p>
          </div>
          <span className="pill soft">{filteredCards.length} / {managerCards.length}</span>
        </div>
        <label className="card-manager-search">
          Search cards
          <input type="search" value={cardSearch} onChange={(event) => setCardSearch(event.target.value)} placeholder="Front, topic, cancer, trial, tag" />
        </label>
        <div className="card-manager-workspace">
          <aside className="card-manager-list" aria-label="Flashcard list">
            {filteredCards.map((card) => {
              const editId = getFlashcardEditId(card);
              return (
                <button type="button" key={card.id} className={editId === selectedCardId ? 'active' : ''} onClick={() => selectCardForEditing(card)}>
                  <strong>{getFlashcardFrontText(card) || 'Untitled card'}</strong>
                  <span>{card.cancer || 'Unsorted'} · {card.topic || card.type || 'Flashcard'}</span>
                </button>
              );
            })}
            {!filteredCards.length && <p className="muted">找不到符合的 card。</p>}
          </aside>
          <div className="card-manager-editor">
            {!selectedCard ? (
              <div className="empty-state compact">
                <h3>選擇一張 card</h3>
                <p className="muted">從左側清單點選後即可修改或刪除。</p>
              </div>
            ) : (
              <div className="flashcard-editor">
                <label>Front<textarea value={editDraft.front} onChange={(e) => setEditDraft((prev) => ({ ...prev, front: e.target.value }))} /></label>
                <label>Back<textarea value={editDraft.back} onChange={(e) => setEditDraft((prev) => ({ ...prev, back: e.target.value }))} /></label>
                <div className="flashcard-editor-grid">
                  <label>Type<select value={editDraft.type} onChange={(e) => setEditDraft((prev) => ({ ...prev, type: e.target.value }))}>{FLASHCARD_TYPE_OPTIONS.map((type) => <option value={type} key={type}>{type}</option>)}</select></label>
                  <label>Cancer<input value={editDraft.cancer} onChange={(e) => setEditDraft((prev) => ({ ...prev, cancer: e.target.value }))} /></label>
                  <label>Topic<input value={editDraft.topic} onChange={(e) => setEditDraft((prev) => ({ ...prev, topic: e.target.value }))} /></label>
                  <label>Trial names<input value={editDraft.trial} onChange={(e) => setEditDraft((prev) => ({ ...prev, trial: e.target.value }))} placeholder="PACIFIC, KEYNOTE-671" /></label>
                  <label>Exam value<input type="number" min="1" max="5" value={editDraft.examValue} onChange={(e) => setEditDraft((prev) => ({ ...prev, examValue: e.target.value }))} /></label>
                  <label>Error type<select value={editDraft.errorType} onChange={(e) => setEditDraft((prev) => ({ ...prev, errorType: e.target.value }))}>{ERROR_TYPE_OPTIONS.map((errorType) => <option value={errorType} key={errorType}>{errorType}</option>)}</select></label>
                </div>
                <label>Tags<input value={editDraft.tags} onChange={(e) => setEditDraft((prev) => ({ ...prev, tags: e.target.value }))} placeholder="trial, endpoint, NSCLC" /></label>
                <div className="inline-actions review-actions">
                  <button className="primary" onClick={saveCardEdit}>儲存修改</button>
                  <button className="secondary" onClick={() => setEditDraft(makeFlashcardEditDraft(selectedCard))}>取消變更</button>
                  <button className="danger" onClick={deleteSelectedCard}>刪除 Card</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function makeFlashcardEditDraft(card) {
  return {
    front: card.front || '',
    back: card.back || '',
    type: normalizeFlashcardType(card.type, card.sourceType),
    cancer: card.cancer || '',
    topic: card.topic || '',
    trial: normalizeTextList(card.trial).join(', '),
    tags: normalizeTextList(card.tags).join(', '),
    examValue: normalizeExamValue(card.examValue),
    errorType: normalizeFlashcardErrorType(card.errorType),
  };
}

function splitEditableList(value) {
  return [...new Set(String(value || '').split(/[,;\n]/).map((item) => item.trim()).filter(Boolean))];
}

function FlashcardRatingButton({ rating, card, onClick, disabled = false }) {
  const schedule = getFlashcardReviewSchedulePreview(rating, card);
  return (
    <button
      className={`tiny schedule-rating ${rating.toLowerCase()}`}
      disabled={disabled}
      title={rating === 'Again' ? 'Again：完成 10 次作答後重複' : `${rating}：下次 ${schedule.dueLabel}`}
      onClick={onClick}
    >
      <span>{rating}</span>
      <small>{schedule.shortLabel}</small>
    </button>
  );
}


function makeFlashcardReviewQueue(cards, mode) {
  const queueStartedAt = Date.now();
  return cards.map((card, index) => ({
    sessionKey: `${mode}-${queueStartedAt}-${index}-${card.id}`,
    cardId: card.id,
  }));
}

function makeFlashcardReviewSession(cards, mode) {
  const now = new Date().toISOString();
  return {
    id: `flashcard-review-${Date.now()}`,
    mode,
    queue: makeFlashcardReviewQueue(cards, mode),
    activeIndex: 0,
    startedAt: now,
    updatedAt: now,
  };
}

function FlashcardReviewPanel({ dueFlashcards, allFlashcards, persistedSession, onReviewCard, onSessionChange, onOpenManager }) {
  const [session, setSession] = useState(() => (
    normalizeActiveFlashcardReview(persistedSession, cardsToMap(allFlashcards))
    || makeFlashcardReviewSession(dueFlashcards, 'due')
  ));
  const [showBack, setShowBack] = useState(false);
  const [algorithmStepCount, setAlgorithmStepCount] = useState(0);
  const repeatSequenceRef = useRef(0);
  const hasInitializedSessionRef = useRef(Boolean(persistedSession));
  const queueMode = session.mode;
  const sessionQueue = session.queue;
  const activeIndex = session.activeIndex;
  const activeEntry = sessionQueue[activeIndex] || null;
  const card = activeEntry
    ? allFlashcards.find((item) => item.id === activeEntry.cardId)
    : null;
  const trialCards = allFlashcards.filter((item) => item.sourceType === 'trial' || item.type === 'Trial Card');
  const weakCards = allFlashcards.filter((item) => (item.mastery || 0) <= 2);
  const algorithmSteps = getAlgorithmSteps(card || {});
  const hasAlgorithmSteps = algorithmSteps.length > 0;
  const canRateCard = showBack && (!hasAlgorithmSteps || algorithmStepCount >= algorithmSteps.length);

  useEffect(() => {
    setShowBack(false);
    setAlgorithmStepCount(0);
  }, [card]);

  useEffect(() => {
    const incoming = normalizeActiveFlashcardReview(persistedSession, cardsToMap(allFlashcards));
    if (!incoming || incoming.updatedAt <= (session.updatedAt || '')) return;
    setSession(incoming);
    setShowBack(false);
    setAlgorithmStepCount(0);
  }, [allFlashcards, persistedSession, session.updatedAt]);

  useEffect(() => {
    if (hasInitializedSessionRef.current) return;
    hasInitializedSessionRef.current = true;
    if (session.queue.length > 0) onSessionChange(session);
  }, [onSessionChange, session]);

  const rateCard = (rating) => {
    if (!card || !activeEntry) return;
    const now = new Date().toISOString();
    let nextQueue = sessionQueue;
    if (rating === 'Again') {
      const insertionIndex = Math.min(activeIndex + 11, sessionQueue.length);
      nextQueue = [...sessionQueue];
      repeatSequenceRef.current += 1;
      nextQueue.splice(insertionIndex, 0, {
        ...activeEntry,
        sessionKey: `${activeEntry.cardId}-again-${now}-${repeatSequenceRef.current}`,
      });
    }
    const nextIndex = activeIndex + 1;
    const isComplete = nextIndex >= nextQueue.length;
    const nextSession = isComplete ? null : {
      ...session,
      queue: nextQueue,
      activeIndex: nextIndex,
      updatedAt: now,
    };
    setSession(nextSession || { ...session, queue: nextQueue, activeIndex: nextIndex, updatedAt: now });
    onReviewCard(getFlashcardReviewId(card), rating, nextSession, isComplete ? now : null);
    setShowBack(false);
    setAlgorithmStepCount(0);
  };

  const selectQueueMode = (mode) => {
    const nextSession = makeFlashcardReviewSession(mode === 'all' ? allFlashcards : dueFlashcards, mode);
    setSession(nextSession);
    onSessionChange(nextSession);
    setShowBack(false);
    setAlgorithmStepCount(0);
  };

  const toggleAnswer = () => {
    setShowBack((visible) => {
      const nextVisible = !visible;
      setAlgorithmStepCount(nextVisible && hasAlgorithmSteps ? 1 : 0);
      return nextVisible;
    });
  };

  const revealNextAlgorithmStep = () => {
    setAlgorithmStepCount((count) => Math.min(algorithmSteps.length, count + 1));
  };

  return (
    <main className="panel flashcard-review-panel">
      <div className="section-head">
        <div>
          <h2>Card Review</h2>
          <p className="muted">像 Anki 一樣翻面作答；Again 會在完成 10 次作答後於本次佇列重複。</p>
        </div>
        <div className="inline-actions">
          <button className={queueMode === 'due' ? 'primary' : 'secondary'} onClick={() => selectQueueMode('due')}>Due Cards</button>
          <button className={queueMode === 'all' ? 'primary' : 'secondary'} onClick={() => selectQueueMode('all')}>All Cards</button>
          <button className="secondary" onClick={onOpenManager}>Card Manager</button>
        </div>
      </div>

      <section className="readiness-hero">
        <MetricCard label="Cards total" value={allFlashcards.length} sub={`${dueFlashcards.length} due today`} />
        <MetricCard label="Remaining" value={Math.max(0, sessionQueue.length - activeIndex)} sub={`${queueMode === 'due' ? 'due' : 'all'} session queue`} />
        <MetricCard label="Trial cards" value={trialCards.length} sub="trial recall pool" />
        <MetricCard label="Weak cards" value={weakCards.length} sub="mastery <=2" />
      </section>

      {!card ? (
        <section className="empty-state">
          <h3>沒有可複習的卡片</h3>
          <p className="muted">本次作答已完成，或目前沒有可複習的卡片。</p>
          <button className="primary" onClick={onOpenManager}>前往 Card Manager</button>
        </section>
      ) : (
        <section className="card-review-workspace">
          <div className="single-review-card">
            <div className="question-top">
              <div>
                <span className="pill">{card.type || card.sourceType || 'Flashcard'}</span>
                {card.clozeLabel && <span className="pill">{card.clozeLabel}</span>}
                <span className="pill soft">{card.cancer}</span>
                <span className="pill soft">{card.topic}</span>
                {card.trial?.map((trial, index) => <span className="pill trial" key={`${trial}-${index}`}>{trial}</span>)}
                {card.tags?.map((tag, index) => <span className="pill tag" key={`${tag}-${index}`}>{tag}</span>)}
                {card.examValue >= 4 && <span className="priority high">EV{card.examValue}</span>}
              </div>
              <span className="priority">{activeIndex + 1}/{sessionQueue.length}{card.clozeTotal ? ` · ${card.clozeIndex}/${card.clozeTotal}` : ''} · M{card.mastery || 0}</span>
            </div>
            <>
                <pre className="flashcard-front large">{renderClozeText(getFlashcardFrontText(card), showBack, card.clozeNumber)}</pre>
                {showBack && hasAlgorithmSteps ? (
                  <div className="flashcard-back large algorithm-answer">
                    <ol>
                      {algorithmSteps.slice(0, algorithmStepCount).map((step, index) => (
                        <li key={`${step}-${index}`}>{step}</li>
                      ))}
                    </ol>
                  </div>
                ) : showBack && <pre className="flashcard-back large">{card.back || '已顯示克漏字答案。'}</pre>}
                <div className="inline-actions review-actions">
                  <button className="secondary" onClick={toggleAnswer}>{showBack ? 'Hide Answer' : 'Show Answer'}</button>
                  {showBack && hasAlgorithmSteps && algorithmStepCount < algorithmSteps.length && (
                    <button className="secondary" onClick={revealNextAlgorithmStep}>下一步</button>
                  )}
                  {Object.keys(FLASHCARD_RATINGS).map((rating) => (
                    <FlashcardRatingButton
                      key={rating}
                      rating={rating}
                      card={card}
                      disabled={!canRateCard}
                      onClick={() => rateCard(rating)}
                    />
                  ))}
                </div>
                <div className="stats-line">next review {formatReviewDueLabel(card.nextReviewDate || TODAY)} · attempts {card.attempts || 0} · correct {card.correct || 0} / wrong {card.wrong || 0}</div>
              </>
          </div>
        </section>
      )}
    </main>
  );
}

function summarizeMockResults(results = []) {
  const gradeable = results.filter((row) => row.isCorrect != null);
  const correct = gradeable.filter((row) => row.isCorrect).length;
  const wrongRows = gradeable.filter((row) => !row.isCorrect);
  const cancerLoss = wrongRows.reduce((acc, row) => {
    const key = `${row.cancer} · ${row.topic || 'General'}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    correct,
    pendingCount: results.length - gradeable.length,
    score: gradeable.length ? Math.round((correct / gradeable.length) * 100) : 0,
    highConfidenceWrong: wrongRows.filter((row) => row.confidence >= 4).length,
    slowCorrect: gradeable.filter((row) => row.isCorrect && row.timeSpentSec > 90).length,
    fastWrong: wrongRows.filter((row) => row.timeSpentSec < 30).length,
    topScoreLoss: Object.entries(cancerLoss).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, count]) => ({ label, count })),
  };
}

function MockExamPanel({ state, persistedDraft, onDraftChange, onDraftClear, onFinishMock, onEnsureQuestionYears }) {
  const [questionCount, setQuestionCount] = useState(persistedDraft?.questionCount || 80);
  const [timerMinutes, setTimerMinutes] = useState(persistedDraft?.timerMinutes || 120);
  const [examMode, setExamMode] = useState(persistedDraft?.examMode || 'diagnostic-mock-0');
  const [examYear, setExamYear] = useState(persistedDraft?.examYear || 'All');
  const [exam, setExam] = useState(persistedDraft?.exam || null);
  const [startedAt, setStartedAt] = useState(persistedDraft?.startedAt || null);
  const [answers, setAnswers] = useState(persistedDraft?.answers || {});
  const [showResults, setShowResults] = useState(Boolean(persistedDraft?.showResults));
  const [examMessage, setExamMessage] = useState(persistedDraft?.examMessage || '');
  const [draftClosed, setDraftClosed] = useState(false);
  const examQuestions = useMemo(
    () => (exam?.questionIds || []).map((id) => getQuestionWithOverride(id, state)).filter(Boolean),
    [exam?.questionIds, state],
  );

  useEffect(() => {
    if (!exam?.questionIds?.length) return;
    const years = getQuestionYearsFromIds(exam.questionIds);
    if (years.length) onEnsureQuestionYears(years);
  }, [exam?.id, exam?.questionIds, onEnsureQuestionYears]);

  useEffect(() => {
    if (!exam) return;
    if (draftClosed) {
      onDraftClear();
      return;
    }
    onDraftChange({
      questionCount,
      timerMinutes,
      examMode,
      examYear,
      exam,
      startedAt,
      answers,
      showResults,
      examMessage,
      updatedAt: new Date().toISOString(),
    });
  }, [answers, draftClosed, exam, examMessage, examMode, examYear, onDraftChange, onDraftClear, questionCount, showResults, startedAt, timerMinutes]);

  const startMock = async () => {
    const yearsToLoad = examYear === 'All' ? state.settings?.preferredYears || QUESTION_YEARS : [examYear];
    const ready = await onEnsureQuestionYears(yearsToLoad);
    if (!ready) return;
    const pool = shuffleStable(getQuestionPool(state)
      .map((q) => getQuestionWithOverride(q.id, state))
      .filter(Boolean)
      .filter((q) => examYear === 'All' || Number(q.year) === Number(examYear))
      .filter((q) => {
        if (examMode === 'lung-boss') return q.cancer === 'Lung';
        if (examMode === 'breast-boss') return q.cancer === 'Breast';
        if (examMode === 'gi-boss') return q.cancer === 'GI';
        if (examMode === 'head-neck-boss') return q.cancer === 'Head & Neck';
        if (examMode === 'trial-boss') return (q.trials || []).length > 0 || ['Trial interpretation', 'Biomarker'].includes(q.topic);
        return true;
      }));
    const selected = pool.slice(0, Number(questionCount));
    setDraftClosed(false);
    setExam({ id: `mock-${Date.now()}`, questionIds: selected.map((question) => question.id), mode: examMode, year: examYear === 'All' ? null : Number(examYear) });
    setStartedAt(Date.now());
    setAnswers({});
    setShowResults(false);
    setExamMessage('');
  };

  const updateAnswer = (questionId, patch) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        confidence: 3,
        selected: '',
        timeSpentSec: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0,
        ...prev[questionId],
        ...patch,
      },
    }));
  };

  const finishMock = () => {
    if (!exam) return;
    const missingIndex = examQuestions.findIndex((question) => !answers[question.id]?.selected);
    if (missingIndex >= 0) {
      setExamMessage(`第 ${missingIndex + 1} 題尚未作答，已跳到該題。`);
      document.querySelector(`[data-mock-question-id="${examQuestions[missingIndex].id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const elapsedSec = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
    const results = examQuestions.map((q) => {
      const draft = answers[q.id] || {};
      const correctAnswer = String(q.answer || getStat(state, q.id).correctAnswer || '').trim().toUpperCase();
      const selected = String(draft.selected || '').trim().toUpperCase();
      const isCorrect = correctAnswer ? selected === correctAnswer : null;
      return {
        questionId: q.id,
        selected: selected || null,
        correctAnswer: correctAnswer || null,
        isCorrect,
        confidence: Number(draft.confidence) || 3,
        timeSpentSec: draft.timeSpentSec || 0,
        cancer: q.cancer,
        topic: q.topic,
        trials: q.trials || [],
        submittedAt: new Date().toISOString(),
      };
    });
    const summary = summarizeMockResults(results);
    const completedExam = {
      id: exam.id,
      mode: exam.mode || examMode,
      year: exam.year || null,
      questionCount: results.length,
      timerMinutes: Number(timerMinutes),
      elapsedSec,
      ...summary,
      results,
      startedAt: new Date(startedAt || Date.now()).toISOString(),
      scoredAt: new Date().toISOString(),
      completedAt: null,
    };
    playResultFeedback(summary.score >= 60 ? 'correct' : 'wrong');
    onFinishMock(completedExam);
    setExam({ ...exam, completedExam });
    setShowResults(true);
    setExamMessage('已整份交卷。請查看所有答案並完成錯題的錯因分類。');
  };

  const updateMockCorrectAnswer = (questionId, nextAnswer) => {
    if (!exam?.completedExam || exam.completedExam.persistedAt) return;
    const correctAnswer = String(nextAnswer || '').trim().toUpperCase();
    const results = exam.completedExam.results.map((result) => result.questionId === questionId ? {
      ...result,
      correctAnswer: correctAnswer || null,
      isCorrect: correctAnswer ? result.selected === correctAnswer : null,
    } : result);
    const completedExam = { ...exam.completedExam, ...summarizeMockResults(results), results };
    updateAnswer(questionId, { correctAnswer, errorType: '' });
    onFinishMock(completedExam);
    setExam({ ...exam, completedExam });
  };

  const finalizeMock = () => {
    if (!exam?.completedExam || exam.completedExam.persistedAt) return;
    const results = exam.completedExam.results.map((result) => {
      const errorType = result.isCorrect === false ? (answers[result.questionId]?.errorType || '') : '';
      const remediation = errorType ? getRemediationForErrorType(errorType) : null;
      return {
        ...result,
        errorType,
        remediationTask: remediation?.task || '',
        remediationCardType: remediation?.cardType || '',
      };
    });
    const missingCorrectAnswer = results.find((result) => result.isCorrect == null);
    if (missingCorrectAnswer) {
      setExamMessage('仍有題目尚未設定正解，已跳到該題。');
      document.querySelector(`[data-mock-review-id="${missingCorrectAnswer.questionId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const missing = results.find((result) => !result.isCorrect && !result.errorType);
    if (missing) {
      setExamMessage('仍有錯題尚未選擇錯因，已跳到該題。');
      document.querySelector(`[data-mock-review-id="${missing.questionId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const persistedAt = new Date().toISOString();
    const completedExam = { ...exam.completedExam, results, persistedAt, completedAt: persistedAt };
    onFinishMock(completedExam);
    setExam({ ...exam, completedExam });
    setDraftClosed(true);
    setExamMessage('錯因訂正已完成，Mock Exam 結果已寫入統計。');
  };

  const completed = exam?.completedExam;
  const restoringQuestions = Boolean(exam?.questionIds?.length && examQuestions.length < exam.questionIds.length);

  return (
    <main className="panel">
      <div className="section-head">
        <div>
          <h2>Mock Exam Mode</h2>
          <p className="muted">Mock 0 是獨立 diagnostic baseline，用來產生 score-dragger map；正式 {QUESTION_YEAR_LABEL} mock cycle 留在 Day 73–82。</p>
        </div>
        <div className="inline-actions">
          <label>題數
            <select value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))}>
              {[20, 50, 80, 120].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label>Mode
            <select value={examMode} onChange={(e) => setExamMode(e.target.value)}>
              <option value="diagnostic-mock-0">Diagnostic Mock 0</option>
              <option value="mixed-mock">Mixed mock</option>
              <option value="lung-boss">Lung Boss</option>
              <option value="breast-boss">Breast Boss</option>
              <option value="gi-boss">GI Boss</option>
              <option value="head-neck-boss">Head & Neck Boss</option>
              <option value="trial-boss">Trial Boss</option>
              <option value="final-board">Final Board Boss</option>
            </select>
          </label>
          <label>Year
            <select value={examYear} onChange={(e) => setExamYear(e.target.value)}>
              <option>All</option>
              {QUESTION_YEARS.map((questionYear) => (
                <option key={questionYear}>{questionYear}</option>
              ))}
            </select>
          </label>
          <label>Timer
            <select value={timerMinutes} onChange={(e) => setTimerMinutes(Number(e.target.value))}>
              {[60, 90, 120, 180].map((n) => <option key={n} value={n}>{n} min</option>)}
            </select>
          </label>
          <button className="primary" onClick={startMock}>Start mock</button>
        </div>
      </div>

      {completed && showResults && (
        <>
          {restoringQuestions && <p className="save-message">正在恢復 Mock Exam 題目，請稍候。</p>}
          {examMessage && <p className="save-message">{examMessage}</p>}
          <section className="readiness-hero">
            <MetricCard label="答對率" value={`${completed.score}%`} sub={`${completed.correct}/${completed.questionCount - (completed.pendingCount || 0)} graded correct`} />
            <MetricCard label="答錯率" value={`${100 - completed.score}%`} sub={`${completed.questionCount - (completed.pendingCount || 0) - completed.correct}/${completed.questionCount - (completed.pendingCount || 0)} graded wrong`} />
            {completed.pendingCount > 0 && <MetricCard label="待補正解" value={completed.pendingCount} sub="補入後才納入分數" />}
            <MetricCard label="High-confidence wrong" value={completed.highConfidenceWrong} sub="confidence 4–5 but wrong" />
            <MetricCard label="Fast wrong / Slow correct" value={`${completed.fastWrong}/${completed.slowCorrect}`} sub="speed diagnostics" />
            <div className="subsection full-span">
              <h3>Top score loss</h3>
              {completed.topScoreLoss.length ? completed.topScoreLoss.map((item) => <div className="weak-row" key={item.label}>{item.label} · lost {item.count}</div>) : <p className="muted">沒有錯題。</p>}
            </div>
          </section>
          <div className="question-list">
            {examQuestions.map((question, index) => {
              const result = completed.results.find((row) => row.questionId === question.id);
              const remediation = answers[question.id]?.errorType ? getRemediationForErrorType(answers[question.id].errorType) : null;
              return (
                <article className="question-card" key={question.id} data-mock-review-id={question.id}>
                  <div className="question-top"><div><span className="qid">{index + 1}. {question.id}</span><span className="pill">{question.cancer}</span></div></div>
                  <p className="stem">{question.stem}</p>
                  <div className="options">
                    {Object.entries(question.options || {}).map(([key, value]) => (
                      <label key={key} className={['option', result.selected === key ? 'selected' : '', result.correctAnswer === key ? 'correct-option' : '', result.selected === key && !result.isCorrect ? 'wrong-option' : ''].filter(Boolean).join(' ')}>
                        <input type="radio" checked={result.selected === key} disabled readOnly />
                        <span className="option-key">{key}</span><span>{value}</span>
                      </label>
                    ))}
                  </div>
                  <div className="feedback-box"><strong>{result.isCorrect == null ? '待補正解' : result.isCorrect ? 'Correct' : 'Wrong'}｜你的答案：{result.selected}｜正解：{result.correctAnswer || '尚未輸入'}</strong></div>
                  {!question.answer && (
                    <div className="answer-row">
                      <label>正解
                        <select disabled={Boolean(completed.persistedAt)} value={result.correctAnswer || ''} onChange={(event) => updateMockCorrectAnswer(question.id, event.target.value)}>
                          <option value="" disabled>尚未輸入</option>
                          {['A', 'B', 'C', 'D', 'E'].map((answer) => <option key={answer} value={answer}>{answer}</option>)}
                        </select>
                      </label>
                    </div>
                  )}
                  {result.isCorrect === false && (
                    <div className="answer-row">
                      <label>Error type
                        <select disabled={Boolean(completed.persistedAt)} value={answers[question.id]?.errorType || ''} onChange={(event) => updateAnswer(question.id, { errorType: event.target.value })}>
                          <option value="">選擇錯因</option>
                          {ERROR_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </label>
                      {remediation && <div className="remediation-preview"><strong>{remediation.task}</strong><span>{remediation.action}</span></div>}
                    </div>
                  )}
                  <div className="textareas"><label>詳解 / guideline / trial note<textarea value={question.explanation || '目前沒有詳解。'} readOnly /></label></div>
                </article>
              );
            })}
          </div>
          <button className="good" disabled={Boolean(completed.persistedAt)} onClick={finalizeMock}>
            {completed.persistedAt ? '訂正與統計已完成' : '完成錯因訂正並寫入統計'}
          </button>
        </>
      )}

      {exam && !showResults && (
        <>
          {restoringQuestions && <p className="save-message">正在恢復 Mock Exam 題目，請稍候。</p>}
          <div className="mock-toolbar">
            <strong>{examQuestions.length} questions</strong>
            <span className="muted">已作答 {Object.values(answers).filter((a) => a.selected).length}/{examQuestions.length}</span>
            <button className="good" disabled={restoringQuestions} onClick={finishMock}>Finish exam and score</button>
          </div>
          {examMessage && <p className="save-message">{examMessage}</p>}
          <div className="question-list">
            {examQuestions.map((q, index) => {
              const draft = answers[q.id] || { confidence: 3, selected: '' };
              return (
                <article className="question-card" key={q.id} data-mock-question-id={q.id}>
                  <div className="question-top">
                    <div><span className="qid">{index + 1}. {q.id}</span><span className="pill">{q.cancer}</span><span className="pill soft">{q.topic}</span></div>
                  </div>
                  <p className="stem">{q.stem}</p>
                  <div className="options">
                    {Object.entries(q.options || {}).map(([key, value]) => (
                      <label key={key} className={draft.selected === key ? 'option selected' : 'option'}>
                        <input type="radio" name={`mock-${q.id}`} checked={draft.selected === key} onChange={() => updateAnswer(q.id, { selected: key, timeSpentSec: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0 })} />
                        <span className="option-key">{key}</span>
                        <span>{value}</span>
                      </label>
                    ))}
                  </div>
                  <div className="answer-row">
                    <label>Confidence
                      <select value={draft.confidence} onChange={(e) => updateAnswer(q.id, { confidence: Number(e.target.value) })}>
                        <option value={1}>1 完全猜</option><option value={2}>2 不太確定</option><option value={3}>3 有印象</option><option value={4}>4 有把握</option><option value={5}>5 非常確定</option>
                      </select>
                    </label>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {!exam && (
        <div className="empty-state">
          <h3>正式模擬考規格</h3>
          <p>50 / 80 / 120 題、不可看詳解、全癌別混合。完成後匯入 stats、mock trend、critical error queue。</p>
        </div>
      )}
    </main>
  );
}

export default function App() {
  const [state, setState] = useState(loadState);
  const [questionBankVersion, setQuestionBankVersion] = useState(0);
  const [questionBankLoading, setQuestionBankLoading] = useState(false);
  const [questionBankError, setQuestionBankError] = useState('');
  const latestStateRef = useRef(state);
  const dirtyStorageSlicesRef = useRef(null);
  const [tab, setTab] = useState('quest');
  useEffect(() => {
    if (tab === 'news') setTab('knowledge');
  }, [tab]);
  const [search, setSearch] = useState('');
  const [bankCancer, setBankCancer] = useState('All');
  const [bankYear, setBankYear] = useState(DEFAULT_QUESTION_MANAGER_YEAR);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState('尚未登入，資料目前只存在這台裝置。');
  const [syncError, setSyncError] = useState('');
  const [isApplyingCloudState, setIsApplyingCloudState] = useState(false);
  const notionLibrary = useNotionLibrary({
    user,
    fallbackItems: notionNewsItems,
    enabled: tab === 'knowledge' || tab === 'news',
  });
  const isApplyingCloudStateRef = useRef(false);
  const lastSyncedSignatureRef = useRef(getCloudSyncSignature(loadState()));
  const [isCreatingPractice, setIsCreatingPractice] = useState(false);
  const isCreatingPracticeRef = useRef(false);
  const completedPomodoroPhaseRef = useRef('');
  const [practicePage, setPracticePage] = useState(0);
  const [practicePageMessage, setPracticePageMessage] = useState('');
  const [activeRemediationQuestionId, setActiveRemediationQuestionId] = useState(null);
  const [focusTick, setFocusTick] = useState(() => Date.now());
  const focusTimer = normalizeFocusTimer(state.focusTimer);
  const activeFocusSession = focusTimer.activeSession;
  const focusStartedAt = activeFocusSession?.startedAt || null;
  const leaderboardStartedAt = new Date(focusTimer.leaderboardStartedAt).getTime();
  const todaySession = state.sessions[TODAY];
  const preferredQuestionYears = useMemo(
    () => normalizeQuestionYearList(state.settings?.preferredYears?.length ? state.settings.preferredYears : QUESTION_YEARS),
    [state.settings?.preferredYears]
  );
  const todaySessionQuestionYears = useMemo(
    () => getQuestionYearsFromIds(todaySession?.questionIds || EMPTY_ARRAY),
    [todaySession?.questionIds]
  );
  const requestedQuestionYears = useMemo(() => {
    if (tab === 'questions') {
      if (bankYear === 'Custom') return EMPTY_ARRAY;
      return bankYear === 'All' ? QUESTION_YEARS : normalizeQuestionYearList([bankYear]);
    }
    if (tab === 'today' || tab === 'quest') return todaySessionQuestionYears;
    if (['review', 'analytics', 'readiness', 'critical', 'plan', 'flashcards', 'knowledge', 'news'].includes(tab)) return preferredQuestionYears;
    return EMPTY_ARRAY;
  }, [bankYear, preferredQuestionYears, tab, todaySessionQuestionYears]);
  const requestedQuestionYearKey = requestedQuestionYears.join(',');
  const questionBankReady = requestedQuestionYears.length === 0 || areQuestionYearsLoaded(requestedQuestionYears);

  const ensureQuestionYearsReady = async (years = preferredQuestionYears) => {
    const normalizedYears = normalizeQuestionYearList(years.length ? years : QUESTION_YEARS);
    if (!normalizedYears.length || areQuestionYearsLoaded(normalizedYears)) return true;
    setQuestionBankLoading(true);
    setQuestionBankError('');
    try {
      const loadedNewYear = await loadQuestionYears(normalizedYears);
      if (loadedNewYear) setQuestionBankVersion((version) => version + 1);
      return true;
    } catch (error) {
      setQuestionBankError(error.message || '題庫載入失敗，請重新整理後再試。');
      return false;
    } finally {
      setQuestionBankLoading(false);
    }
  };

  useEffect(() => {
    latestStateRef.current = state;
    const slicesToSave = dirtyStorageSlicesRef.current && dirtyStorageSlicesRef.current.size
      ? [...dirtyStorageSlicesRef.current]
      : null;
    dirtyStorageSlicesRef.current = new Set();
    let idleId = null;
    const saveLatestState = () => saveState(latestStateRef.current, slicesToSave);
    const timeoutId = window.setTimeout(() => {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(saveLatestState, { timeout: 1200 });
        return;
      }
      saveLatestState();
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
      if (idleId !== null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [state]);

  useEffect(() => {
    const saveBeforeLeaving = () => saveState(latestStateRef.current);
    window.addEventListener('pagehide', saveBeforeLeaving);
    return () => {
      saveBeforeLeaving();
      window.removeEventListener('pagehide', saveBeforeLeaving);
    };
  }, []);

  useEffect(() => {
    isApplyingCloudStateRef.current = isApplyingCloudState;
  }, [isApplyingCloudState]);

  useEffect(() => {
    if (!requestedQuestionYearKey || areQuestionYearsLoaded(requestedQuestionYears)) return undefined;
    let cancelled = false;
    setQuestionBankLoading(true);
    setQuestionBankError('');
    loadQuestionYears(requestedQuestionYears)
      .then((loadedNewYear) => {
        if (cancelled) return;
        if (loadedNewYear) setQuestionBankVersion((version) => version + 1);
      })
      .catch((error) => {
        if (cancelled) return;
        setQuestionBankError(error.message || '題庫載入失敗，請重新整理後再試。');
      })
      .finally(() => {
        if (!cancelled) setQuestionBankLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestedQuestionYearKey, requestedQuestionYears]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const interactive = target.closest('button, input, select, textarea, label, a');
      if (!interactive || interactive.matches(':disabled')) return;
      const tapSurface = target.closest('button, .tap-surface, .option, .check-pill, .manager-question-row, .mission-action, .chip-check, .rating-button, .file-button');
      if (tapSurface instanceof HTMLElement) {
        const rect = tapSurface.getBoundingClientRect();
        tapSurface.style.setProperty('--tap-x', `${event.clientX - rect.left}px`);
        tapSurface.style.setProperty('--tap-y', `${event.clientY - rect.top}px`);
        tapSurface.classList.remove('tap-animate');
        window.requestAnimationFrame(() => tapSurface.classList.add('tap-animate'));
        window.setTimeout(() => tapSurface.classList.remove('tap-animate'), 450);
      }
      triggerHapticFeedback('tap');
    };

    document.addEventListener('pointerdown', handlePointerDown, { passive: true });
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!focusStartedAt || activeFocusSession?.status === 'paused') return undefined;
    const timer = window.setInterval(() => setFocusTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeFocusSession?.status, focusStartedAt]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setSyncError('');

      if (!firebaseUser) {
        lastSyncedSignatureRef.current = getCloudSyncSignature(loadState());
        setSyncStatus('尚未登入，資料目前只存在這台裝置。');
        return;
      }

      setSyncStatus('已登入，正在讀取雲端資料...');
      try {
        const cloudState = await readCloudState(firebaseUser.uid);

        if (cloudState) {
          const merged = mergeCloudState(loadState(), cloudState);
          const syncedAt = new Date().toISOString();
          const syncedState = await writeCloudState(firebaseUser.uid, merged, syncedAt);
          lastSyncedSignatureRef.current = getCloudSyncSignature(syncedState);
          isApplyingCloudStateRef.current = true;
          setIsApplyingCloudState(true);
          setState(syncedState);
          saveState(syncedState);
          setTimeout(() => {
            isApplyingCloudStateRef.current = false;
            setIsApplyingCloudState(false);
          }, 500);
          setSyncStatus('已從雲端載入資料，之後會即時同步。');
        } else {
          const localState = loadState();
          const syncedAt = new Date().toISOString();
          const nextState = normalizeState({
            ...localState,
            cloudMeta: {
              ...(localState.cloudMeta || {}),
              updatedAt: syncedAt,
              device: navigator.userAgent,
            },
          });
          saveState(nextState);
          lastSyncedSignatureRef.current = getCloudSyncSignature(nextState);
          await writeCloudState(firebaseUser.uid, nextState, syncedAt);
          setSyncStatus('已建立雲端資料，之後會即時同步。');
        }
      } catch (error) {
        setSyncError(getFirebaseErrorMessage(error));
        setSyncStatus('雲端讀取失敗，暫時使用本機資料。');
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    const ref = getCloudDocRef(user.uid);
    const unsubscribeSnapshot = onSnapshot(ref, async (snapshot) => {
      if (!snapshot.exists()) return;
      if (isApplyingCloudStateRef.current) return;

      try {
        const cloudState = await readCloudState(user.uid, snapshot);
        const localState = loadState();
        const cloudUpdatedAt = cloudState?.cloudMeta?.updatedAt;
        const localUpdatedAt = localState?.cloudMeta?.updatedAt;

        if (cloudUpdatedAt && cloudUpdatedAt !== localUpdatedAt) {
          const merged = mergeCloudState(localState, cloudState);
          lastSyncedSignatureRef.current = getCloudSyncSignature(merged);
          isApplyingCloudStateRef.current = true;
          setIsApplyingCloudState(true);
          setState(merged);
          saveState(merged);
          setTimeout(() => {
            isApplyingCloudStateRef.current = false;
            setIsApplyingCloudState(false);
          }, 500);
          setSyncStatus('已接收其他裝置的更新。');
        }
      } catch (error) {
        setSyncError(getFirebaseErrorMessage(error));
        setSyncStatus('即時同步讀取失敗。');
      }
    }, (error) => {
      setSyncError(getFirebaseErrorMessage(error));
      setSyncStatus('即時同步監聽失敗。');
    });

    return () => unsubscribeSnapshot();
  }, [user]);

  useEffect(() => {
    if (!user || isApplyingCloudState) return;
    const stateSignature = getCloudSyncSignature(state);
    if (stateSignature === lastSyncedSignatureRef.current) return;

    const timeout = setTimeout(async () => {
      const syncedAt = new Date().toISOString();
      try {
        const nextState = {
          ...state,
          cloudMeta: {
            ...(state.cloudMeta || {}),
            updatedAt: syncedAt,
            device: navigator.userAgent,
          },
        };
        saveState(nextState, ['app']);
        const syncedState = await writeCloudState(user.uid, nextState, syncedAt);
        lastSyncedSignatureRef.current = getCloudSyncSignature(syncedState);
        setSyncStatus(`已同步到雲端：${new Date().toLocaleString()}`);
      } catch (error) {
        lastSyncedSignatureRef.current = '';
        setSyncError(getFirebaseErrorMessage(error));
        setSyncStatus('同步到雲端失敗，資料仍已保存在本機。');
      }
    }, 900);

    return () => clearTimeout(timeout);
  }, [state, user, isApplyingCloudState]);

  const queueStorageSlices = useCallback((sliceNames = null) => {
    if (!sliceNames) {
      dirtyStorageSlicesRef.current = null;
      return;
    }
    if (dirtyStorageSlicesRef.current === null) return;
    const names = Array.isArray(sliceNames) ? sliceNames : [sliceNames];
    names.forEach((name) => dirtyStorageSlicesRef.current.add(name));
  }, []);

  const updateState = useCallback((updater, sliceNames = null) => {
    queueStorageSlices(sliceNames);
    setState((prev) => normalizeState(typeof updater === 'function' ? updater(prev) : updater));
  }, [queueStorageSlices]);

  const setPomodoroPreset = (presetId) => {
    if (activeFocusSession || !POMODORO_PRESETS[presetId]) return;
    updateState((prev) => ({
      ...prev,
      focusTimer: {
        ...normalizeFocusTimer(prev.focusTimer),
        selectedPreset: presetId,
      },
    }), ['activity']);
  };

  const startPomodoroSession = () => {
    if (activeFocusSession) return;
    const now = new Date();
    const preset = POMODORO_PRESETS[focusTimer.selectedPreset] || POMODORO_PRESETS.standard;
    const startedAt = now.toISOString();
    const phaseEndsAt = new Date(now.getTime() + (preset.focusMinutes * 60000)).toISOString();
    completedPomodoroPhaseRef.current = '';
    updateState((prev) => ({
      ...prev,
      focusTimer: {
        ...normalizeFocusTimer(prev.focusTimer),
        leaderboardStartedAt: startedAt,
        selectedPreset: preset.id,
        activeSession: {
          id: `pomodoro-${now.getTime()}`,
          date: TODAY,
          startedAt,
          phaseStartedAt: startedAt,
          phaseEndsAt,
          remainingSeconds: preset.focusMinutes * 60,
          source: 'pomodoro',
          preset: preset.id,
          focusMinutes: preset.focusMinutes,
          restMinutes: preset.restMinutes,
          phase: 'focus',
          status: 'running',
          ...makePlanTaskSnapshot(getTodayPlanTask(prev)),
          updatedAt: startedAt,
        },
      },
    }), ['activity']);
    setFocusTick(now.getTime());
  };

  const pausePomodoroSession = () => {
    if (activeFocusSession?.source !== 'pomodoro' || activeFocusSession.status !== 'running') return;
    const now = new Date();
    const remainingSeconds = Math.max(0, Math.ceil((new Date(activeFocusSession.phaseEndsAt).getTime() - now.getTime()) / 1000));
    updateState((prev) => ({
      ...prev,
      focusTimer: {
        ...normalizeFocusTimer(prev.focusTimer),
        activeSession: {
          ...normalizeFocusTimer(prev.focusTimer).activeSession,
          status: 'paused',
          phaseEndsAt: null,
          remainingSeconds,
          updatedAt: now.toISOString(),
        },
      },
    }), ['activity']);
    setFocusTick(now.getTime());
  };

  const resumePomodoroSession = () => {
    if (activeFocusSession?.source !== 'pomodoro' || activeFocusSession.status !== 'paused') return;
    const now = new Date();
    const remainingSeconds = Math.max(1, activeFocusSession.remainingSeconds || 1);
    updateState((prev) => ({
      ...prev,
      focusTimer: {
        ...normalizeFocusTimer(prev.focusTimer),
        activeSession: {
          ...normalizeFocusTimer(prev.focusTimer).activeSession,
          status: 'running',
          phaseEndsAt: new Date(now.getTime() + (remainingSeconds * 1000)).toISOString(),
          updatedAt: now.toISOString(),
        },
      },
    }), ['activity']);
    setFocusTick(now.getTime());
  };

  const finishFocusSession = () => {
    if (!activeFocusSession?.startedAt) return;
    const endedAt = new Date().toISOString();
    const durationSeconds = Math.max(1, Math.round((new Date(endedAt).getTime() - new Date(activeFocusSession.startedAt).getTime()) / 1000));
    const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));
    updateState((prev) => ({
      ...prev,
      focusSessions: [
        {
          id: activeFocusSession.id,
          date: activeFocusSession.date || TODAY,
          startedAt: activeFocusSession.startedAt,
          ...makePlanTaskSnapshot(questTask),
          ...activeFocusSession,
          endedAt,
          durationSeconds,
          durationMinutes,
          planTaskId: activeFocusSession.planTaskId || getPlanTaskStorageId(questTask),
          legacyPlanTaskId: activeFocusSession.legacyPlanTaskId || questTask?.id || null,
          planTopic: activeFocusSession.planTopic || questTask?.topic || '',
          planDay: activeFocusSession.planDay || questTask?.day || '',
        },
        ...(prev.focusSessions || []),
      ],
      focusTimer: {
        ...normalizeFocusTimer(prev.focusTimer),
        activeSession: null,
      },
    }), ['activity']);
    setFocusTick(new Date(endedAt).getTime());
  };

  const cancelFocusSession = () => {
    updateState((prev) => ({
      ...prev,
      focusTimer: {
        ...normalizeFocusTimer(prev.focusTimer),
        activeSession: null,
      },
    }), ['activity']);
    setFocusTick(new Date().getTime());
  };

  // Kept as a latest-state handler so overdue phases use the current synced timer snapshot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const completePomodoroPhase = () => {
    if (activeFocusSession?.source !== 'pomodoro' || activeFocusSession.status !== 'running') return;
    const phaseKey = `${activeFocusSession.id}:${activeFocusSession.phase}`;
    if (completedPomodoroPhaseRef.current === phaseKey) return;
    completedPomodoroPhaseRef.current = phaseKey;
    const now = new Date();
    const completedAt = now.toISOString();

    if (activeFocusSession.phase === 'rest') {
      updateState((prev) => ({
        ...prev,
        focusTimer: {
          ...normalizeFocusTimer(prev.focusTimer),
          activeSession: null,
        },
      }), ['activity']);
      playPomodoroCompletionFeedback();
      return;
    }

    updateState((prev) => {
      const normalizedTimer = normalizeFocusTimer(prev.focusTimer);
      const alreadyRecorded = normalizeFocusSessions(prev.focusSessions).some((session) => session.id === activeFocusSession.id);
      const currentPlanTask = getTodayPlanTask(prev);
      const completedSession = {
        id: activeFocusSession.id,
        date: activeFocusSession.date || TODAY,
        startedAt: activeFocusSession.startedAt,
        endedAt: completedAt,
        durationSeconds: activeFocusSession.focusMinutes * 60,
        durationMinutes: activeFocusSession.focusMinutes,
        source: 'pomodoro',
        preset: activeFocusSession.preset,
        completedCycles: 1,
        planTaskId: activeFocusSession.planTaskId || getPlanTaskStorageId(currentPlanTask),
        legacyPlanTaskId: activeFocusSession.legacyPlanTaskId || currentPlanTask?.id || null,
        planTopic: activeFocusSession.planTopic || currentPlanTask?.topic || '',
        planDay: activeFocusSession.planDay || currentPlanTask?.day || '',
      };
      return {
        ...prev,
        focusSessions: alreadyRecorded ? prev.focusSessions : [completedSession, ...(prev.focusSessions || [])],
        focusTimer: {
          ...normalizedTimer,
          activeSession: {
            ...normalizedTimer.activeSession,
            phase: 'rest',
            status: 'running',
            phaseStartedAt: completedAt,
            phaseEndsAt: new Date(now.getTime() + (activeFocusSession.restMinutes * 60000)).toISOString(),
            remainingSeconds: activeFocusSession.restMinutes * 60,
            updatedAt: completedAt,
          },
        },
      };
    }, ['activity']);
    playPomodoroCompletionFeedback();
    setFocusTick(now.getTime());
  };

  const pomodoroRemainingSeconds = activeFocusSession?.source === 'pomodoro'
    ? (activeFocusSession.status === 'paused'
        ? activeFocusSession.remainingSeconds
        : Math.max(0, Math.ceil((new Date(activeFocusSession.phaseEndsAt).getTime() - focusTick) / 1000)))
    : 0;

  useEffect(() => {
    if (activeFocusSession?.source !== 'pomodoro' || activeFocusSession.status !== 'running') return;
    if (pomodoroRemainingSeconds > 0) return;
    completePomodoroPhase();
  }, [activeFocusSession, pomodoroRemainingSeconds, completePomodoroPhase]);

  const updateStat = (id, nextStat) => {
    updateState((prev) => {
      const previous = getStat(prev, id);
      const latestEvent = (nextStat.answerHistory || [])[nextStat.answerHistory.length - 1];
      let game = prev.game || defaultState.game;
      if (latestEvent?.isCorrect && (previous.wrong || 0) > 0 && previous.lastRating === 'Again' && daysBetween(previous.lastAttemptAt, TODAY) <= 3) {
        game = awardXp(game, XP_RULES.wrongAgainRecovery, 'Previously wrong question corrected within 3 days', { questionId: id });
      }
      if (latestEvent?.isCorrect && (previous.highConfidenceWrong || 0) > 0) {
        game = awardXp(game, XP_RULES.highConfidenceWrongCorrected, 'High-confidence wrong corrected', { questionId: id });
      }
      return { ...prev, game, stats: { ...prev.stats, [id]: nextStat } };
    }, ['questionRecords', 'game']);
  };

  const createTrialCard = (trialName, sourceQuestion = null) => {
    if (!trialName.trim()) return;
    const card = normalizeFlashcard(buildTrialCardFromName(trialName.trim(), sourceQuestion));
    updateState((prev) => ({
      ...prev,
      flashcards: { ...normalizeFlashcards(prev.flashcards), [card.id]: card },
      flashcardStats: { ...(prev.flashcardStats || {}), [card.id]: makeFlashcardStats(card) },
    }), ['flashcards', 'flashcardStats']);
  };

  const reviewFlashcard = (cardId, rating, nextReviewSession = null, completedAt = null) => {
    const rule = FLASHCARD_RATINGS[rating] || FLASHCARD_RATINGS.Good;
    const isWrong = rating === 'Again';
    playResultFeedback(isWrong ? 'wrong' : 'correct');
    updateState((prev) => {
      const cards = normalizeFlashcards(prev.flashcards);
      const baseCardId = getFlashcardBaseId(cardId);
      const card = cards[baseCardId];
      if (!card) return prev;
      const previousStats = prev.flashcardStats?.[cardId] || prev.flashcardStats?.[baseCardId] || makeFlashcardStats(card);
      const schedule = getFlashcardReviewSchedulePreview(rating, previousStats);
      const mastery = Math.max(0, Math.min(5, (previousStats.mastery ?? card.mastery ?? 0) + rule.masteryDelta));
      const currentQuest = getDailyQuestProgress(prev, TODAY, getTodayPlanTask(prev), todayCompleted);
      const currentTask = getStudyPlanTaskById(currentQuest.planTaskId) || getTodayPlanTask(prev);
      const dailyQuestProgress = updateDailyQuestMemoryProgress(prev, TODAY, currentTask, todayCompleted, cardId, rating);
      return {
        ...prev,
        flashcards: {
          ...cards,
          [baseCardId]: {
            ...card,
            difficulty: rating === 'Again' ? Math.min(5, (card.difficulty || 3) + 0.5) : card.difficulty || 3,
            updatedAt: new Date().toISOString(),
            lastRating: rating,
          },
        },
        flashcardStats: {
          ...(prev.flashcardStats || {}),
          [cardId]: {
            ...previousStats,
            id: cardId,
            baseId: baseCardId,
            attempts: (previousStats.attempts || 0) + 1,
            correct: (previousStats.correct || 0) + (isWrong ? 0 : 1),
            wrong: (previousStats.wrong || 0) + (isWrong ? 1 : 0),
            lastRating: rating,
            lastReviewedAt: TODAY,
            intervalDays: schedule.intervalDays,
            nextReviewDate: schedule.nextReviewDate,
            mastery,
            updatedAt: new Date().toISOString(),
          },
        },
        dailyQuestProgress: {
          ...(prev.dailyQuestProgress || {}),
          [TODAY]: writeDailyQuestTask(prev, TODAY, currentTask.id, dailyQuestProgress),
        },
        activeFlashcardReview: nextReviewSession,
        activeFlashcardReviewClearedAt: completedAt || prev.activeFlashcardReviewClearedAt || null,
      };
    }, ['flashcards', 'flashcardStats', 'quest', 'activity']);
  };

  const updateActiveFlashcardReview = useCallback((review) => {
    updateState((prev) => ({
      ...prev,
      activeFlashcardReview: review,
    }), ['activity']);
  }, [updateState]);

  const updateFlashcard = (cardId, patch) => {
    updateState((prev) => {
      const cards = normalizeFlashcards(prev.flashcards);
      const card = cards[cardId];
      if (!card) return prev;
      return {
        ...prev,
        flashcards: {
          ...cards,
          [cardId]: normalizeFlashcard({
            ...card,
            ...patch,
            updatedAt: new Date().toISOString(),
          }),
        },
      };
    }, ['flashcards']);
  };

  const deleteFlashcard = (cardId) => {
    updateState((prev) => {
      const cards = normalizeFlashcards(prev.flashcards);
      if (!cards[cardId]) return prev;
      const nextCards = { ...cards };
      const nextStats = { ...(prev.flashcardStats || {}) };
      delete nextCards[cardId];
      delete nextStats[cardId];
      Object.keys(nextStats).forEach((statId) => {
        if (statId.startsWith(`${cardId}::c`)) delete nextStats[statId];
      });
      return {
        ...prev,
        flashcards: nextCards,
        flashcardStats: nextStats,
        deletedFlashcardIds: {
          ...(prev.deletedFlashcardIds || {}),
          [cardId]: new Date().toISOString(),
        },
      };
    }, ['flashcards', 'flashcardStats']);
  };

  const importFlashcards = (rawJson) => {
    try {
      const parsed = JSON.parse(rawJson);
      if (!Array.isArray(parsed)) {
        return { ok: false, message: '請貼上 JSON array。' };
      }

      const now = new Date().toISOString();
      const cards = parsed.map((item, index) => {
        if (!item?.front || !item?.back) {
          throw new Error(`第 ${index + 1} 張卡缺少 front/back。`);
        }
        const type = normalizeFlashcardType(item.type, item.sourceType);
        return {
          id: `fc-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
          sourceType: item.sourceType || (type === 'Trial Card' ? 'trial' : 'manual'),
          sourceId: item.sourceQuestionId || item.sourceId || null,
          sourceQuestionId: item.sourceQuestionId || item.sourceId || null,
          cancer: item.cancer || 'Imported',
          topic: item.topic || item.type || 'Imported flashcard',
          front: String(item.front),
          back: String(item.back),
          cloze: item.cloze || '',
          trial: normalizeTextList(item.trial),
          tags: normalizeTextList(item.tags),
          examValue: normalizeExamValue(item.examValue),
          errorType: normalizeFlashcardErrorType(item.errorType),
          notionPageId: item.notionPageId || null,
          notionUrl: item.notionUrl || '',
          sourceTitle: item.sourceTitle || '',
          sourceEvidence: item.sourceEvidence || '',
          intervalDays: 1,
          nextReviewDate: TODAY,
          mastery: 0,
          difficulty: item.difficulty || 3,
          type,
          createdAt: now,
          updatedAt: now,
        };
      });

      updateState((prev) => ({
        ...prev,
        flashcards: { ...normalizeFlashcards(prev.flashcards), ...cardsToMap(cards) },
        flashcardStats: {
          ...(prev.flashcardStats || {}),
          ...Object.fromEntries(cards.map((card) => [card.id, makeFlashcardStats(card, now)])),
        },
      }), ['flashcards', 'flashcardStats']);
      return { ok: true, message: `已匯入 ${cards.length} 張卡。` };
    } catch (error) {
      return { ok: false, message: error.message || 'JSON 格式錯誤，沒有匯入任何卡片。' };
    }
  };

  const importNotionLearningDrafts = ({ artifactType, note, items }) => {
    if (!Array.isArray(items) || !items.length) {
      return { ok: false, message: '沒有已核准的 learning draft。' };
    }

    if (artifactType !== 'quiz') {
      const existingKeys = new Set(Object.values(normalizeFlashcards(latestStateRef.current.flashcards))
        .map((card) => canonicalLearningText(card.front)));
      const batchKeys = new Set();
      const newItems = items.filter((item) => {
        const key = canonicalLearningText(item.front);
        if (!key || existingKeys.has(key) || batchKeys.has(key)) return false;
        batchKeys.add(key);
        return true;
      });
      if (!newItems.length) return { ok: false, message: '所有草稿都已存在，沒有匯入。' };
      const result = importFlashcards(JSON.stringify(newItems));
      const skipped = items.length - newItems.length;
      return {
        ...result,
        message: result.ok
          ? `已加入 ${newItems.length} 張卡到 Card Manager${skipped ? `；略過 ${skipped} 個重複項目` : ''}。`
          : result.message,
      };
    }

    const existingQuestionKeys = new Set(getQuestionPool(latestStateRef.current)
      .map((question) => canonicalLearningText(question.stem)));
    const batchKeys = new Set();
    const newItems = items.filter((item) => {
      const key = canonicalLearningText(item.stem);
      if (!key || existingQuestionKeys.has(key) || batchKeys.has(key)) return false;
      batchKeys.add(key);
      return true;
    });
    if (!newItems.length) return { ok: false, message: '所有草稿題目都已存在，沒有匯入。' };

    const now = new Date().toISOString();
    const safePageId = String(note?.id || 'note').replace(/[^a-zA-Z0-9]/g, '').slice(-16) || 'note';
    const questionsToAdd = newItems.map((item, index) => normalizeQuestion({
      ...item,
      id: `custom-notion-${safePageId}-${Date.now()}-${index}`,
      year: 'Generated',
      number: null,
      sourceType: 'custom',
      provenance: 'notion-generated',
      updatedAt: now,
    }));
    updateState((prev) => ({
      ...prev,
      customQuestions: {
        ...(prev.customQuestions || {}),
        ...Object.fromEntries(questionsToAdd.map((question) => [question.id, question])),
      },
      deletedQuestionIds: {
        ...(prev.deletedQuestionIds || {}),
        ...Object.fromEntries(questionsToAdd.map((question) => [question.id, false])),
      },
    }), ['questionEdits']);
    const skipped = items.length - newItems.length;
    return {
      ok: true,
      message: `已加入 ${questionsToAdd.length} 題到 Question Manager${skipped ? `；略過 ${skipped} 個重複項目` : ''}。`,
    };
  };

  const saveQuestionOverride = (id, override) => {
    updateState((prev) => {
      const nextOverrides = { ...(prev.questionOverrides || {}) };
      if (override && Object.keys(override).length) {
        nextOverrides[id] = override;
      } else {
        delete nextOverrides[id];
      }
      return { ...prev, questionOverrides: nextOverrides };
    }, ['questionEdits']);
  };

  const saveCustomQuestion = (question) => {
    const normalized = normalizeQuestion({
      ...question,
      id: question.id || makeCustomQuestionId(),
      sourceType: 'custom',
      updatedAt: new Date().toISOString(),
    });
    updateState((prev) => ({
      ...prev,
      customQuestions: {
        ...(prev.customQuestions || {}),
        [normalized.id]: normalized,
      },
      deletedQuestionIds: {
        ...(prev.deletedQuestionIds || {}),
        [normalized.id]: false,
      },
    }), ['questionEdits']);
  };

  const deleteQuestion = (id) => {
    updateState((prev) => {
      const nextCustom = { ...(prev.customQuestions || {}) };
      const nextOverrides = { ...(prev.questionOverrides || {}) };
      const nextDeleted = { ...(prev.deletedQuestionIds || {}) };

      if (nextCustom[id]) {
        delete nextCustom[id];
        delete nextDeleted[id];
      } else {
        nextDeleted[id] = true;
      }
      delete nextOverrides[id];

      return {
        ...prev,
        customQuestions: nextCustom,
        questionOverrides: nextOverrides,
        deletedQuestionIds: nextDeleted,
      };
    }, ['questionEdits']);
  };

  const loginWithEmail = async (email, password) => {
    setSyncError('');
    setSyncStatus('登入中...');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setSyncError(getFirebaseErrorMessage(error));
      setSyncStatus('登入失敗。');
    }
  };

  const registerWithEmail = async (email, password) => {
    setSyncError('');
    setSyncStatus('建立帳號中...');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setSyncError(getFirebaseErrorMessage(error));
      setSyncStatus('建立帳號失敗。');
    }
  };

  const logoutCloud = async () => {
    await signOut(auth);
    setUser(null);
    setSyncStatus('已登出，資料目前只存在這台裝置。');
  };

  const pushLocalToCloud = async () => {
    if (!user) return;
    setSyncError('');
    try {
      const localState = loadState();
      const syncedAt = new Date().toISOString();
      const nextState = normalizeState({
        ...localState,
        cloudMeta: {
          ...(localState.cloudMeta || {}),
          updatedAt: syncedAt,
          device: navigator.userAgent,
        },
      });
      saveState(nextState);
      lastSyncedSignatureRef.current = getCloudSyncSignature(nextState);
      await writeCloudState(user.uid, nextState, syncedAt);
      setSyncStatus('已把本機資料上傳到雲端。');
    } catch (error) {
      setSyncError(getFirebaseErrorMessage(error));
      setSyncStatus('上傳雲端失敗。');
    }
  };

  const pullCloudToLocal = async () => {
    if (!user) return;
    setSyncError('');
    try {
      const cloudState = await readCloudState(user.uid);
      if (!cloudState) {
        setSyncStatus('雲端目前沒有資料。');
        return;
      }
      const merged = mergeCloudState(defaultState, cloudState);
      lastSyncedSignatureRef.current = getCloudSyncSignature(merged);
      isApplyingCloudStateRef.current = true;
      setIsApplyingCloudState(true);
      setState(merged);
      saveState(merged);
      setTimeout(() => {
        isApplyingCloudStateRef.current = false;
        setIsApplyingCloudState(false);
      }, 500);
      setSyncStatus('已從雲端覆蓋本機資料。');
    } catch (error) {
      setSyncError(getFirebaseErrorMessage(error));
      setSyncStatus('下載雲端資料失敗。');
    }
  };

  const questionDataState = useMemo(() => ({
    questionBankVersion,
    stats: state.stats,
    sessions: state.sessions,
    questionOverrides: state.questionOverrides,
    customQuestions: state.customQuestions,
    deletedQuestionIds: state.deletedQuestionIds,
  }), [questionBankVersion, state.stats, state.sessions, state.questionOverrides, state.customQuestions, state.deletedQuestionIds]);
  const flashcardDataState = useMemo(() => ({
    flashcards: state.flashcards,
    flashcardStats: state.flashcardStats,
    deletedFlashcardIds: state.deletedFlashcardIds,
  }), [state.flashcards, state.flashcardStats, state.deletedFlashcardIds]);
  const baseQuestTask = getTodayPlanTask(state);
  const rawTodayIds = todaySession?.questionIds || EMPTY_ARRAY;
  const todaySessionPlanTaskId = todaySession?.planTaskId || null;
  const todaySessionMatchesQuest = getStudyPlanTaskById(todaySessionPlanTaskId) === baseQuestTask
    || getStudyPlanTaskById(todaySession?.legacyPlanTaskId) === baseQuestTask;
  const todayIds = todaySessionMatchesQuest ? rawTodayIds : EMPTY_ARRAY;
  const todayQuestions = todayIds.map((id) => getQuestionWithOverride(id, questionDataState)).filter(Boolean);
  const selectedPracticeMode = state.settings?.practiceMode || 'standard';
  const selectedPracticeConfig = getPracticeModeConfig(selectedPracticeMode);
  const todayPracticeMode = todaySession?.practiceMode || selectedPracticeMode;
  const baseTodayPracticeConfig = getPracticeModeConfig(todayPracticeMode);
  const todayPracticeConfig = todaySession?.practiceTargetCount
    ? { ...baseTodayPracticeConfig, total: todaySession.practiceTargetCount }
    : baseTodayPracticeConfig;
  const todayPracticeTargetCount = todayPracticeConfig.total;
  const todayPracticeTargetIds = todayIds.slice(0, todayPracticeTargetCount);
  const dailyBatchSubmitted = Boolean(todaySession?.submittedAt && todaySession?.gradingResults?.length);
  const dailyBatchResults = todaySession?.gradingResults || EMPTY_ARRAY;
  const dailyGradeableResults = dailyBatchResults.filter((result) => result.isCorrect != null);
  const dailyBatchAttemptsRecorded = dailyGradeableResults.length > 0 && dailyGradeableResults.every((result) => (
    (getStat(state, result.questionId).answerHistory || []).some((event) => event?.attemptId === todaySession?.attemptId)
  ));
  const dailyBatchNotesSynced = dailyBatchResults.every((result) => {
    const stat = getStat(state, result.questionId);
    const event = (stat.answerHistory || []).find((item) => item?.attemptId === todaySession?.attemptId);
    if (!event) return true;
    const draft = todaySession?.practiceDrafts?.[result.questionId] || {};
    const explanation = draft.explanation ?? result.explanation;
    const wrongNotes = draft.wrongNotes ?? result.wrongNotes;
    return (explanation === undefined || (stat.explanation === explanation && event.explanation === explanation))
      && (wrongNotes === undefined || (stat.wrongNotes === wrongNotes && event.wrongNotes === wrongNotes));
  });
  const dailyBatchCorrect = dailyBatchResults.filter((result) => result.isCorrect).length;
  const dailyBatchWrong = dailyBatchResults.filter((result) => result.isCorrect === false).length;
  const dailyBatchPending = dailyBatchResults.filter((result) => result.isCorrect == null).length;
  const dailyWrongClassified = dailyBatchResults.filter((result) => (
    result.isCorrect === false && (result.errorType || todaySession?.practiceDrafts?.[result.questionId]?.errorType)
  )).length;
  const dailyBatchClassificationComplete = dailyBatchSubmitted && dailyBatchResults.every((result) => (
    result.isCorrect === true || (result.isCorrect === false && (result.errorType || todaySession?.practiceDrafts?.[result.questionId]?.errorType))
  ));
  const todayRatedCount = todayPracticeTargetIds.filter((id) => hasDailyPracticeRating(state, id, TODAY)).length;
  const firstIncompletePracticeIndex = todayPracticeTargetIds.findIndex((id) => !hasDailyPracticeRating(state, id, TODAY));
  const firstIncompletePracticeId = firstIncompletePracticeIndex >= 0 ? todayPracticeTargetIds[firstIncompletePracticeIndex] : null;
  const todayCompleted = todaySessionMatchesQuest
    && todayPracticeTargetCount > 0
    && todayPracticeTargetIds.length >= todayPracticeTargetCount
    && todayRatedCount >= todayPracticeTargetCount
    && (!dailyBatchSubmitted || dailyBatchClassificationComplete);
  const questProgress = getDailyQuestProgress(state, TODAY, baseQuestTask, todayCompleted);
  const questTask = getStudyPlanTaskById(questProgress.planTaskId) || baseQuestTask;
  const todayFocusMinutes = sumFocusMinutesByDate(state, TODAY);
  const focusStreak = getFocusStreak(state, TODAY);
  const leaderboardFocusMinutes = todayFocusMinutes;
  const leaderboardElapsedSeconds = focusStartedAt ? Math.max(0, Math.floor((focusTick - leaderboardStartedAt) / 1000)) : 0;
  const focusLeaderboardRows = useMemo(
    () => buildFocusLeaderboard(leaderboardFocusMinutes, leaderboardElapsedSeconds),
    [leaderboardFocusMinutes, leaderboardElapsedSeconds]
  );
  const currentPracticePage = Math.min(practicePage, Math.max(0, Math.ceil(todayQuestions.length / PRACTICE_PAGE_SIZE) - 1));
  const visibleTodayQuestions = todayQuestions.slice(currentPracticePage * PRACTICE_PAGE_SIZE, (currentPracticePage + 1) * PRACTICE_PAGE_SIZE);
  const totalPracticePages = Math.ceil(todayPracticeConfig.total / PRACTICE_PAGE_SIZE);
  const questRecallCards = tab === 'quest' ? getQuestMemoryCards(flashcardDataState, questTask) : EMPTY_ARRAY;
  const questReviewHistory = tab === 'quest' ? getQuestReviewHistory(state, flashcardDataState) : EMPTY_ARRAY;
  const questBossChallenges = tab === 'quest' ? buildBossChallenges(questTask, questionDataState) : EMPTY_ARRAY;
  const highYieldTopics = tab === 'quest' || tab === 'today' ? getRankedHighYieldTopics(questionDataState, questTask) : EMPTY_ARRAY;
  const todayHighValueCards = tab === 'quest' ? getHighValueCardsCreatedToday(flashcardDataState) : EMPTY_ARRAY;
  const todayErrorTypeStatus = tab === 'quest' ? getDailyWrongErrorTypeStatus(questionDataState, todayIds) : {
    wrongRatedCount: 0,
    classifiedCount: 0,
    complete: true,
  };
  const completionStatus = [
    {
      label: 'Daily Practice completed',
      done: todayCompleted,
      detail: todayCompleted ? '今日題目都已評分。' : `${todayRatedCount}/${todayPracticeTargetCount} 題已評分。`,
    },
    {
      label: 'Boss 1-3 at least 2 pass',
      done: questProgress.bossDone,
      detail: `${Object.values(questProgress.bossResults || {}).filter(Boolean).length}/3 passed.`,
    },
    {
      label: 'Create 3-5 high-value cards',
      done: todayHighValueCards.length >= 3,
      detail: `${todayHighValueCards.length}/3 high-value cards created today.`,
    },
    {
      label: 'Wrong answers classified by errorType',
      done: todayErrorTypeStatus.complete,
      detail: todayErrorTypeStatus.wrongRatedCount
        ? `${todayErrorTypeStatus.classifiedCount}/${todayErrorTypeStatus.wrongRatedCount} wrong answers classified.`
        : 'No wrong rated answers yet.',
    },
  ];

  const updatePracticeDraft = (questionId, patch) => {
    updateState((prev) => {
      const sess = prev.sessions?.[TODAY] || {};
      const drafts = { ...(sess.practiceDrafts || {}) };
      const current = drafts[questionId] || {};
      const nextDraft = { ...current, ...patch };

      const same =
        current.selected === nextDraft.selected &&
        current.revealed === nextDraft.revealed &&
        current.correctAnswer === nextDraft.correctAnswer &&
        current.explanation === nextDraft.explanation &&
        current.wrongNotes === nextDraft.wrongNotes &&
        current.confidence === nextDraft.confidence &&
        current.errorType === nextDraft.errorType &&
        current.rated === nextDraft.rated &&
        current.rating === nextDraft.rating;

      if (same) return prev;

      drafts[questionId] = nextDraft;

      let gradingResults = sess.gradingResults || [];
      let nextStats = prev.stats;
      const hasNotePatch = patch.explanation !== undefined || patch.wrongNotes !== undefined;
      if (sess.submittedAt && (patch.correctAnswer !== undefined || patch.rating !== undefined || hasNotePatch)) {
        gradingResults = gradingResults.map((result) => result.questionId === questionId ? {
          ...result,
          ...(patch.correctAnswer !== undefined ? {
            correctAnswer: String(patch.correctAnswer || '').trim().toUpperCase(),
            isCorrect: patch.correctAnswer ? result.selected === String(patch.correctAnswer).trim().toUpperCase() : null,
          } : {}),
          ...(patch.rating !== undefined ? { rating: patch.rating } : {}),
          ...(patch.explanation !== undefined ? { explanation: patch.explanation } : {}),
          ...(patch.wrongNotes !== undefined ? { wrongNotes: patch.wrongNotes } : {}),
        } : result);
        const updatedResult = gradingResults.find((result) => result.questionId === questionId);
        if ((patch.correctAnswer !== undefined || patch.rating !== undefined) && updatedResult?.isCorrect != null) {
          nextStats = regradeBatchQuestionResult(nextStats, updatedResult, 'daily', sess.attemptId);
        }
        if (hasNotePatch) nextStats = applyBatchQuestionNotes(nextStats, questionId, sess.attemptId, patch);
      }

      return {
        ...prev,
        stats: nextStats,
        sessions: {
          ...(prev.sessions || {}),
          [TODAY]: {
            ...sess,
            practiceDrafts: drafts,
            gradingResults,
          },
        },
      };
    }, patch.correctAnswer !== undefined || patch.rating !== undefined || patch.explanation !== undefined || patch.wrongNotes !== undefined ? ['stats', 'sessions'] : ['sessions']);
  };

  const submitDailyPractice = () => {
    if (dailyBatchSubmitted) return;
    if (todayPracticeTargetIds.length < todayPracticeTargetCount) {
      setPracticePageMessage(`請先載入全部 ${todayPracticeTargetCount} 題再交卷。`);
      return;
    }
    const missingIndex = todayPracticeTargetIds.findIndex((id) => !todaySession?.practiceDrafts?.[id]?.selected);
    if (missingIndex >= 0) {
      setPracticePage(Math.floor(missingIndex / PRACTICE_PAGE_SIZE));
      setPracticePageMessage(`第 ${missingIndex + 1} 題尚未作答，已跳到該題。`);
      window.setTimeout(() => {
        document.querySelector(`[data-question-id="${todayPracticeTargetIds[missingIndex]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return;
    }

    const submittedAt = new Date().toISOString();
    const attemptId = `daily-${TODAY}-${todaySession?.createdAt || submittedAt}`;
    const gradingResults = todayPracticeTargetIds.map((id) => {
      const question = getQuestionWithOverride(id, questionDataState);
      const draft = todaySession?.practiceDrafts?.[id] || {};
      const selected = String(draft.selected || '').trim().toUpperCase();
      const correctAnswer = String(draft.correctAnswer || question?.answer || getStat(state, id).correctAnswer || '').trim().toUpperCase();
      return {
        questionId: id,
        selected,
        correctAnswer,
        isCorrect: correctAnswer ? selected === correctAnswer : null,
        confidence: Number(draft.confidence) || 3,
        explanation: draft.explanation ?? question?.explanation ?? '',
        wrongNotes: draft.wrongNotes ?? '',
        cancer: question?.cancer,
        topic: question?.topic,
        submittedAt,
      };
    });

    updateState((prev) => {
      const existingSession = prev.sessions?.[TODAY] || {};
      if (existingSession.attemptsCommittedAt) return prev;
      return {
        ...prev,
        stats: applyBatchQuestionResults(prev.stats, gradingResults, 'daily', attemptId),
        sessions: {
          ...(prev.sessions || {}),
          [TODAY]: {
            ...existingSession,
            attemptId,
            submittedAt,
            gradingResults,
            attemptsCommittedAt: submittedAt,
            statsCommittedAt: null,
          },
        },
      };
    }, ['stats', 'sessions']);
    setPracticePage(0);
    setPracticePageMessage('已整份交卷。請逐題查看答案，並完成所有錯題的錯因分類。');
  };

  const finalizeDailyPractice = () => {
    if (!dailyBatchSubmitted || (todaySession?.statsCommittedAt && dailyBatchAttemptsRecorded)) return;
    const results = dailyBatchResults.map((result) => ({
      ...result,
      errorType: result.isCorrect === false ? (result.errorType || todaySession?.practiceDrafts?.[result.questionId]?.errorType || '') : '',
    }));
    const missingCorrectAnswer = results.find((result) => result.isCorrect == null);
    if (missingCorrectAnswer) {
      const missingIndex = todayPracticeTargetIds.indexOf(missingCorrectAnswer.questionId);
      setPracticePage(Math.max(0, Math.floor(missingIndex / PRACTICE_PAGE_SIZE)));
      setPracticePageMessage('仍有題目尚未設定正解，已跳到該題。');
      return;
    }
    const missingError = results.find((result) => !result.isCorrect && !result.errorType);
    if (missingError) {
      const missingIndex = todayPracticeTargetIds.indexOf(missingError.questionId);
      setPracticePage(Math.max(0, Math.floor(missingIndex / PRACTICE_PAGE_SIZE)));
      setPracticePageMessage('仍有錯題尚未選擇錯因，已跳到該題。');
      return;
    }
    const committedAt = new Date().toISOString();
    updateState((prev) => {
      const session = prev.sessions?.[TODAY] || {};
      const attemptsRecorded = results.every((result) => (
        (prev.stats?.[result.questionId]?.answerHistory || []).some((event) => event?.attemptId === session.attemptId)
      ));
      if (session.statsCommittedAt && attemptsRecorded) return prev;
      const attemptStats = attemptsRecorded ? prev.stats : applyBatchQuestionResults(prev.stats, results, 'daily', session.attemptId);
      return {
        ...prev,
        stats: applyBatchRemediationsToStats(attemptStats, results, session.attemptId),
        sessions: {
          ...(prev.sessions || {}),
          [TODAY]: { ...session, gradingResults: results, attemptsCommittedAt: session.attemptsCommittedAt || committedAt, statsCommittedAt: committedAt, completed: true },
        },
      };
    }, ['stats', 'sessions']);
    setPracticePageMessage('錯因訂正已完成，答題結果已寫入統計。');
  };

  useEffect(() => {
    if (!dailyBatchSubmitted || !dailyGradeableResults.length || dailyBatchAttemptsRecorded) return;
    updateState((prev) => {
      const session = prev.sessions?.[TODAY] || {};
      const repairedStats = applyBatchQuestionResults(prev.stats, session.gradingResults || [], 'daily', session.attemptId);
      return {
        ...prev,
        stats: repairedStats,
        sessions: {
          ...(prev.sessions || {}),
          [TODAY]: { ...session, attemptsCommittedAt: session.attemptsCommittedAt || new Date().toISOString() },
        },
      };
    }, ['stats', 'sessions']);
  }, [dailyBatchAttemptsRecorded, dailyBatchSubmitted, dailyGradeableResults.length, updateState]);

  useEffect(() => {
    if (!dailyBatchSubmitted || dailyBatchNotesSynced) return;
    updateState((prev) => {
      const session = prev.sessions?.[TODAY] || {};
      const results = (session.gradingResults || []).map((result) => {
        const draft = session.practiceDrafts?.[result.questionId] || {};
        return {
          ...result,
          explanation: draft.explanation ?? result.explanation,
          wrongNotes: draft.wrongNotes ?? result.wrongNotes,
        };
      });
      const stats = results.reduce((nextStats, result) => applyBatchQuestionNotes(
        nextStats,
        result.questionId,
        session.attemptId,
        { explanation: result.explanation, wrongNotes: result.wrongNotes },
      ), prev.stats);
      return {
        ...prev,
        stats,
        sessions: {
          ...(prev.sessions || {}),
          [TODAY]: { ...session, gradingResults: results },
        },
      };
    }, ['stats', 'sessions']);
  }, [dailyBatchNotesSynced, dailyBatchSubmitted, updateState]);

  const createTodaySession = ({ force = false } = {}) => {
    if (isCreatingPracticeRef.current) return;
    isCreatingPracticeRef.current = true;
    setIsCreatingPractice(true);
    setPracticePageMessage('');

    window.setTimeout(async () => {
      try {
        const ready = await ensureQuestionYearsReady(preferredQuestionYears);
        if (!ready) {
          setPracticePageMessage('題庫載入失敗，請重新整理後再試。');
          return;
        }

        await new Promise((resolve) => window.requestAnimationFrame(resolve));
        updateState((prev) => {
          const modeConfig = getPracticeModeConfig(prev.settings?.practiceMode);
          const existing = prev.sessions?.[TODAY];
          const existingMatchesQuest = getStudyPlanTaskById(existing?.planTaskId) === questTask
            || getStudyPlanTaskById(existing?.legacyPlanTaskId) === questTask;
          const existingQuestionIds = existingMatchesQuest ? (existing?.questionIds || []) : [];
          const targetCount = force ? modeConfig.total : Math.min(modeConfig.total, Math.max(PRACTICE_PAGE_SIZE, existingQuestionIds.length));
          const rankedHighYieldTopics = getRankedHighYieldTopics(prev, questTask);
          const questionIds = fillDailyQuestionIds(prev, questTask, force ? [] : existingQuestionIds, targetCount, rankedHighYieldTopics);
          if (!force && existingQuestionIds.length >= targetCount && existingMatchesQuest) return prev;
          return {
            ...prev,
            sessions: {
              ...prev.sessions,
              [TODAY]: {
                ...(force ? {} : existing),
                date: TODAY,
                ...makePlanTaskSnapshot(questTask),
                practiceMode: prev.settings?.practiceMode || 'standard',
                practiceModeLabel: modeConfig.shortLabel,
                practiceRecipe: {
                  total: modeConfig.total,
                  newCount: modeConfig.newCount,
                  topicCount: modeConfig.topicCount,
                  dueCount: modeConfig.dueCount,
                  weaknessCount: modeConfig.weaknessCount,
                  highYieldCount: modeConfig.highYieldCount || 0,
                },
                highYieldInserts: rankedHighYieldTopics.slice(0, 5).map(({ id, label, type, priorityScore }) => ({ id, label, type, priorityScore })),
                questionIds,
                createdAt: force || !existing?.createdAt ? new Date().toISOString() : existing.createdAt,
                updatedAt: new Date().toISOString(),
                completed: false,
                practiceDrafts: force ? {} : (existing?.practiceDrafts || {}),
              },
            },
          };
        }, ['sessions']);
        setPracticePage(0);
        setTab('today');
      } finally {
        isCreatingPracticeRef.current = false;
        setIsCreatingPractice(false);
      }
    }, 0);
  };

  const loadNextPracticePage = async () => {
    setPracticePageMessage('');
    const ready = await ensureQuestionYearsReady(preferredQuestionYears);
    if (!ready) {
      setPracticePageMessage('題庫載入失敗，請重新整理後再試。');
      return;
    }
    const nextPage = currentPracticePage + 1;
    const requiredCount = Math.min(todayPracticeConfig.total, (nextPage + 1) * PRACTICE_PAGE_SIZE);
    if (todayQuestions.length >= requiredCount) {
      setPracticePage(nextPage);
      return;
    }
    if (todayQuestions.length >= todayPracticeConfig.total) {
      setPracticePageMessage('已經載入目前模式的全部題目。');
      return;
    }

    let loadedMore = false;
    updateState((prev) => {
      const existing = prev.sessions?.[TODAY];
      const existingMatchesQuest = getStudyPlanTaskById(existing?.planTaskId) === questTask
        || getStudyPlanTaskById(existing?.legacyPlanTaskId) === questTask;
      if (!existingMatchesQuest) return prev;
      const existingQuestionIds = existing?.questionIds || [];
      const targetCount = Math.min(todayPracticeConfig.total, (nextPage + 1) * PRACTICE_PAGE_SIZE);
      const rankedHighYieldTopics = getRankedHighYieldTopics(prev, questTask);
      const questionIds = fillDailyQuestionIds(prev, questTask, existingQuestionIds, targetCount, rankedHighYieldTopics);
      if (questionIds.length <= existingQuestionIds.length) return prev;
      loadedMore = true;

      return {
        ...prev,
        sessions: {
          ...(prev.sessions || {}),
          [TODAY]: {
            ...existing,
            questionIds,
            completed: false,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    }, ['sessions']);
    if (loadedMore) {
      setPracticePage(nextPage);
    } else {
      setPracticePageMessage('目前篩選條件下沒有更多題目可載入。可到 Settings 清除癌別/年份篩選，或按重新抽題。');
    }
  };

  const openFirstIncompletePracticeQuestion = () => {
    if (!todaySessionMatchesQuest || todayPracticeTargetIds.length === 0) {
      createTodaySession();
      return true;
    }

    if (!firstIncompletePracticeId) return false;

    const page = Math.floor(firstIncompletePracticeIndex / PRACTICE_PAGE_SIZE);
    setTab('today');
    setPracticePage(page);
    setPracticePageMessage(`還有 ${todayPracticeTargetCount - todayRatedCount} 題未完成；已跳到第 ${firstIncompletePracticeIndex + 1} 題。`);
    window.setTimeout(() => {
      document
        .querySelector(`[data-question-id="${firstIncompletePracticeId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return true;
  };

  const claimDailyCompletion = () => {
    if (state.game?.dailyClaims?.[TODAY]) return;
    if (!todayCompleted) {
      openFirstIncompletePracticeQuestion();
      return;
    }
    updateState((prev) => {
      const session = prev.sessions?.[TODAY] || {};
      const results = (session.gradingResults || []).map((result) => ({
        ...result,
        errorType: result.isCorrect ? '' : (result.errorType || session.practiceDrafts?.[result.questionId]?.errorType || ''),
      }));
      const attemptId = session.attemptId;
      const attemptsRecorded = results.length > 0 && results.every((result) => (
        (prev.stats?.[result.questionId]?.answerHistory || []).some((event) => event?.attemptId === attemptId)
      ));
      const attemptStats = results.length && !attemptsRecorded
        ? applyBatchQuestionResults(prev.stats, results, 'daily', attemptId)
        : prev.stats;
      const nextStats = results.length ? applyBatchRemediationsToStats(attemptStats, results, attemptId) : attemptStats;
      const claimedAt = new Date().toISOString();
      return {
        ...prev,
        stats: nextStats,
        sessions: {
          ...(prev.sessions || {}),
          [TODAY]: {
            ...session,
            ...makePlanTaskSnapshot(questTask),
            gradingResults: results.length ? results : session.gradingResults,
            attemptsCommittedAt: session.attemptsCommittedAt || (results.length ? claimedAt : null),
            statsCommittedAt: session.statsCommittedAt || (results.length ? claimedAt : null),
            completed: true,
          },
        },
        game: {
          ...awardXp(prev.game || defaultState.game, getPracticeModeConfig(session.practiceMode).xp, `${getPracticeModeConfig(session.practiceMode).shortLabel} Daily Practice completed`, { date: TODAY, practiceMode: session.practiceMode || 'standard' }),
          streak: (prev.game?.streak || 0) + 1,
          dailyClaims: { ...(prev.game?.dailyClaims || {}), [TODAY]: true },
        },
      };
    }, ['stats', 'sessions', 'game']);
  };

  const markDailyCheckIn = () => {
    if (getDailyCheckInStatus(state, TODAY)) return;
    playTaskCompletionFeedback();
    updateState((prev) => ({
      ...prev,
      game: {
        ...(prev.game || defaultState.game),
        dailyCheckIns: {
          ...(prev.game?.dailyCheckIns || {}),
          [TODAY]: { checkedAt: new Date().toISOString() },
        },
      },
    }), ['game']);
  };

  const claimDailyChest = () => {
    if (dailyChest.progress < 100 || dailyChest.claimed) return;
    playTaskCompletionFeedback();
    updateState((prev) => {
      const nextGame = awardXp(prev.game || defaultState.game, 80, 'Daily Chest opened', { date: TODAY, reward: 'daily-chest' });
      return {
        ...prev,
        game: {
          ...nextGame,
          dailyChests: {
            ...(prev.game?.dailyChests || {}),
            [TODAY]: true,
          },
          trialGems: (prev.game?.trialGems || 0) + 1,
        },
      };
    }, ['game']);
  };

  const markQuestRecall = (card) => {
    const cardId = typeof card === 'string' ? card : card.id;
    playResultFeedback('correct');
    updateState((prev) => {
      const next = updateDailyQuestMemoryProgress(prev, TODAY, questTask, todayCompleted, cardId, 'Read');
      return {
        ...prev,
        dailyQuestProgress: {
          ...(prev.dailyQuestProgress || {}),
          [TODAY]: writeDailyQuestTask(prev, TODAY, getPlanTaskStorageId(questTask), next),
        },
      };
    }, ['quest']);
  };

  const setQuestBossResult = (bossId, passed) => {
    playResultFeedback(passed ? 'correct' : 'wrong');
    updateState((prev) => {
      const current = getDailyQuestProgress(prev, TODAY, questTask, todayCompleted);
      const nextResults = { ...(current.bossResults || {}), [bossId]: passed };
      const passCount = Object.values(nextResults).filter(Boolean).length;
      const bossDone = passCount >= 2;
      const next = {
        ...current,
        bossResults: nextResults,
        bossDone,
        perfectClear: passCount === 3,
        failedMasteryReviewDate: passCount <= 1 && Object.keys(nextResults).length === 3 ? addDays(TODAY, 1) : current.failedMasteryReviewDate,
      };
      next.stars = [next.practiceDone, next.memoryDone, next.bossDone].filter(Boolean).length;
      return {
        ...prev,
        bossProgress: {
          ...(prev.bossProgress || {}),
          [TODAY]: {
            ...makePlanTaskSnapshot(questTask),
            results: nextResults,
            passed: passCount,
            bossDone,
            perfectClear: passCount === 3,
          },
        },
        dailyQuestProgress: {
          ...(prev.dailyQuestProgress || {}),
          [TODAY]: writeDailyQuestTask(prev, TODAY, getPlanTaskStorageId(questTask), next),
        },
      };
    }, ['quest']);
  };

  const claimStageClear = () => {
    const current = getDailyQuestProgress(state, TODAY, questTask, todayCompleted);
    if (current.stars < 3 || current.xpClaimed) return;
    updateState((prev) => {
      const currentProgress = getDailyQuestProgress(prev, TODAY, questTask, todayCompleted);
      if (currentProgress.xpClaimed || currentProgress.stars < 3) return prev;
      const awardedGame = awardXp(prev.game || defaultState.game, XP_RULES.stageClear, 'Daily quest stage clear', { date: TODAY, taskId: getPlanTaskStorageId(questTask), legacyTaskId: questTask.id });
      const nextGame = {
        ...awardedGame,
        streak: (prev.game?.streak || 0) + 1,
      };
      const nextPlayer = {
        ...(prev.player || defaultState.player),
        xp: nextGame.xp,
        level: nextGame.level,
        streak: nextGame.streak,
        badges: nextGame.badges || [],
      };
      return {
        ...prev,
        game: nextGame,
        player: nextPlayer,
        planProgress: makePlanProgressEntry(prev.planProgress, questTask, true),
        dailyQuestProgress: {
          ...(prev.dailyQuestProgress || {}),
          [TODAY]: writeDailyQuestTask(prev, TODAY, getPlanTaskStorageId(questTask), {
            ...currentProgress,
            practiceDone: true,
            memoryDone: true,
            bossDone: true,
            stars: 3,
            xpClaimed: true,
            stageClearedAt: new Date().toISOString(),
          }),
        },
      };
    }, ['game', 'progress', 'quest']);
  };

  const regenerateTodaySession = () => {
    if (!window.confirm('重新抽題會覆蓋今天的題目清單，但不會刪除作答紀錄。確定？')) return;
    createTodaySession({ force: true });
  };

  const needsDueReview = tab === 'review';
  const needsWeakQuestions = ['review', 'analytics', 'flashcards'].includes(tab);
  const needsFullReadiness = ['readiness', 'analytics', 'critical', 'plan'].includes(tab);
  const needsCancerSummary = ['readiness', 'analytics'].includes(tab);
  const needsTaxonomyAnalytics = tab === 'analytics';
  const needsBankQuestions = tab === 'questions';
  const needsFlashcardLists = ['stats', 'flashcards', 'flashcard-review', 'plan', 'knowledge', 'news'].includes(tab);
  const readinessDataState = useMemo(() => ({
    ...questionDataState,
    mockExams: state.mockExams,
  }), [questionDataState, state.mockExams]);
  const bossDataState = useMemo(() => ({
    ...flashcardDataState,
    planProgress: state.planProgress,
    mockExams: state.mockExams,
  }), [flashcardDataState, state.planProgress, state.mockExams]);
  const chestDataState = useMemo(() => ({
    stats: state.stats,
    flashcardStats: state.flashcardStats,
    game: state.game,
  }), [state.stats, state.flashcardStats, state.game]);

  const dueCount = useMemo(() => Object.values(state.stats || {})
    .filter((stat) => stat.nextReviewDate && stat.nextReviewDate <= TODAY).length, [state.stats]);

  const questionTotal = useMemo(() => {
    const customCount = Object.keys(state.customQuestions || {}).length;
    const deletedCount = Object.entries(state.deletedQuestionIds || {}).filter(([, deleted]) => deleted).length;
    return QUESTION_BANK_TOTAL + customCount - deletedCount;
  }, [state.customQuestions, state.deletedQuestionIds]);

  const flashcardTotal = useMemo(() => Object.keys(normalizeFlashcards(state.flashcards)).length, [state.flashcards]);
  const dueFlashcardCount = useMemo(() => getDueFlashcards({
    flashcards: state.flashcards,
    flashcardStats: state.flashcardStats,
  }).length, [state.flashcards, state.flashcardStats]);

  const dueReview = useMemo(() => needsDueReview ? getQuestionPool(questionDataState)
    .map((q) => ({ q: getQuestionWithOverride(q.id, questionDataState), stat: getStat(questionDataState, q.id) }))
    .filter(({ q, stat }) => q && stat.nextReviewDate && stat.nextReviewDate <= TODAY)
    .sort((a, b) => wrongRate(b.stat) - wrongRate(a.stat)) : EMPTY_ARRAY, [needsDueReview, questionDataState]);

  const weakQuestions = useMemo(() => needsWeakQuestions ? getQuestionPool(questionDataState)
    .map((q) => ({ q: getQuestionWithOverride(q.id, questionDataState), stat: getStat(questionDataState, q.id) }))
    .filter(({ q, stat }) => q && (stat.wrong > 0 || stat.bookmarked))
    .sort((a, b) => wrongRate(b.stat) - wrongRate(a.stat) || b.stat.wrong - a.stat.wrong) : EMPTY_ARRAY, [needsWeakQuestions, questionDataState]);

  const remediationQueue = useMemo(() => needsDueReview ? weakQuestions
    .map(({ q, stat }) => {
      const errorType = stat.lastErrorType || stat.errorTypes?.[stat.errorTypes.length - 1] || '';
      if (!errorType) return null;
      const remediation = {
        errorType,
        ...getRemediationForErrorType(errorType),
      };
      return { q, stat, remediation };
    })
    .filter(Boolean)
    .sort((a, b) => wrongRate(b.stat) - wrongRate(a.stat) || b.stat.wrong - a.stat.wrong) : EMPTY_ARRAY, [needsDueReview, weakQuestions]);
  const todayReviewQueueCompletions = state.game?.reviewQueueCompletions?.[TODAY] || {};
  const isReviewQueueItemComplete = (id) => Boolean(todayReviewQueueCompletions[id]);
  const markReviewQueueComplete = (id) => {
    const question = getQuestionWithOverride(id, questionDataState);
    updateState((prev) => {
      const currentDateCompletions = prev.game?.reviewQueueCompletions?.[TODAY] || {};
      if (currentDateCompletions[id]) return prev;
      return {
        ...prev,
        game: {
          ...(prev.game || defaultState.game),
          reviewQueueCompletions: {
            ...(prev.game?.reviewQueueCompletions || {}),
            [TODAY]: {
              ...currentDateCompletions,
              [id]: {
                completedAt: new Date().toISOString(),
                questionId: id,
                cancer: question?.cancer || '',
                topic: question?.topic || '',
              },
            },
          },
        },
      };
    }, ['game']);
  };

  const summary = useMemo(() => {
    const stats = Object.values(state.stats);
    const attempts = stats.reduce((s, x) => s + (x.attempts || 0), 0);
    const correct = stats.reduce((s, x) => s + (x.correct || 0), 0);
    const wrong = stats.reduce((s, x) => s + (x.wrong || 0), 0);
    const reviewed = Object.keys(state.stats).filter((id) => state.stats[id]?.attempts > 0).length;
    return { attempts, correct, wrong, reviewed, accuracy: attempts ? Math.round((correct / attempts) * 100) : 0 };
  }, [state.stats]);

  const cancerSummary = useMemo(() => needsCancerSummary ? getCancerSummary(questionDataState) : EMPTY_ARRAY, [needsCancerSummary, questionDataState]);
  const taxonomyAnalytics = useMemo(() => needsTaxonomyAnalytics ? getTaxonomyAnalytics(questionDataState) : {
    clinicalSetting: EMPTY_ARRAY,
    evidenceType: EMPTY_ARRAY,
    biomarker: EMPTY_ARRAY,
    treatmentModality: EMPTY_ARRAY,
  }, [needsTaxonomyAnalytics, questionDataState]);
  const readiness = useMemo(() => needsFullReadiness ? getReadinessMetrics(readinessDataState) : getQuickReadinessMetrics(readinessDataState), [needsFullReadiness, readinessDataState]);
  const bossRows = useMemo(() => needsFullReadiness ? getBossRows(bossDataState, readiness) : EMPTY_ARRAY, [needsFullReadiness, bossDataState, readiness]);
  const checkedInToday = getDailyCheckInStatus(state, TODAY);
  const checkInStreak = getDailyCheckInStreak(state, TODAY);
  const dailyChest = getDailyChest(chestDataState, todayCompleted);
  const flashcardListState = useMemo(() => ({
    flashcards: state.flashcards,
    flashcardStats: state.flashcardStats,
  }), [state.flashcards, state.flashcardStats]);
  const allFlashcards = useMemo(() => needsFlashcardLists ? getFlashcardList(flashcardListState) : EMPTY_ARRAY, [needsFlashcardLists, flashcardListState]);
  const dueFlashcards = useMemo(() => needsFlashcardLists ? getDueFlashcards(flashcardListState) : EMPTY_ARRAY, [needsFlashcardLists, flashcardListState]);
  const trialCardTotal = useMemo(
    () => allFlashcards.filter((card) => card.sourceType === 'trial' || card.type === 'Trial Card').length,
    [allFlashcards]
  );
  const knowledgeTopics = useMemo(() => tab === 'knowledge'
    ? buildKnowledgeTopics(questionDataState, flashcardListState, state.planProgress || {})
    : EMPTY_ARRAY, [tab, questionDataState, flashcardListState, state.planProgress]);
  const knowledgeQuestions = useMemo(() => ['knowledge', 'news'].includes(tab)
    ? getQuestionPool(questionDataState)
      .map((question) => getQuestionWithOverride(question.id, questionDataState))
      .filter(Boolean)
    : EMPTY_ARRAY, [tab, questionDataState]);

  const updateActiveMockExam = useCallback((draft) => {
    updateState((prev) => ({ ...prev, activeMockExam: draft }), ['activity']);
  }, [updateState]);

  const clearActiveMockExam = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      activeMockExam: null,
      activeMockExamClearedAt: new Date().toISOString(),
    }), ['activity']);
  }, [updateState]);

  const finishMockExam = (completedExam) => {
    updateState((prev) => {
      const existingExam = (prev.mockExams || []).find((mock) => mock.id === completedExam.id);
      if (existingExam) {
        const regradedStats = completedExam.results.reduce(
          (nextStats, result) => result.isCorrect == null
            ? nextStats
            : regradeBatchQuestionResult(nextStats, result, 'mock', completedExam.id),
          prev.stats,
        );
        return {
          ...prev,
          stats: completedExam.persistedAt
            ? applyBatchRemediationsToStats(regradedStats, completedExam.results, completedExam.id)
            : regradedStats,
          mockExams: (prev.mockExams || []).map((mock) => mock.id === completedExam.id ? completedExam : mock),
        };
      }
      return {
        ...prev,
        stats: applyBatchQuestionResults(prev.stats, completedExam.results, 'mock', completedExam.id),
        mockExams: [completedExam, ...(prev.mockExams || [])].slice(0, 20),
      };
    }, ['stats', 'mockExams']);
  };

  const planProgress = useMemo(() => state.planProgress || {}, [state.planProgress]);

  const planSummary = useMemo(() => {
    const total = studyPlan100.length;
    const completed = studyPlan100.filter((task) => getPlanProgressValue(planProgress, task)).length;
    const percent = total ? Math.round((completed / total) * 100) : 0;

    const byCancerMap = studyPlan100.reduce((acc, task) => {
      if (!acc[task.cancer]) acc[task.cancer] = { cancer: task.cancer, total: 0, completed: 0 };
      acc[task.cancer].total += 1;
      if (getPlanProgressValue(planProgress, task)) acc[task.cancer].completed += 1;
      return acc;
    }, {});

    const goldenTotal = studyPlan100.filter((task) => task.goldenTrials?.length).length;
    const goldenCompleted = studyPlan100.filter((task) => task.goldenTrials?.length && getPlanProgressValue(planProgress, task)).length;

    return {
      total,
      completed,
      percent,
      goldenTotal,
      goldenCompleted,
      goldenPercent: goldenTotal ? Math.round((goldenCompleted / goldenTotal) * 100) : 0,
      byCancer: Object.values(byCancerMap).map((row) => ({
        ...row,
        percent: row.total ? Math.round((row.completed / row.total) * 100) : 0,
      })),
    };
  }, [planProgress]);

  const planRecovery = useMemo(() => getPlanRecoveryStatus(state, planProgress), [state, planProgress]);

  const statsDashboardState = useMemo(() => ({
    ...defaultState,
    stats: state.stats,
    sessions: state.sessions,
    flashcards: state.flashcards,
    flashcardStats: state.flashcardStats,
    focusSessions: state.focusSessions,
    dailyQuestProgress: state.dailyQuestProgress,
  }), [state.stats, state.sessions, state.flashcards, state.flashcardStats, state.focusSessions, state.dailyQuestProgress]);

  const statsDashboard = useMemo(() => {
    if (tab !== 'stats') return null;
    return getStatsDashboard(statsDashboardState, planSummary, readiness, cancerSummary);
  }, [
    tab,
    statsDashboardState,
    planSummary,
    readiness,
    cancerSummary,
  ]);


  const nextPlanTask = studyPlan100.find((task) => !getPlanProgressValue(planProgress, task)) || studyPlan100[studyPlan100.length - 1];
  const topWeakCancer = cancerSummary.find((row) => row.status === 'Red') || cancerSummary[0];
  const topRedTopic = readiness.redTopics?.[0];
  const mockNeeded = readiness.recentMockScores.length < 3 || readiness.recentMockAverage < 80;
  const primaryFocus = topRedTopic
    ? `${topRedTopic.cancer}｜${topRedTopic.topic}`
    : topWeakCancer
      ? `${topWeakCancer.cancer} 題庫覆蓋率 ${topWeakCancer.coverage}% / 正確率 ${topWeakCancer.accuracy}%`
      : '維持今日任務 streak';
  const missionControl = {
    goal: '通過腫瘤專科考試',
    loop: '每日任務 → 題目作答 → 錯題修補 → Trial 卡片 → Boss / Mock 驗收',
    planTarget: nextPlanTask ? `下一個讀書計畫：${nextPlanTask.day} ${nextPlanTask.topic}` : '100-Day Plan 已完成',
    examLabel: EXAM_DATE.label,
    examDate: EXAM_DATE.display,
    examCountdown: getExamCountdown(),
    primaryFocus,
    actions: [
      {
        title: '今日主線任務',
        detail: `完成 ${questTask.day}：${questTask.topic}，先做題再回想 trial / algorithm。`,
        cta: 'Go Quest',
        tab: 'quest',
      },
      {
        title: '補破口',
        detail: dueCount > 0
          ? `先清 ${dueCount} 題到期複習與錯題，降低正式考失分風險。`
          : `目前沒有到期複習；改補 ${primaryFocus}。`,
        cta: dueCount > 0 ? 'Review Queue' : 'Analytics',
        tab: dueCount > 0 ? 'review' : 'analytics',
      },
      {
        title: mockNeeded ? '建立實戰分數' : '維持 ≥80 安全區',
        detail: mockNeeded
          ? '每 7–10 天做一次 mixed mock，讓預測分數不是只看單題練習。'
          : '保留節奏：錯題 retest 轉換率 ≥90%，mock 波動 SD <8。',
        cta: 'Mock Exam',
        tab: 'mock',
      },
    ],
  };

  const togglePlanTask = (id, checkedOverride = null) => {
    const task = getStudyPlanTaskById(id);
    if (!task) return;
    updateState((prev) => {
      const wasDone = getPlanProgressValue(prev.planProgress, task);
      const checked = checkedOverride == null ? !wasDone : Boolean(checkedOverride);
      const storageId = getPlanTaskStorageId(task);
      const nextState = {
        ...prev,
        game: checked && !wasDone ? awardXp(prev.game || defaultState.game, XP_RULES.planTask, '100-Day task completed', { taskId: storageId, legacyTaskId: task.id }) : prev.game,
        planProgress: makePlanProgressEntry(prev.planProgress, task, checked),
        planItemProgress: {
          ...(prev.planItemProgress || {}),
          [storageId]: buildFullPlanItemProgress(task, checked),
          [task.id]: buildFullPlanItemProgress(task, checked),
        },
      };
      return syncBossGameState(nextState);
    }, ['progress', 'game']);
  };

  const togglePlanItem = (task, group, item) => {
    updateState((prev) => {
      const taskId = getPlanTaskStorageId(task);
      const current = getPlanItemProgressForTask(prev, taskId);
      const nextGroup = {
        ...(current[group] || {}),
        [item]: !current[group]?.[item],
      };
      if (!nextGroup[item]) delete nextGroup[item];
      const nextItemProgress = {
        ...current,
        [group]: nextGroup,
        updatedAt: new Date().toISOString(),
      };
      const nextPlanItemProgress = {
        ...(prev.planItemProgress || {}),
        [taskId]: nextItemProgress,
        [task.id]: nextItemProgress,
      };
      const fullyConfirmed = isTaskFullyConfirmed(task, nextItemProgress);
      const questCleared = Object.values(prev.dailyQuestProgress || {}).some((bucket) => {
        const saved = bucket?.tasks?.[taskId] || bucket?.tasks?.[task.id] || (getStudyPlanTaskById(bucket?.planTaskId) === task ? bucket : null);
        return Boolean(saved?.xpClaimed || saved?.stageClearedAt);
      });
      const wasDone = getPlanProgressValue(prev.planProgress, task);
      const nextPlanProgress = makePlanProgressEntry(prev.planProgress, task, fullyConfirmed || (wasDone && questCleared));
      const nextState = {
        ...prev,
        game: fullyConfirmed && !wasDone ? awardXp(prev.game || defaultState.game, XP_RULES.planTask, '100-Day task completed', { taskId, legacyTaskId: task.id }) : prev.game,
        planProgress: nextPlanProgress,
        planItemProgress: nextPlanItemProgress,
      };
      return syncBossGameState(nextState);
    }, ['progress', 'game']);
  };

  const setPlanCancerCompleted = (cancer, completed) => {
    updateState((prev) => {
      const next = { ...(prev.planProgress || {}) };
      const nextItemProgress = { ...(prev.planItemProgress || {}) };
      studyPlan100.filter((task) => task.cancer === cancer).forEach((task) => {
        const storageId = getPlanTaskStorageId(task);
        next[storageId] = completed;
        next[task.id] = completed;
        nextItemProgress[storageId] = buildFullPlanItemProgress(task, completed);
        nextItemProgress[task.id] = buildFullPlanItemProgress(task, completed);
      });
      return syncBossGameState({ ...prev, planProgress: next, planItemProgress: nextItemProgress });
    }, ['progress', 'game']);
  };

  const resetPlanProgress = async () => {
    const updatedAt = new Date().toISOString();
    const nextState = normalizeState({
      ...state,
      planProgress: {},
      planItemProgress: {},
      dailyQuestProgress: {},
      bossProgress: {},
      game: { ...defaultState.game },
      player: { ...defaultState.player },
      cloudMeta: {
        ...(state.cloudMeta || {}),
        updatedAt,
        planResetAt: updatedAt,
        gameResetAt: updatedAt,
        device: navigator.userAgent,
      },
    });

    setState(nextState);
    saveState(nextState);

    if (!user) {
      setSyncStatus('已重新開始 100-Day Plan，並重設完成度與 XP。');
      return;
    }

    try {
      const syncedState = await writeCloudState(user.uid, nextState, updatedAt);
      lastSyncedSignatureRef.current = getCloudSyncSignature(syncedState);
      setSyncStatus('已重新開始 100-Day Plan，並重設完成度與 XP。');
    } catch (error) {
      lastSyncedSignatureRef.current = '';
      setSyncError(getFirebaseErrorMessage(error));
      setSyncStatus('已重設本機完成度；雲端同步失敗，請稍後再試。');
    }
  };


  const bankQuestions = useMemo(() => needsBankQuestions ? getQuestionPool(questionDataState)
    .map((q) => getQuestionWithOverride(q.id, questionDataState))
    .filter(Boolean)
    .filter((q) => {
      const text = `${questionSearchText(q)} ${tagSearchText(q.tags)}`;
      const searchOk = !search || text.includes(search.toLowerCase());
      const cancerOk = bankCancer === 'All' || (q.tags?.cancerDomain || q.cancer) === bankCancer;
      const yearOk = bankYear === 'All' || String(q.year) === String(bankYear);
      return searchOk && cancerOk && yearOk;
    }) : EMPTY_ARRAY, [needsBankQuestions, search, bankCancer, bankYear, questionDataState]);

  const updateSettings = (patch) => {
    updateState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }), ['app']);
  };

  const setPracticeMode = (practiceMode) => {
    if (todaySessionMatchesQuest && dailyBatchSubmitted && !dailyBatchClassificationComplete) {
      setTab('today');
      setPracticePageMessage('請先完成目前這批所有錯題的錯因分類，再開始下一批 Daily Practice。');
      return;
    }
    const modeConfig = getPracticeModeConfig(practiceMode);
    setPracticePage(0);
    setPracticePageMessage('');
    updateState((prev) => {
      const existing = prev.sessions?.[TODAY];
      const existingMatchesQuest = getStudyPlanTaskById(existing?.planTaskId) === questTask
        || getStudyPlanTaskById(existing?.legacyPlanTaskId) === questTask;
      const existingModeConfig = getPracticeModeConfig(existing?.practiceMode);
      const completedQuestionIds = existing?.submittedAt
        ? [...new Set((existing.gradingResults || []).map((result) => result.questionId).filter(Boolean))]
        : [];
      const completedCount = completedQuestionIds.length
        ? (Number(existing?.previousPracticeTotal) || 0) + completedQuestionIds.length
        : existingModeConfig.total;
      const completedResults = (existing?.gradingResults || []).map((result) => ({
        ...result,
        errorType: result.isCorrect === false
          ? (result.errorType || existing?.practiceDrafts?.[result.questionId]?.errorType || '')
          : '',
      }));
      const batchReady = Boolean(existing?.submittedAt)
        && completedResults.length > 0
        && completedResults.every((result) => (
          result.isCorrect === true || (result.isCorrect === false && result.errorType)
        ));
      const startsNewBatch = existingMatchesQuest
        && batchReady;
      const newBatchCount = startsNewBatch
        ? (modeConfig.total > completedCount ? modeConfig.total - completedCount : modeConfig.total)
        : 0;
      const previousQuestionIds = startsNewBatch
        ? [...new Set([...(existing?.excludedQuestionIds || []), ...completedQuestionIds])]
        : [];
      const pendingQuestionIds = startsNewBatch
        ? (existing.questionIds || []).filter((id) => !previousQuestionIds.includes(id)).slice(0, newBatchCount)
        : [];
      const rankedHighYieldTopics = startsNewBatch ? getRankedHighYieldTopics(prev, questTask) : [];
      const newBatchQuestionIds = startsNewBatch
        ? fillDailyQuestionIds(prev, questTask, pendingQuestionIds, newBatchCount, rankedHighYieldTopics, previousQuestionIds)
        : [];
      const now = new Date().toISOString();
      const attemptsRecorded = startsNewBatch && completedResults.every((result) => (
        (prev.stats?.[result.questionId]?.answerHistory || []).some((event) => event?.attemptId === existing?.attemptId)
      ));
      const attemptStats = startsNewBatch && !attemptsRecorded
        ? applyBatchQuestionResults(prev.stats, completedResults, 'daily', existing?.attemptId)
        : prev.stats;
      const nextStats = startsNewBatch
        ? applyBatchRemediationsToStats(attemptStats, completedResults, existing?.attemptId)
        : prev.stats;
      return {
        ...prev,
        stats: nextStats,
        settings: {
          ...prev.settings,
          practiceMode,
          dailyCount: modeConfig.total,
        },
        sessions: {
          ...(prev.sessions || {}),
          ...(existingMatchesQuest ? {
            [TODAY]: startsNewBatch ? {
              date: TODAY,
              ...makePlanTaskSnapshot(questTask),
              practiceMode,
              practiceModeLabel: `加練 ${newBatchCount} 題`,
              practiceTargetCount: newBatchCount,
              practiceRecipe: {
                total: newBatchCount,
                newCount: Math.min(modeConfig.newCount, newBatchCount),
                topicCount: modeConfig.topicCount,
                dueCount: modeConfig.dueCount,
                weaknessCount: modeConfig.weaknessCount,
                highYieldCount: modeConfig.highYieldCount || 0,
              },
              highYieldInserts: rankedHighYieldTopics.slice(0, 5).map(({ id, label, type, priorityScore }) => ({ id, label, type, priorityScore })),
              questionIds: newBatchQuestionIds,
              excludedQuestionIds: previousQuestionIds,
              previousPracticeTotal: completedCount,
              createdAt: now,
              updatedAt: now,
              completed: false,
              practiceDrafts: {},
            } : {
              ...existing,
              practiceMode,
              practiceModeLabel: modeConfig.shortLabel,
              practiceTargetCount: null,
              practiceRecipe: {
                total: modeConfig.total,
                newCount: modeConfig.newCount,
                topicCount: modeConfig.topicCount,
                dueCount: modeConfig.dueCount,
                weaknessCount: modeConfig.weaknessCount,
              },
              updatedAt: now,
            },
          } : {}),
        },
      };
    }, ['app', 'sessions', 'stats']);
  };

  const startDailyPractice = () => {
    if (dailyBatchSubmitted) {
      setPracticeMode(selectedPracticeMode);
      setTab('today');
      return;
    }
    createTodaySession();
  };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oncology-ai-review-backup-${TODAY}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        setState(normalizeState({ ...defaultState, ...data }));
      } catch {
        alert('JSON 匯入失敗');
      }
    };
    reader.readAsText(file);
  };

  const resetAll = () => {
    if (!window.confirm('確定清除所有練習、錯題、詳解與複習排程？')) return;
    setState(defaultState);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <div className="eyebrow">Oncology Tracker</div>
          <h1>Board Readiness Engine</h1>
          <p>{QUESTION_YEAR_LABEL} 腫專考古題、mixed mock、confidence calibration、critical error queue、≥80 分預測。</p>
        </div>
        <div className="header-actions">
          <button className={checkedInToday ? 'good' : 'primary'} disabled={checkedInToday} onClick={markDailyCheckIn}>
            {checkedInToday ? '今日已打卡' : '每日打卡'}
          </button>
          <button className="primary" disabled={isCreatingPractice} onClick={startDailyPractice}>
            {isCreatingPractice ? '產生中...' : dailyBatchSubmitted ? '開始下一份 Daily Practice' : '產生今日 Daily Practice'}
          </button>
        </div>
      </header>

      <section className="metrics-grid">
        <MetricCard label="題庫總數" value={questionTotal} sub={`${QUESTION_YEAR_LABEL} 年`} />
        <MetricCard label="已練題目" value={summary.reviewed} sub={`${summary.attempts} total attempts`} />
        <MetricCard label="正確率" value={`${summary.accuracy}%`} sub={`${summary.correct} correct / ${summary.wrong} wrong`} />
        <MetricCard label="今日待複習" value={dueCount} sub="依 next review date" />
        <MetricCard label="≥80 機率" value={`${readiness.probability80}%`} sub={readiness.readinessLevel} />
        <MetricCard label="Level / XP" value={`Lv ${state.game?.level || 1}`} sub={`${state.game?.xp || 0} XP · streak ${state.game?.streak || 0}`} />
        <MetricCard label="每日打卡" value={checkedInToday ? 'Done' : '未打卡'} sub={`連續 ${checkInStreak} 天`} />
        <MetricCard label="今日專注" value={`${todayFocusMinutes} 分`} sub={`focus streak ${focusStreak} 天`} />
        <MetricCard label="Flashcards" value={flashcardTotal} sub={`${dueFlashcardCount} due today`} />
        <MetricCard label="同步狀態" value={user ? 'Cloud' : 'Local'} sub={user ? user.email : '尚未登入'} />
      </section>

      <section className="mission-control panel">
        <div className="section-head">
          <div>
            <div className="eyebrow dark">Mission Control</div>
            <h2>{missionControl.goal}</h2>
            <p className="muted">{missionControl.loop}</p>
          </div>
          <div className="mission-top-cards">
            <div className="mission-target">
              <span>目前最該推進</span>
              <strong>{missionControl.planTarget}</strong>
            </div>
            <div className="mission-dday" aria-label={`${missionControl.examLabel} D-Day ${missionControl.examCountdown}`}>
              <span>D-Day</span>
              <strong>{missionControl.examCountdown}</strong>
              <em>{missionControl.examLabel} · {missionControl.examDate}</em>
            </div>
          </div>
        </div>
        <div className="mission-focus">
          <span className="pill trial">Score dragger</span>
          <strong>{missionControl.primaryFocus}</strong>
        </div>
        <button className="pomodoro-home-card" type="button" onClick={() => setTab('pomodoro')}>
          <span className="pomodoro-home-icon"><Clock3 size={24} /></span>
          <span>
            <em>Pomodoro Focus Studio</em>
            <strong>{activeFocusSession?.source === 'pomodoro' ? '蕃茄鐘進行中' : `今日已專注 ${todayFocusMinutes} 分鐘`}</strong>
            <small>目前排名 #{focusLeaderboardRows.findIndex((row) => row.kind === 'user') + 1} · 連續 {focusStreak} 天</small>
          </span>
          <b>進入蕃茄鐘 →</b>
        </button>
        <div className="mission-actions">
          {missionControl.actions.map((action) => (
            <button className="mission-action" type="button" key={action.title} onClick={() => setTab(action.tab)}>
              <strong>{action.title}</strong>
              <span>{action.detail}</span>
              <em>{action.cta} →</em>
            </button>
          ))}
        </div>
      </section>

      <nav className="tabs grouped-tabs" aria-label="Main navigation">
        <button className={`nav-home ${tab === 'quest' ? 'active' : ''}`} type="button" onClick={() => setTab('quest')}>
          <Home size={17} strokeWidth={2.4} />
          <span>Quest</span>
        </button>
        <button className={`nav-knowledge ${tab === 'knowledge' ? 'active' : ''}`} type="button" onClick={() => setTab('knowledge')}>
          <BookOpen size={17} strokeWidth={2.4} />
          <span>Knowledge</span>
        </button>
        <button className={`nav-pomodoro ${tab === 'pomodoro' ? 'active' : ''}`} type="button" onClick={() => setTab('pomodoro')}>
          <Clock3 size={17} strokeWidth={2.4} />
          <span>Pomodoro</span>
        </button>
        {NAV_GROUPS.map(({ id, label, Icon, items }) => {
          const active = items.some(([key]) => tab === key);
          return (
            <details className={`nav-menu ${active ? 'active' : ''}`} key={id}>
              <summary>
                <Icon size={17} strokeWidth={2.4} />
                <span>{label}</span>
                <ChevronDown className="nav-chevron" size={16} strokeWidth={2.6} />
              </summary>
              <div className="nav-menu-panel">
                {items.map(([key, itemLabel]) => (
                  <button
                    key={key}
                    className={tab === key ? 'active' : ''}
                    type="button"
                    onClick={(event) => {
                      setTab(key);
                      event.currentTarget.closest('details')?.removeAttribute('open');
                    }}
                  >
                    {itemLabel}
                  </button>
                ))}
              </div>
            </details>
          );
        })}
      </nav>

      {(questionBankLoading || questionBankError || !questionBankReady) && (
        <div className={questionBankError ? 'question-bank-status error' : 'question-bank-status'}>
          {questionBankError || `題庫載入中：${requestedQuestionYears.join(', ') || QUESTION_YEAR_LABEL}`}
        </div>
      )}

      {tab === 'quest' && (
        <QuestPanel
          task={questTask}
          progress={questProgress}
          recallCards={questRecallCards}
          reviewHistory={questReviewHistory}
          bossChallenges={questBossChallenges}
          highYieldTopics={highYieldTopics}
          completionStatus={completionStatus}
          checkedInToday={checkedInToday}
          checkInStreak={checkInStreak}
          onCheckIn={markDailyCheckIn}
          onCreatePractice={createTodaySession}
          isCreatingPractice={isCreatingPractice}
          practiceMode={selectedPracticeMode}
          hasPracticeSession={todayPracticeTargetIds.length > 0}
          remainingErrorTypes={Math.max(0, dailyBatchWrong - dailyWrongClassified)}
          onPracticeModeChange={setPracticeMode}
          onMarkRecall={markQuestRecall}
          onSetBossResult={setQuestBossResult}
          onClaimStageClear={claimStageClear}
          onOpenPractice={() => {
            if (!todayCompleted && firstIncompletePracticeId) {
              openFirstIncompletePracticeQuestion();
              return;
            }
            setTab('today');
          }}
        />
      )}

      {tab === 'knowledge' && (
        <KnowledgeHubPanel
          topics={knowledgeTopics}
          questions={knowledgeQuestions}
          flashcards={allFlashcards}
          planTasks={studyPlan100}
          defaultTaskId={getPlanTaskStorageId(questTask)}
          libraryState={notionLibrary.libraryState}
          notePreview={notionLibrary.notePreview}
          onOpenQuestion={(question) => {
            setBankYear('All');
            setBankCancer(question.cancer || 'All');
            setSearch(question.id);
            setEditingQuestionId(question.id);
            setTab('questions');
          }}
          onImportLearningDrafts={importNotionLearningDrafts}
          onSyncLibrary={notionLibrary.syncLibrary}
          onOpenNotePreview={notionLibrary.openNotePreview}
          onCloseNotePreview={notionLibrary.closeNotePreview}
          onOpenCards={() => setTab('flashcards')}
          onOpenPlan={() => setTab('plan')}
          onOpenReview={() => setTab('review')}
        />
      )}

      {tab === 'stats' && (
        <StatsDashboard stats={statsDashboard} />
      )}

      {tab === 'pomodoro' && (
        <PomodoroPanel
          timer={focusTimer}
          remainingSeconds={pomodoroRemainingSeconds}
          rows={focusLeaderboardRows}
          todayMinutes={todayFocusMinutes}
          focusStreak={focusStreak}
          onPresetChange={setPomodoroPreset}
          onStart={startPomodoroSession}
          onPause={pausePomodoroSession}
          onResume={resumePomodoroSession}
          onCancel={cancelFocusSession}
          onFinishLegacy={finishFocusSession}
        />
      )}

      {tab === 'readiness' && (
        <main className="panel">
          <div className="section-head">
            <div>
              <h2>Board Readiness Dashboard</h2>
              <p className="muted">每天回答：今天正式考，≥80 分機率多少？哪些癌別與 topic 會拖分？</p>
            </div>
            <button className="primary" onClick={() => setTab('mock')}>Start mixed mock</button>
          </div>
          <section className="readiness-hero">
            <MetricCard label="Predicted Board Score" value={`${readiness.predictedScore}%`} sub="weighted readiness score" />
            <MetricCard label="Probability ≥80" value={`${readiness.probability80}%`} sub={readiness.readinessLevel} />
            <MetricCard label="Safe Exam Zone" value={readiness.safeExamZone ? 'Yes' : 'Not yet'} sub={`volatility SD ${readiness.scoreVolatility}`} />
            <MetricCard label="Mock average" value={`${readiness.recentMockAverage}%`} sub={readiness.recentMockScores.join(' / ') || 'No mock yet'} />
          </section>
          <div className="gate-grid">
            {readiness.gates.map((gate) => (
              <div className={gate.pass ? 'gate-card pass' : 'gate-card fail'} key={gate.label}>
                <strong>{gate.pass ? '✅' : '❌'} {gate.label}</strong>
                <span>{gate.value}</span>
              </div>
            ))}
          </div>
          <div className="subsection">
            <h3>Main score draggers</h3>
            {readiness.redTopics.slice(0, 8).map((row) => (
              <div className="weak-row" key={row.key}>{row.cancer} · {row.topic} · accuracy {row.accuracy}% · coverage {row.coverage}% · HC wrong {row.highConfidenceWrong}</div>
            ))}
          </div>
        </main>
      )}

      {tab === 'mock' && (
        <MockExamPanel
          state={state}
          persistedDraft={state.activeMockExam}
          onDraftChange={updateActiveMockExam}
          onDraftClear={clearActiveMockExam}
          onFinishMock={finishMockExam}
          onEnsureQuestionYears={ensureQuestionYearsReady}
        />
      )}

      {tab === 'critical' && (
        <main className="panel">
          <h2>Critical Error Queue</h2>
          <p className="muted">收錄 high confidence wrong、repeated wrong 與高錯誤率核心題；優先做 concept repair → similar question → 7-day retest。</p>
          {readiness.criticalErrors.length === 0 ? <p className="muted">目前沒有 critical errors。</p> : readiness.criticalErrors.slice(0, 40).map(({ q, stat }) => (
            <QuestionCard key={q.id} question={q} stat={stat} onUpdateStat={updateStat} compact />
          ))}
        </main>
      )}

      {tab === 'flashcards' && (
        <FlashcardsPanel
          state={state}
          allFlashcards={allFlashcards}
          dueFlashcards={dueFlashcards}
          weakQuestions={weakQuestions}
          onCreateTrialCard={createTrialCard}
          onImportFlashcards={importFlashcards}
          onUpdateCard={updateFlashcard}
          onDeleteCard={deleteFlashcard}
          onOpenReview={() => setTab('flashcard-review')}
        />
      )}


      {tab === 'flashcard-review' && (
        <FlashcardReviewPanel
          dueFlashcards={dueFlashcards}
          allFlashcards={allFlashcards}
          persistedSession={state.activeFlashcardReview}
          onReviewCard={reviewFlashcard}
          onSessionChange={updateActiveFlashcardReview}
          onOpenManager={() => setTab('flashcards')}
        />
      )}

      {tab === 'today' && (
        <main className="panel">
          <div className="section-head">
            <div>
              <h2>今日練習：{TODAY}</h2>
              <p className="muted">
                {todayQuestions.length
                  ? `${todayPracticeConfig.shortLabel}：${formatPracticeRecipe(todayPracticeConfig)}`
                  : `${selectedPracticeConfig.shortLabel}：${formatPracticeRecipe(selectedPracticeConfig)}`}
              </p>
              <PracticeModeSelector value={selectedPracticeMode} onChange={setPracticeMode} compact />
            </div>
            <div className="inline-actions">
              <button className="secondary" disabled={isCreatingPractice || dailyBatchSubmitted} onClick={regenerateTodaySession}>重新抽題</button>
              <button className={todayCompleted ? 'good' : 'secondary'} disabled={state.game?.dailyClaims?.[TODAY]} onClick={claimDailyCompletion}>
                {state.game?.dailyClaims?.[TODAY] ? '今日 XP 已領取' : todayCompleted ? '領取每日 XP' : '跳到未完成題目'}
              </button>
            </div>
          </div>

          {!todayQuestions.length ? (
            <div className="empty-state">
              <h3>今天尚未產生題目</h3>
              <p>選擇今日練習模式後，按同一個按鈕產生 New / Topic / Due / Weakness / High-yield 題組。</p>
              <div className="high-yield-list preview">
                {highYieldTopics.slice(0, 4).map((topic) => (
                  <span key={topic.id} className="high-yield-chip">
                    {topic.label}
                    <strong>{topic.priorityScore}</strong>
                  </span>
                ))}
              </div>
              <button className="primary" disabled={isCreatingPractice} onClick={() => createTodaySession()}>
                {isCreatingPractice ? '產生中...' : '產生今日 Daily Practice'}
              </button>
            </div>
          ) : (
            <>
              <div className="adaptive-practice-card compact">
                <div>
                  <h3>今日題目組成</h3>
                  <p className="muted">{formatPracticeRecipe(todayPracticeConfig)}。主線：{questTask.day}｜{questTask.topic}</p>
                </div>
                <div className="high-yield-list">
                  {(todaySession?.highYieldInserts || highYieldTopics).slice(0, 4).map((topic) => (
                    <span key={topic.id} className="high-yield-chip">
                      {topic.label}
                      <strong>{topic.priorityScore}</strong>
                    </span>
                  ))}
                </div>
              </div>
              <div className="practice-page-toolbar">
                <strong>第 {currentPracticePage + 1} 頁 / 共 {totalPracticePages} 頁</strong>
                <span>
                  {dailyBatchSubmitted
                    ? `已交卷：${dailyBatchCorrect} 答對 / ${dailyBatchWrong} 答錯${dailyBatchPending ? ` / ${dailyBatchPending} 題待補正解` : ''}`
                    : `已作答 ${todayPracticeTargetIds.filter((id) => todaySession?.practiceDrafts?.[id]?.selected).length}/${todayPracticeConfig.total} 題；已載入 ${todayQuestions.length} 題。`}
                </span>
              </div>
              {dailyBatchSubmitted && (
                <section className="readiness-hero">
                  <MetricCard label="答對率" value={`${dailyBatchResults.length ? Math.round((dailyBatchCorrect / dailyBatchResults.length) * 100) : 0}%`} sub={`${dailyBatchCorrect}/${dailyBatchResults.length} correct`} />
                  <MetricCard label="答錯率" value={`${dailyBatchResults.length ? Math.round((dailyBatchWrong / dailyBatchResults.length) * 100) : 0}%`} sub={`${dailyBatchWrong}/${dailyBatchResults.length} wrong`} />
                  <MetricCard label="錯因完成" value={`${dailyWrongClassified}/${dailyBatchWrong}`} sub="所有錯題分類後才完成" />
                </section>
              )}
              <div className="question-list">
                {visibleTodayQuestions.map((q) => (
                  <QuestionCard
                    key={`${todaySession?.createdAt || TODAY}-${q.id}`}
                    question={q}
                    stat={getStat(state, q.id)}
                    onUpdateStat={updateStat}
                    hideAnswerUntilSubmit
                    practiceMode
                    practiceDraft={todaySession?.practiceDrafts?.[q.id]}
                    onPracticeChange={(patch) => updatePracticeDraft(q.id, patch)}
                    batchSubmitted={dailyBatchSubmitted}
                    batchFinalized={Boolean(todaySession?.statsCommittedAt && dailyBatchAttemptsRecorded)}
                  />
                ))}
              </div>
              <div className="practice-page-actions">
                <button className="secondary" disabled={currentPracticePage === 0} onClick={() => setPracticePage(Math.max(0, currentPracticePage - 1))}>上一頁</button>
                <button className="primary" disabled={dailyBatchSubmitted || currentPracticePage + 1 >= totalPracticePages} onClick={loadNextPracticePage}>
                  {todayQuestions.length < Math.min(todayPracticeConfig.total, (currentPracticePage + 2) * PRACTICE_PAGE_SIZE) ? '下一頁並補題' : '下一頁'}
                </button>
                {!dailyBatchSubmitted ? (
                  <button className="good" onClick={submitDailyPractice}>整份交卷並顯示答案</button>
                ) : (
                  <>
                    <button className="good" disabled={Boolean(todaySession?.statsCommittedAt && dailyBatchAttemptsRecorded)} onClick={finalizeDailyPractice}>
                      {todaySession?.statsCommittedAt && dailyBatchAttemptsRecorded ? '訂正與統計已完成' : '完成錯因訂正並寫入統計'}
                    </button>
                    <button className="primary" onClick={startDailyPractice}>開始下一份 Daily Practice</button>
                  </>
                )}
              </div>
              {practicePageMessage && <p className="save-message">{practicePageMessage}</p>}
            </>
          )}
        </main>
      )}

      {tab === 'review' && (
        <main className="panel">
          <h2>Review Queue</h2>
          <p className="muted">優先順序：錯因訂正 → 今日到期 → 錯誤率 ≥50% → 已標記題目 → 未練新題。</p>
          <div className="subsection">
            <h3>錯因訂正</h3>
            {remediationQueue.length === 0 ? <p className="muted">答錯並選擇 Error type 後，這裡會自動排入訂正清單；先修正判斷，再決定要不要整理成卡片。</p> : remediationQueue.slice(0, 20).map(({ q, stat, remediation }) => (
              <div className={isReviewQueueItemComplete(q.id) ? 'remediation-row done' : 'remediation-row'} key={`${q.id}-${remediation.errorType || remediation.task}`}>
                <div className="remediation-summary">
                  <strong>{q.id}</strong> · {q.cancer} · {q.topic} · wrong rate {wrongRate(stat)}%
                  <p>{remediation.errorType || stat.lastErrorType} → {remediation.task}</p>
                  <span>{remediation.action}</span>
                </div>
                <div className="review-queue-actions">
                  <span className="optional-card-hint">後續可整理：{remediation.cardType}</span>
                  <button
                    className="tiny"
                    type="button"
                    aria-expanded={activeRemediationQuestionId === q.id}
                    onClick={() => setActiveRemediationQuestionId((currentId) => currentId === q.id ? null : q.id)}
                  >
                    {activeRemediationQuestionId === q.id ? '收合原題' : '開啟原題訂正'}
                  </button>
                  <button
                    className={isReviewQueueItemComplete(q.id) ? 'tiny good' : 'tiny'}
                    type="button"
                    disabled={isReviewQueueItemComplete(q.id)}
                    onClick={() => {
                      markReviewQueueComplete(q.id);
                      setActiveRemediationQuestionId((currentId) => currentId === q.id ? null : currentId);
                    }}
                  >
                    {isReviewQueueItemComplete(q.id) ? '已訂正' : '完成訂正'}
                  </button>
                </div>
                {activeRemediationQuestionId === q.id && (
                  <div className="remediation-question">
                    <QuestionCard question={q} stat={stat} onUpdateStat={updateStat} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="subsection">
            <h3>今日到期複習</h3>
            {dueReview.length === 0 ? <p className="muted">目前沒有到期題目。</p> : dueReview.slice(0, 30).map(({ q, stat }) => (
              <div className={isReviewQueueItemComplete(q.id) ? 'review-queue-card done' : 'review-queue-card'} key={q.id}>
                <div className="review-queue-card-head">
                  <span>{isReviewQueueItemComplete(q.id) ? '✓ 已完成今日複習' : 'Review Queue'}</span>
                  <button
                    className={isReviewQueueItemComplete(q.id) ? 'tiny good' : 'tiny'}
                    type="button"
                    disabled={isReviewQueueItemComplete(q.id)}
                    onClick={() => markReviewQueueComplete(q.id)}
                  >
                    {isReviewQueueItemComplete(q.id) ? '已完成' : '完成複習'}
                  </button>
                </div>
                <QuestionCard question={q} stat={stat} onUpdateStat={updateStat} compact />
              </div>
            ))}
          </div>
          <div className="subsection">
            <h3>高錯誤率 / 標記題</h3>
            {weakQuestions.slice(0, 30).map(({ q, stat }) => (
              <div className={isReviewQueueItemComplete(q.id) ? 'review-queue-card done' : 'review-queue-card'} key={q.id}>
                <div className="review-queue-card-head">
                  <span>{isReviewQueueItemComplete(q.id) ? '✓ 已完成今日複習' : 'Review Queue'}</span>
                  <button
                    className={isReviewQueueItemComplete(q.id) ? 'tiny good' : 'tiny'}
                    type="button"
                    disabled={isReviewQueueItemComplete(q.id)}
                    onClick={() => markReviewQueueComplete(q.id)}
                  >
                    {isReviewQueueItemComplete(q.id) ? '已完成' : '完成複習'}
                  </button>
                </div>
                <QuestionCard question={q} stat={stat} onUpdateStat={updateStat} compact />
              </div>
            ))}
          </div>
        </main>
      )}

      {tab === 'questions' && (
        <QuestionManagerPanel
          state={state}
          questions={bankQuestions}
          search={search}
          bankYear={bankYear}
          bankCancer={bankCancer}
          editingQuestionId={editingQuestionId}
          onSearch={setSearch}
          onYearChange={setBankYear}
          onCancerChange={setBankCancer}
          onEdit={setEditingQuestionId}
          onSaveOverride={saveQuestionOverride}
          onSaveCustomQuestion={saveCustomQuestion}
          onDeleteQuestion={deleteQuestion}
          onUpdateStat={updateStat}
        />
      )}

      {tab === 'analytics' && (
        <main className="panel">
          <h2>Analytics</h2>
          <div className="analytics-table">
            <div className="table-row readiness-table header"><span>Cancer</span><span>Coverage</span><span>Accuracy</span><span>Retest</span><span>HC wrong</span><span>Status</span></div>
            {cancerSummary.map((row) => (
              <div className="table-row readiness-table" key={row.cancer}>
                <span>{row.cancer}</span>
                <span>{row.coverage}% ({row.attemptedQuestions}/{row.total})</span>
                <span>{row.accuracy}%</span>
                <span>{row.retestAccuracy}%</span>
                <span>{row.highConfidenceWrong}</span>
                <span><strong>{row.status}</strong></span>
              </div>
            ))}
          </div>
          <section className="readiness-hero subsection">
            <MetricCard label="Predicted Board Score" value={`${readiness.predictedScore}%`} sub="composite score" />
            <MetricCard label="Wrong retest conversion" value={`${readiness.wrongRetestConversion}%`} sub="previously wrong now correct" />
            <MetricCard label="High-confidence wrong rate" value={`${readiness.highConfidenceWrongRate}%`} sub="confidence 4–5 but wrong" />
            <MetricCard label="Topic mastery" value={`${readiness.topicMasteryScore}%`} sub="core topics mastered" />
          </section>
          <div className="subsection">
            <h3>Taxonomy weakness map</h3>
            {[
              ['Clinical setting', taxonomyAnalytics.clinicalSetting],
              ['Evidence type', taxonomyAnalytics.evidenceType],
              ['Biomarker', taxonomyAnalytics.biomarker],
              ['Treatment modality', taxonomyAnalytics.treatmentModality],
            ].map(([title, rows]) => (
              <section className="taxonomy-analytics-block" key={title}>
                <h4>{title}</h4>
                <div className="analytics-table">
                  <div className="table-row readiness-table header"><span>Tag</span><span>Coverage</span><span>Accuracy</span><span>Wrong rate</span><span>HC wrong</span><span>Status</span></div>
                  {rows.slice(0, 8).map((row) => (
                    <div className="table-row readiness-table" key={row.key}>
                      <span>{row.label}</span>
                      <span>{row.coverage}% ({row.attempted}/{row.total})</span>
                      <span>{row.accuracy}%</span>
                      <span>{row.wrongRate}%</span>
                      <span>{row.highConfidenceWrong}</span>
                      <span><strong>{row.status}</strong></span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div className="subsection">
            <h3>Top weak questions</h3>
            {weakQuestions.slice(0, 12).map(({ q, stat }) => (
              <div className="weak-row" key={q.id}>
                <strong>{q.id}</strong> · {q.cancer} · {q.tags?.clinicalSetting || q.topic} · {q.tags?.evidenceType || 'evidence'} · wrong rate {wrongRate(stat)}% · {q.stem.slice(0, 120)}...
              </div>
            ))}
          </div>
        </main>
      )}

      {tab === 'plan' && (
        <main className="panel">
          <div className="section-head">
            <div>
              <h2>100-Day Plan Checklist</h2>
              <p className="muted">依照主題與 golden trial 拆成 100 個可勾選任務。完成度會依總體、癌別、golden trial 分別統計。</p>
            </div>
            <button className="secondary" onClick={resetPlanProgress}>重新開始 100-Day Plan</button>
          </div>

          <RewardDashboard
            state={state}
            dailyChest={dailyChest}
            bossRows={bossRows}
            checkedInToday={checkedInToday}
            checkInStreak={checkInStreak}
            onCheckIn={markDailyCheckIn}
            onClaimDailyChest={claimDailyChest}
          />

          <section className="plan-overview">
            <MetricCard label="總完成率" value={`${planSummary.percent}%`} sub={`${planSummary.completed}/${planSummary.total} tasks`} />
            <MetricCard label="Golden trial 完成率" value={`${planSummary.goldenPercent}%`} sub={`${planSummary.goldenCompleted}/${planSummary.goldenTotal} trial tasks`} />
            <MetricCard label="今日建議" value={`Day ${Math.min(planSummary.completed + 1, 100)}`} sub="照順序推進，錯題用 Review Queue 補強" />
            <MetricCard label="Recovery" value={planRecovery.behindDays ? `落後 ${planRecovery.behindDays} 天` : 'On pace'} sub={planRecovery.mode} />
            <MetricCard label="Game level" value={`Lv ${state.game?.level || 1}`} sub={`${state.game?.xp || 0} XP`} />
            <MetricCard label="Boss defeated" value={(state.game?.defeatedBosses || []).length} sub={`${(state.game?.unlockedBosses || []).length} unlocked`} />
            <MetricCard label="Trial cards" value={trialCardTotal} sub="Trial Boss target 50" />
          </section>

          <section className={planRecovery.behindDays ? 'plan-recovery-card behind' : 'plan-recovery-card'} aria-label="Plan recovery">
            <div className="plan-recovery-head">
              <div>
                <span className="eyebrow">Plan Recovery</span>
                <h3>{planRecovery.mode}</h3>
                <p>{planRecovery.guidance}</p>
              </div>
              <div className="recovery-score">
                <strong>{planRecovery.recoveryPercent}%</strong>
                <span>{planRecovery.completed}/{planRecovery.expectedCompleted} expected</span>
              </div>
            </div>
            <div className="progress-bar"><span style={{ width: `${planRecovery.recoveryPercent}%` }} /></div>
            <div className="recovery-actions">
              <div>
                <span>今日主線</span>
                <strong>{planRecovery.nextTask?.day} · {planRecovery.nextTask?.topic}</strong>
                <p>{planRecovery.nextTask?.details}</p>
              </div>
              <div>
                <span>Mini catch-up</span>
                <strong>{planRecovery.catchUpTask?.day} · {planRecovery.catchUpTask?.topic}</strong>
                <p>{planRecovery.behindDays ? '只補 golden trial / focus tag / 錯題連結，不要求完整重讀。' : '沒有落後時，這格當作預備加速題。'}</p>
              </div>
              <div>
                <span>可延後</span>
                <strong>{planRecovery.deferrableTask ? `${planRecovery.deferrableTask.day} · ${planRecovery.deferrableTask.topic}` : '暫無低權重項目'}</strong>
                <p>{planRecovery.deferrableTask ? '若今天能量不足，這類低權重背景先不要搶主線時間。' : '目前前方多為核心任務，先照順序穩穩推。'}</p>
              </div>
            </div>
          </section>

          <section className="plan-progress-panel" aria-label="100-Day Plan completion progress">
            <div className="plan-cancer-head">
              <strong>100-Day Plan 總進度</strong>
              <span>{planSummary.completed}/{planSummary.total}（{planSummary.percent}%）</span>
            </div>
            <div className="progress-bar large"><span style={{ width: `${planSummary.percent}%` }} /></div>
            <div className="plan-cancer-head">
              <strong>Golden trial 進度</strong>
              <span>{planSummary.goldenCompleted}/{planSummary.goldenTotal}（{planSummary.goldenPercent}%）</span>
            </div>
            <div className="progress-bar"><span style={{ width: `${planSummary.goldenPercent}%` }} /></div>
          </section>

          <div className="subsection">
            <h3>破關狀態</h3>
            <div className="boss-grid">
              {bossRows.map((boss) => (
                <div className={boss.defeated ? 'boss-card defeated' : boss.unlocked ? 'boss-card unlocked' : 'boss-card'} key={boss.id}>
                  <strong>{boss.name}</strong>
                  <span>{boss.defeated ? 'Defeated' : boss.unlocked ? 'Unlocked' : 'Locked'}</span>
                  <small>{boss.id === 'trial' ? `${boss.unlockValue}/50 trial cards` : boss.id === 'final-board' ? `${boss.unlockValue}/3 annual mocks` : `${boss.unlockValue}% module complete`}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="subsection">
            <h3>癌別完成度</h3>
            <div className="plan-cancer-grid">
              {planSummary.byCancer.map((row) => (
                <div className="plan-cancer-card" key={row.cancer}>
                  <div className="plan-cancer-head">
                    <strong>{row.cancer}</strong>
                    <span>{row.completed}/{row.total}</span>
                  </div>
                  <div className="progress-bar"><span style={{ width: `${row.percent}%` }} /></div>
                  <div className="inline-actions mini">
                    <button className="tiny" onClick={() => setPlanCancerCompleted(row.cancer, true)}>全選</button>
                    <button className="tiny secondary" onClick={() => setPlanCancerCompleted(row.cancer, false)}>清除</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="subsection">
            <h3>Daily Checklist</h3>
            <div className="plan-task-list">
              {studyPlan100.map((task) => {
                const taskStorageId = getPlanTaskStorageId(task);
                const done = getPlanProgressValue(planProgress, task);
                const itemProgress = getPlanItemProgressForTask(state, taskStorageId);
                const criteriaItems = getTaskCriteriaItems(task);
                const knowledgeItems = getTaskKnowledgeItems(task);
                const confirmedCount = criteriaItems.filter((item) => itemProgress.criteria?.[item]).length
                  + knowledgeItems.filter((item) => itemProgress.knowledge?.[item]).length;
                const totalConfirmations = criteriaItems.length + knowledgeItems.length;
                return (
                  <article key={taskStorageId} className={done ? 'plan-task done' : 'plan-task'}>
                    <input
                      type="checkbox"
                      checked={done}
                      aria-label={`${task.day} complete`}
                      onChange={(event) => togglePlanTask(taskStorageId, event.target.checked)}
                    />
                    <div className="plan-task-main">
                      <div className="plan-task-title">
                        <span className="day-chip">{task.day}</span>
                        <strong>{task.topic}</strong>
                        <span className="pill soft">{task.module}</span>
                        <span className="pill">{task.cancer}</span>
                        <span className={task.priority === 'High' ? 'priority high' : 'priority'}>{task.priority}</span>
                        <span className="high-yield-weight">Weight {task.highYieldWeight || 3}</span>
                        <span className={confirmedCount === totalConfirmations ? 'confirmation-progress done' : 'confirmation-progress'}>{confirmedCount}/{totalConfirmations} confirmed</span>
                      </div>
                      <p className="phase-line">{task.phase}</p>
                      <p>{task.details}</p>
                      <div className="trial-tags">
                        {knowledgeItems.map((item) => (
                          <button
                            key={item}
                            type="button"
                            className={itemProgress.knowledge?.[item] ? 'chip-check knowledge done' : 'chip-check knowledge'}
                            onClick={(event) => {
                              event.stopPropagation();
                              togglePlanItem(task, 'knowledge', item);
                            }}
                          >
                            <span>{itemProgress.knowledge?.[item] ? '✓' : '○'}</span>
                            {item}
                          </button>
                        ))}
                      </div>
                      <div className="criteria-tags">
                        {criteriaItems.map((criterion) => (
                          <button
                            key={criterion}
                            type="button"
                            className={itemProgress.criteria?.[criterion] ? 'chip-check criteria done' : 'chip-check criteria'}
                            onClick={(event) => {
                              event.stopPropagation();
                              togglePlanItem(task, 'criteria', criterion);
                            }}
                          >
                            <span>{itemProgress.criteria?.[criterion] ? '✓' : '○'}</span>
                            {criterion}
                          </button>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </main>
      )}


      {tab === 'sync' && (
        <SyncPanel
          user={user}
          syncStatus={syncStatus}
          syncError={syncError}
          configStatus={firebaseConfigStatus}
          onLogin={loginWithEmail}
          onRegister={registerWithEmail}
          onLogout={logoutCloud}
          onPushLocalToCloud={pushLocalToCloud}
          onPullCloudToLocal={pullCloudToLocal}
        />
      )}

      {tab === 'settings' && (
        <main className="panel settings-panel">
          <div className="settings-head">
            <div>
              <h2>Settings / Backup</h2>
              <p className="muted">調整練習範圍、音效回饋與資料備份。</p>
            </div>
          </div>
          <div className="settings-grid">
            <section className="settings-card">
              <div className="settings-card-title">Practice Mode</div>
              <PracticeModeSelector value={selectedPracticeMode} onChange={setPracticeMode} />
              <span className="muted">目前模式會產生 {selectedPracticeConfig.total} 題，完成後獎勵 {selectedPracticeConfig.xp} XP。</span>
            </section>
            <section className="settings-card">
              <div className="settings-card-title">年份篩選</div>
              <div className="check-row">
                {QUESTION_YEARS.map((year) => (
                  <label className="check-pill" key={year}>
                    <input type="checkbox" checked={state.settings.preferredYears.includes(year)} onChange={(e) => {
                      const next = e.target.checked
                        ? [...state.settings.preferredYears, year]
                        : state.settings.preferredYears.filter((x) => x !== year);
                      updateSettings({ preferredYears: next });
                    }} />
                    <span>{year}</span>
                  </label>
                ))}
              </div>
            </section>
          </div>
          <section className="settings-card subsection">
            <div className="settings-card-title">癌別練習篩選</div>
            <div className="category-grid">
              {cancerCategories.map((c) => (
                <label className="check-pill" key={c}>
                  <input type="checkbox" checked={state.settings.preferredCancers.includes(c)} onChange={(e) => {
                    const next = e.target.checked
                      ? [...state.settings.preferredCancers, c]
                      : state.settings.preferredCancers.filter((x) => x !== c);
                    updateSettings({ preferredCancers: next });
                  }} />
                  <span>{c}</span>
                </label>
              ))}
            </div>
            <div className="settings-actions">
              <button className="secondary" onClick={() => updateSettings({ preferredCancers: [] })}>清除癌別篩選</button>
            </div>
          </section>
          <section className="settings-card subsection">
            <div className="settings-card-title">音效 / 震動測試</div>
            <div className="settings-actions">
              <button className="sound-test-button sound-correct" type="button" onClick={() => playResultFeedback('correct')}>答對音效</button>
              <button className="sound-test-button sound-wrong" type="button" onClick={() => playResultFeedback('wrong')}>答錯音效</button>
              <button className="sound-test-button sound-chest" type="button" onClick={playTaskCompletionFeedback}>寶箱音效</button>
            </div>
          </section>
          <section className="settings-card subsection">
            <div className="settings-card-title">資料備份</div>
            <div className="settings-actions">
            <button className="secondary" onClick={exportBackup}>匯出備份 JSON</button>
            <label className="file-button">匯入備份 JSON<input type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} /></label>
            <button className="danger" onClick={resetAll}>清除所有資料</button>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
