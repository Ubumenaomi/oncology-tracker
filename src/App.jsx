import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import './App.css';
import { questionBank, cancerCategories } from './data/questionBank.js';
import { buildFlashcardTags } from './data/taxonomy.js';
import {
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from './firebase.js';

const STORAGE_KEY = 'oncologyTracker.aiReview.v1';
const EMPTY_ARRAY = Object.freeze([]);
const ERROR_TYPE_OPTIONS = [
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
  'Knowledge gap': {
    task: 'Guideline / core table review',
    cardType: 'Core Table Card',
    action: '回 guideline 與核心表格，把缺口整理成一張核心整理卡。',
  },
  'Trial confusion': {
    task: 'Trial Card',
    cardType: 'Trial Card',
    action: '建立或複習 Trial Card：population、intervention、endpoint、OS/PFS 與適用情境。',
  },
  'Biomarker cutoff': {
    task: 'Cloze Card',
    cardType: 'Cloze Card',
    action: '把 cutoff、threshold、duration 或數字做成填空卡。',
  },
  'Treatment sequence': {
    task: 'Algorithm Card',
    cardType: 'Algorithm Card',
    action: '把一線/二線/維持/術前術後順序整理成流程卡。',
  },
  'Misread question': {
    task: 'Question-reading reminder',
    cardType: 'Exam Trap Card',
    action: '補一條審題提醒：否定詞、例外條件、疾病期別、line of therapy。',
  },
  Toxicity: {
    task: 'Toxicity comparison',
    cardType: 'Toxicity Card',
    action: '整理 AE、contraindication、dose hold/discontinue 的比較表。',
  },
  'Guideline outdated': {
    task: 'Latest guideline check',
    cardType: 'Guideline Update Card',
    action: '標記需更新 NCCN / ESMO / ASCO，補上新舊標準差異。',
  },
  Overconfidence: {
    task: 'High-confidence wrong audit',
    cardType: 'Exam Trap Card',
    action: '回看為什麼很有把握卻錯，寫成陷阱提醒與重測題。',
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
- errorType: 從 Knowledge gap, Misread question, Trial confusion, Biomarker cutoff, Treatment sequence, Toxicity, Guideline outdated, Overconfidence 選一個

製卡規則：
1. 不要把整個題目題幹直接變成 front。
2. 每張卡只測一個可轉移的 decision rule 或核心概念。
3. Trial Card 必須包含 population / intervention / comparator / endpoint / exam trap。
4. Algorithm Card 必須包含 treatment sequencing 與 contraindication / exception。
5. Cloze Card 必須針對 cutoff、duration、endpoint、dose、eligibility。
6. Trap Card 必須指出常見錯誤敘述為何錯。
7. 醫學名詞與藥名保留英文，其餘用繁體中文。
8. back 要 concise，但要足夠讓我考前複習。`;

const FLASHCARD_RATINGS = {
  Again: { interval: 1, masteryDelta: -1 },
  Hard: { interval: 3, masteryDelta: 0 },
  Good: { interval: 7, masteryDelta: 1 },
  Easy: { interval: 21, masteryDelta: 2 },
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
const FEEDBACK_SOUND_PATHS = {
  correct: '/sounds/correct.mp3',
  wrong: '/sounds/wrong.mp3',
  taskCompletion: '/sounds/task-completion.mp3',
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
  Object.entries(FEEDBACK_SOUND_PATHS).forEach(([key, path]) => {
    feedbackAudioElements[key] ||= new Audio(path);
    feedbackAudioElements[key].preload = 'auto';
    feedbackAudioElements[key].load();
  });

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
  const audio = new Audio(path);
  audio.preload = 'auto';
  audio.volume = soundKey === 'wrong' ? 0.9 : 0.85;

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

const HIGH_YIELD_TOPICS = [
  {
    id: 'lung-perioperative-io',
    label: 'Lung perioperative IO',
    cancer: 'Lung',
    type: '每年高頻＋近年更新',
    examFrequency: 5,
    recentUpdate: 5,
    aliases: ['perioperative', 'neoadjuvant', 'adjuvant', 'pembrolizumab', 'nivolumab', 'atezolizumab', 'checkmate 816', 'keynote-671', 'impower010'],
  },
  {
    id: 'breast-adc',
    label: 'Breast ADC',
    cancer: 'Breast',
    type: '每年高頻＋近年更新',
    examFrequency: 5,
    recentUpdate: 5,
    aliases: ['adc', 't-dxd', 'trastuzumab deruxtecan', 'sacituzumab', 'her2-low', 'destiny-breast', 'trop2'],
  },
  {
    id: 'gu-ev-pembro',
    label: 'GU EV/pembro',
    cancer: 'GU',
    type: '每年高頻＋近年更新',
    examFrequency: 5,
    recentUpdate: 5,
    aliases: ['enfortumab', 'ev', 'pembrolizumab', 'urothelial', 'ev-302', 'javelin', 'fgfr'],
  },
  {
    id: 'gyn-io',
    label: 'GYN IO',
    cancer: 'GYN',
    type: '每年高頻＋近年更新',
    examFrequency: 5,
    recentUpdate: 5,
    aliases: ['endometrial', 'cervical', 'dmmr', 'pmmr', 'dostarlimab', 'pembrolizumab', 'keynote-a18', 'keynote-775', 'ruby'],
  },
  {
    id: 'crc-algorithm',
    label: 'CRC algorithm',
    cancer: 'GI',
    type: '常考 algorithm',
    examFrequency: 4,
    recentUpdate: 3,
    aliases: ['crc', 'colon', 'rectal', 'ras', 'braf', 'msi', 'her2', 'anti-egfr', 'folfox', 'folfiri', 'tnt'],
  },
  {
    id: 'hcc-algorithm',
    label: 'HCC algorithm',
    cancer: 'GI',
    type: '常考 algorithm',
    examFrequency: 4,
    recentUpdate: 4,
    aliases: ['hcc', 'atezo', 'bevacizumab', 'stride', 'himalaya', 'imbrave', 'durvalumab', 'tremelimumab'],
  },
  {
    id: 'mcrpc-algorithm',
    label: 'mCRPC',
    cancer: 'GU',
    type: '常考 algorithm',
    examFrequency: 4,
    recentUpdate: 4,
    aliases: ['mcrpc', 'prostate', 'parpi', 'lu-177', 'psma', 'cabazitaxel', 'abiraterone', 'enzalutamide'],
  },
  {
    id: 'rcc-algorithm',
    label: 'RCC algorithm',
    cancer: 'GU',
    type: '常考 algorithm',
    examFrequency: 4,
    recentUpdate: 4,
    aliases: ['rcc', 'renal', 'keynote-564', 'io/tki', 'checkmate-9er', 'clear', 'cabozantinib', 'lenvatinib'],
  },
  {
    id: 'ici-toxicity',
    label: 'ICI toxicity',
    cancer: 'Supportive/Stats',
    type: '支持性治療 / toxicity',
    examFrequency: 3,
    recentUpdate: 3,
    aliases: ['ici', 'irae', 'pneumonitis', 'colitis', 'hepatitis', 'endocrine', 'myocarditis', 'toxicity'],
  },
  {
    id: 'adc-ild',
    label: 'ADC ILD',
    cancer: 'Supportive/Stats',
    type: '支持性治療 / toxicity',
    examFrequency: 3,
    recentUpdate: 5,
    aliases: ['adc', 'ild', 'pneumonitis', 't-dxd', 'trastuzumab deruxtecan', 'enfortumab', 'sacituzumab'],
  },
  {
    id: 'febrile-neutropenia',
    label: 'Febrile neutropenia',
    cancer: 'Supportive/Stats',
    type: '支持性治療 / toxicity',
    examFrequency: 3,
    recentUpdate: 2,
    aliases: ['febrile neutropenia', 'neutropenic fever', 'anc', 'mascc', 'g-csf', 'infection'],
  },
  {
    id: 'rare-sarcoma-cup-hereditary',
    label: 'Sarcoma / CUP / MEN / VHL',
    cancer: 'Other',
    type: '低頻但會考',
    examFrequency: 2,
    recentUpdate: 2,
    aliases: ['sarcoma', 'cup', 'men', 'vhl', 'gist', 'net', 'thyroid', 'ihc', 'rare'],
  },
  {
    id: 'epidemiology-background',
    label: 'Epidemiology background',
    cancer: 'Other',
    type: '純背景知識',
    examFrequency: 1,
    recentUpdate: 1,
    aliases: ['epidemiology', 'incidence', 'mortality', 'risk factor', 'screening'],
  },
];

function formatLocalDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TODAY = formatLocalDate(new Date());

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

const QUESTION_YEARS = [...new Set(questionBank
  .map((question) => Number(question.year))
  .filter((year) => Number.isFinite(year)))]
  .sort((a, b) => a - b);
const QUESTION_YEAR_KEY = QUESTION_YEARS.join(',');
const QUESTION_YEAR_LABEL = QUESTION_YEARS.length
  ? `${QUESTION_YEARS[0]}–${QUESTION_YEARS[QUESTION_YEARS.length - 1]}`
  : '題庫';

const defaultState = {
  sessions: {},
  focusSessions: [],
  stats: {},
  settings: {
    dailyCount: 30,
    practiceMode: 'standard',
    preferredYears: QUESTION_YEARS,
    questionYearVersion: QUESTION_YEAR_KEY,
    preferredCancers: [],
  },
  planProgress: {},
  planItemProgress: {},
  dailyQuestProgress: {},
  bossProgress: {},
  questionOverrides: {},
  customQuestions: {},
  deletedQuestionIds: {},
  mockExams: [],
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

const planModules = [
  {
    module: 'Lung',
    cancer: 'Lung',
    days: 13,
    phase: 'Phase 1: High-frequency cancer progression',
    bossUnlockContribution: 'Lung Boss',
    tasks: [
      ['NSCLC foundation', 'TNM, resectability, molecular testing, PD-L1 TPS, perioperative decision points', ['NCCN Algorithm'], ['algorithm', 'biomarker', 'NSCLC']],
      ['EGFR early NSCLC', 'Adjuvant osimertinib, EGFR exon 19/L858R, postop chemotherapy role', ['ADAURA'], ['EGFR', 'adjuvant', 'targeted therapy']],
      ['Unresectable stage III NSCLC', 'Definitive CCRT, durvalumab consolidation, PACIFIC eligibility and endpoints', ['PACIFIC'], ['CCRT', 'durvalumab', 'endpoint']],
      ['Neoadjuvant chemo-IO', 'Resectable NSCLC, pCR/MPR/EFS definitions and trial traps', ['CheckMate 816'], ['neoadjuvant', 'ICI', 'endpoint']],
      ['Perioperative pembrolizumab', 'Stage II-IIIB NSCLC, neoadjuvant pembrolizumab-chemo to adjuvant pembrolizumab', ['KEYNOTE-671'], ['perioperative', 'ICI', 'EFS']],
      ['ALK/ROS1/RET/MET/NTRK', 'Driver-positive metastatic sequencing and resistance pattern recognition', ['CROWN', 'PROFILE', 'LIBRETTO'], ['biomarker', 'targeted therapy', 'sequencing']],
      ['KRAS/HER2/BRAF/MET exon 14', 'Actionable mutations, drug names, eligibility, toxicity traps', ['CodeBreaK', 'DESTINY-Lung'], ['KRAS', 'HER2', 'biomarker']],
      ['Metastatic ICI algorithms', 'PD-L1 high, chemo-IO, dual IO, contraindications, progression patterns', ['KEYNOTE-024', 'KEYNOTE-189', 'CheckMate-227'], ['metastatic', 'ICI', 'algorithm']],
      ['SCLC limited stage', 'Concurrent chemoradiation, BID vs QD RT, PCI, CONVERT and CALGB 30610', ['CONVERT', 'CALGB 30610'], ['SCLC', 'radiation', 'trial']],
      ['SCLC extensive stage', 'Platinum-etoposide plus ICI, maintenance, lurbinectedin, thoracic RT traps', ['IMpower133', 'CASPIAN'], ['SCLC', 'metastatic', 'ICI']],
      ['Mesothelioma', 'First-line IO, histology, surgical controversies, TTFields and toxicity', ['CheckMate-743'], ['mesothelioma', 'ICI', 'rare']],
      ['Lung toxicity drill', 'Pneumonitis, EGFR/ALK adverse effects, ADC ILD, radiation recall', ['Toxicity Review'], ['toxicity', 'ILD', 'TKI']],
      ['Lung boss prep', '20-question Lung mixed bank: biomarkers, perioperative, SCLC, mesothelioma', ['Lung Boss'], ['boss', 'mixed mock', 'weakness repair']],
    ],
  },
  {
    module: 'Breast',
    cancer: 'Breast',
    days: 13,
    phase: 'Phase 1: High-frequency cancer progression',
    bossUnlockContribution: 'Breast Boss',
    tasks: [
      ['Early HR+/HER2- framework', 'Risk stratification, endocrine therapy, OFS, chemo decision', ['TAILORx', 'RxPONDER'], ['HR+', 'adjuvant', 'algorithm']],
      ['Gene expression profile', 'Oncotype DX, MammaPrint, PAM50, EndoPredict, what each test can and cannot do', ['TAILORx', 'MINDACT'], ['biomarker', 'gene expression', 'adjuvant']],
      ['Adjuvant CDK4/6', 'High-risk criteria, monarchE, NATALEE, duration, toxicity', ['monarchE', 'NATALEE'], ['CDK4/6', 'adjuvant', 'toxicity']],
      ['HER2+ early disease', 'Neoadjuvant HP-chemo, residual disease, adjuvant T-DM1', ['KATHERINE', 'APHINITY'], ['HER2', 'neoadjuvant', 'ADC']],
      ['TNBC neoadjuvant IO', 'KEYNOTE-522 population, pCR/EFS, adjuvant pembrolizumab continuation', ['KEYNOTE-522'], ['TNBC', 'ICI', 'neoadjuvant']],
      ['gBRCA and PARPi', 'OlympiA eligibility, TNBC/luminal high-risk definitions, iDFS/OS', ['OlympiA'], ['PARPi', 'BRCA', 'adjuvant']],
      ['Metastatic HR+/HER2-', 'Endocrine-CDK4/6 sequencing, ESR1, PIK3CA, AKT pathway choices', ['PALOMA', 'MONALEESA', 'SOLAR-1'], ['metastatic', 'sequencing', 'biomarker']],
      ['HER2+ metastatic', 'First-line HP-taxane, second-line T-DXd, brain metastasis options', ['CLEOPATRA', 'DESTINY-Breast03', 'HER2CLIMB'], ['HER2', 'metastatic', 'ADC']],
      ['HER2-low and ADC', 'HER2-low definition, T-DXd eligibility, ILD monitoring', ['DESTINY-Breast04'], ['HER2-low', 'ADC', 'toxicity']],
      ['TNBC metastatic', 'PD-L1 assays, sacituzumab, PARPi, TROP2 ADC traps', ['ASCENT', 'KEYNOTE-355'], ['TNBC', 'ADC', 'PD-L1']],
      ['Breast toxicity drill', 'CDK4/6 neutropenia/QTc/diarrhea, PI3K hyperglycemia, ADC ILD', ['Toxicity Review'], ['toxicity', 'ADC', 'CDK4/6']],
      ['Breast trial endpoint recall', 'Blank recall for population, intervention, endpoint, OS/PFS/iDFS', ['Golden Trial Recall'], ['trial', 'endpoint', 'flashcard']],
      ['Breast boss prep', 'HER2/TNBC/HR+ mixed mock and correction', ['Breast Boss'], ['boss', 'mixed mock', 'weakness repair']],
    ],
  },
  {
    module: 'GI',
    cancer: 'GI',
    days: 12,
    phase: 'Phase 1: High-frequency cancer progression',
    bossUnlockContribution: 'GI Boss',
    tasks: [
      ['CRC biomarkers', 'RAS/BRAF/MSI/HER2/NTRK, sidedness, anti-EGFR rules', ['FIRE-3', 'PARADIGM'], ['CRC', 'biomarker', 'metastatic']],
      ['Metastatic CRC sequencing', 'FOLFOX/FOLFIRI, bevacizumab beyond progression, EGFR rechallenge, TAS-102', ['VELOUR', 'RAISE', 'SUNLIGHT'], ['CRC', 'sequencing', 'metastatic']],
      ['Rectal TNT', 'PRODIGE-23, RAPIDO, OPRA, watch-and-wait, endpoint traps', ['PRODIGE-23', 'RAPIDO', 'OPRA'], ['rectal', 'neoadjuvant', 'radiation']],
      ['Adjuvant colon cancer', 'Stage II risk, stage III duration, IDEA, ctDNA caveats', ['IDEA'], ['colon', 'adjuvant', 'algorithm']],
      ['Gastric/GEJ first-line', 'HER2, PD-L1 CPS, CLDN18.2, chemo-IO, trastuzumab choices', ['CheckMate-649', 'KEYNOTE-859', 'SPOTLIGHT'], ['gastric', 'GEJ', 'biomarker']],
      ['Esophageal cancer', 'CROSS, CheckMate-577, definitive CCRT, squamous vs adenocarcinoma', ['CROSS', 'CheckMate-577'], ['esophageal', 'CCRT', 'adjuvant']],
      ['HCC systemic therapy', 'Atezo-bev, STRIDE, second-line sequencing, contraindications', ['IMbrave150', 'HIMALAYA'], ['HCC', 'ICI', 'sequencing']],
      ['Pancreas cancer', 'Adjuvant modified FOLFIRINOX, metastatic regimens, BRCA/PARPi', ['PRODIGE-24', 'POLO'], ['pancreas', 'PARPi', 'adjuvant']],
      ['Biliary tract cancer', 'TOPAZ-1, KEYNOTE-966, FGFR2, IDH1, HER2, BRAF', ['TOPAZ-1', 'KEYNOTE-966'], ['biliary', 'biomarker', 'ICI']],
      ['GIST and NET', 'KIT/PDGFRA, imatinib dose, avapritinib, sunitinib/regorafenib/ripretinib', ['GIST Review'], ['GIST', 'targeted therapy', 'rare']],
      ['GI toxicity and supportive traps', 'EGFR rash/hypomagnesemia, diarrhea, hepatic dysfunction, nutrition', ['Toxicity Review'], ['toxicity', 'supportive', 'GI']],
      ['GI boss prep', 'GI mixed mock with CRC, gastric/GEJ, rectal TNT, HCC, biliary', ['GI Boss'], ['boss', 'mixed mock', 'weakness repair']],
    ],
  },
  {
    module: 'GU', cancer: 'GU', days: 9, phase: 'Phase 1: High-frequency cancer progression', bossUnlockContribution: 'GU Readiness',
    tasks: [
      ['RCC adjuvant and metastatic', 'KEYNOTE-564, IO/TKI first-line choices, risk groups, toxicity', ['KEYNOTE-564', 'CheckMate-9ER', 'CLEAR'], ['RCC', 'ICI', 'TKI']],
      ['Urothelial perioperative', 'Cisplatin eligibility, neoadjuvant chemo, adjuvant nivolumab', ['CheckMate-274'], ['urothelial', 'perioperative', 'cisplatin']],
      ['Urothelial metastatic', 'EV-pembrolizumab, avelumab maintenance, FGFR, EV toxicity', ['EV-302', 'JAVELIN-Bladder-100', 'THOR'], ['urothelial', 'ADC', 'FGFR']],
      ['Prostate hormone-sensitive', 'Triplet therapy, ARPI selection, docetaxel, volume/risk traps', ['ARASENS', 'PEACE-1'], ['prostate', 'ARPI', 'metastatic']],
      ['mCRPC sequencing', 'PARPi combinations, Lu-177 PSMA, radium-223, cabazitaxel', ['VISION', 'PROpel', 'TALAPRO-2'], ['prostate', 'PARPi', 'radioligand']],
      ['Seminoma and germ cell', 'Stage I/II seminoma, RT fields, BEP/EP, salvage concepts', ['Seminoma Review'], ['seminoma', 'radiation', 'algorithm']],
      ['GU biomarkers', 'BRCA/HRR, FGFR, MSI, PD-L1 caveats, germline testing', ['Biomarker Review'], ['biomarker', 'BRCA', 'FGFR']],
      ['GU toxicity drill', 'EV rash/hyperglycemia/neuropathy, TKI HTN, IO nephritis', ['Toxicity Review'], ['toxicity', 'ADC', 'TKI']],
      ['GU mixed correction', 'Fix GU wrong-rate >=50% and mastery <=2 questions', ['Weakness Review'], ['weakness repair', 'wrong retest', 'GU']],
    ],
  },
  {
    module: 'GYN', cancer: 'GYN', days: 8, phase: 'Phase 2: Trap-topic progression', bossUnlockContribution: 'GYN Readiness',
    tasks: [
      ['Endometrial IO', 'dMMR/pMMR, lenvatinib-pembrolizumab, dostarlimab/carbo-taxol', ['KEYNOTE-775', 'RUBY'], ['endometrial', 'ICI', 'biomarker']],
      ['Cervical CCRT and IO', 'KEYNOTE-A18, brachytherapy OAR, recurrent/metastatic pembrolizumab', ['KEYNOTE-A18', 'KEYNOTE-826'], ['cervical', 'CCRT', 'ICI']],
      ['Ovarian first-line maintenance', 'BRCA/HRD, bevacizumab, olaparib/niraparib, PAOLA-1', ['SOLO-1', 'PAOLA-1', 'PRIMA'], ['ovarian', 'PARPi', 'maintenance']],
      ['Ovarian recurrence', 'Platinum-sensitive vs resistant, mirvetuximab, FRalpha, PARPi retreatment traps', ['MIRASOL'], ['ovarian', 'ADC', 'biomarker']],
      ['GYN trial interpretation', 'PFS vs OS, maintenance endpoints, subgroup forest plots', ['Trial Interpretation'], ['endpoint', 'statistics', 'GYN']],
      ['GYN toxicity drill', 'PARPi cytopenia/MDS, IO toxicity, bevacizumab bowel/perforation risk', ['Toxicity Review'], ['toxicity', 'PARPi', 'ICI']],
      ['GYN rapid algorithm', 'Endometrial/cervical/ovarian treatment sequencing blank recall', ['Algorithm Recall'], ['algorithm', 'flashcard', 'GYN']],
      ['GYN mixed correction', 'Fix GYN wrong-rate >=50% and high-confidence wrong questions', ['Weakness Review'], ['weakness repair', 'wrong retest', 'GYN']],
    ],
  },
  {
    module: 'Heme', cancer: 'Heme', days: 10, phase: 'Phase 2: Trap-topic progression', bossUnlockContribution: 'Heme Readiness',
    tasks: [
      ['Hodgkin lymphoma', 'ABVD vs A+AVD, PET-adapted therapy, brentuximab toxicity, checkpoint inhibitors', ['ECHELON-1', 'RATHL'], ['HL', 'toxicity', 'trial']],
      ['DLBCL and CAR-T', 'R-CHOP, pola-R-CHP, second-line CAR-T, bridging, CRS/ICANS', ['POLARIX', 'ZUMA-7', 'TRANSFORM'], ['DLBCL', 'CAR-T', 'toxicity']],
      ['Indolent lymphoma', 'FL/MCL/CLL treatment triggers, BTK inhibitors, venetoclax, anti-CD20', ['CLL Review'], ['CLL', 'BTK', 'sequencing']],
      ['Multiple myeloma frontline', 'Transplant eligibility, quadruplets, maintenance, high-risk cytogenetics', ['GRIFFIN', 'PERSEUS'], ['MM', 'transplant', 'maintenance']],
      ['Multiple myeloma relapse', 'BCMA, bispecifics, CAR-T, sequencing and infection risk', ['CARTITUDE', 'KarMMa'], ['MM', 'BCMA', 'CAR-T']],
      ['CML and AML', 'TKI milestones, resistance mutations, venetoclax/HMA, FLT3/IDH', ['CML Review', 'AML Review'], ['CML', 'AML', 'targeted therapy']],
      ['CNS lymphoma and special sites', 'PCNSL induction, consolidation, ocular/CNS relapse patterns', ['PCNSL Review'], ['PCNSL', 'algorithm', 'rare']],
      ['Heme toxicity drill', 'TLS, cytokine release, neuropathy, cytopenia, infection prophylaxis', ['Toxicity Review'], ['toxicity', 'TLS', 'supportive']],
      ['Heme trial endpoint recall', 'Blank recall of HL/DLBCL/MM pivotal trials and endpoints', ['Golden Trial Recall'], ['trial', 'endpoint', 'flashcard']],
      ['Heme mixed correction', 'Fix Heme wrong-rate >=50%, mastery <=2, high-confidence wrong', ['Weakness Review'], ['weakness repair', 'wrong retest', 'Heme']],
    ],
  },
  {
    module: 'Head & Neck', cancer: 'Head & Neck', days: 5, phase: 'Phase 2: Trap-topic progression', bossUnlockContribution: 'Head & Neck Boss',
    tasks: [
      ['HPV oropharynx and staging', 'HPV-positive prognosis, AJCC differences, de-escalation traps', ['HPV HNSCC Review'], ['HPV', 'staging', 'radiation']],
      ['Definitive and induction CCRT', 'Cisplatin vs cetuximab, TPF induction, larynx preservation trial traps', ['DeCIDE', 'RTOG 1016'], ['CCRT', 'induction', 'trial']],
      ['Recurrent/metastatic HNSCC', 'KEYNOTE-048, CheckMate-141, platinum timing, CPS interpretation', ['KEYNOTE-048', 'CheckMate-141'], ['metastatic', 'ICI', 'PD-L1']],
      ['Nasopharyngeal carcinoma', 'Gemcitabine-cisplatin, toripalimab/camrelizumab, EBV DNA, CCRT', ['JUPITER-02'], ['NPC', 'ICI', 'CCRT']],
      ['Head & Neck boss prep', 'HPV/HNSCC/NPC/CCRT mixed mock and correction', ['Head & Neck Boss'], ['boss', 'mixed mock', 'weakness repair']],
    ],
  },
  {
    module: 'Rare/Skin/Sarcoma/CUP/Other', cancer: 'Other', days: 7, phase: 'Phase 2: Trap-topic progression', bossUnlockContribution: 'Rare Readiness',
    tasks: [
      ['Melanoma adjuvant/metastatic', 'BRAF/MEK, PD-1, CTLA-4, relatlimab, brain metastasis', ['COMBI-AD', 'CheckMate-238'], ['melanoma', 'ICI', 'BRAF']],
      ['Non-melanoma skin cancers', 'CSCC, BCC, Merkel cell, immunotherapy and hedgehog inhibitors', ['KEYNOTE-629'], ['skin', 'ICI', 'rare']],
      ['Sarcoma systemic therapy', 'GIST separation, pazopanib, trabectedin, subtype-specific traps', ['PALETTE'], ['sarcoma', 'rare', 'targeted therapy']],
      ['CUP and IHC', 'Lung vs GI vs breast vs H&N markers, NGS, empiric therapy limits', ['CUP Review'], ['CUP', 'IHC', 'biomarker']],
      ['Endocrine/neuroendocrine tumors', 'MEN/VHL, thyroid, NET grading, somatostatin/PRRT', ['NETTER-1'], ['NET', 'thyroid', 'rare']],
      ['Rare tumor biomarkers', 'NTRK/RET/MSI/TMB/BRAF across tumor types', ['Tumor-agnostic Review'], ['biomarker', 'tumor agnostic', 'targeted therapy']],
      ['Rare/Other mixed correction', 'Fix rare tumor, CUP, skin, sarcoma wrong-rate >=50%', ['Weakness Review'], ['weakness repair', 'wrong retest', 'rare']],
    ],
  },
  {
    module: 'Supportive/Emergency/Stats', cancer: 'Supportive/Stats', days: 8, phase: 'Phase 2: Trap-topic progression', bossUnlockContribution: 'Supportive Readiness',
    tasks: [
      ['CINV and pain', 'Antiemetic risk groups, olanzapine, breakthrough nausea, opioid conversion', ['Supportive Review'], ['CINV', 'pain', 'supportive']],
      ['Oncologic emergencies', 'TLS, SIADH, MSCC, IICP, hypercalcemia, neutropenic fever', ['Emergency Review'], ['emergency', 'supportive', 'algorithm']],
      ['ICI toxicity', 'Pneumonitis, colitis, hepatitis, endocrine, myocarditis; hold vs steroid vs rechallenge', ['irAE Review'], ['ICI', 'toxicity', 'supportive']],
      ['ADC/TKI/PARPi toxicity', 'ILD, neuropathy, ocular toxicity, cytopenia, hypertension, QTc', ['Toxicity Review'], ['ADC', 'TKI', 'PARPi']],
      ['Biomarker mega-review', 'MSI/dMMR, PD-L1 CPS/TPS, HER2, BRCA/HRD, NTRK/RET, KRAS', ['Biomarker Review'], ['biomarker', 'tumor agnostic', 'rapid recall']],
      ['Statistics essentials', 'HR/CI/KM, ITT, non-inferiority, crossover, subgroup forest plot', ['Stats Review'], ['statistics', 'endpoint', 'trial interpretation']],
      ['Endpoint design drill', 'OS/PFS/EFS/DFS/iDFS/pCR/MRD definitions and exam traps', ['Endpoint Review'], ['endpoint', 'trial', 'flashcard']],
      ['Supportive/Stats mixed correction', 'Fix supportive and statistics wrong-rate >=50% questions', ['Weakness Review'], ['weakness repair', 'wrong retest', 'statistics']],
    ],
  },
];

const mockPlanTasks = [
  ['Phase 3: First full mock cycle', 'Mock + correction', 'Mock', '112 first full mock', 'Complete 112 full exam under timed conditions; no explanations until finished', ['112 Exam'], ['mock', '112', 'timed'], 'Final Board Boss'],
  ['Phase 3: First full mock cycle', 'Mock + correction', 'Mock', '112 correction', 'Classify every 112 wrong answer by error type and create cards for trial/biomarker/toxicity misses', ['112 Correction'], ['correction', 'error type', 'flashcard'], 'Final Board Boss'],
  ['Phase 3: First full mock cycle', 'Mock + correction', 'Mock', '113 first full mock', 'Complete 113 full exam under timed conditions; no explanations until finished', ['113 Exam'], ['mock', '113', 'timed'], 'Final Board Boss'],
  ['Phase 3: First full mock cycle', 'Mock + correction', 'Mock', '113 correction', 'Classify every 113 wrong answer and add high-confidence wrong to Critical Error Queue', ['113 Correction'], ['correction', 'critical error', 'flashcard'], 'Final Board Boss'],
  ['Phase 3: First full mock cycle', 'Mock + correction', 'Mock', '114 first full mock', 'Complete 114 full exam under timed conditions; no explanations until finished', ['114 Exam'], ['mock', '114', 'timed'], 'Final Board Boss'],
  ['Phase 3: First full mock cycle', 'Mock + correction', 'Mock', '114 correction', 'Classify every 114 wrong answer and tag score draggers by cancer/topic', ['114 Correction'], ['correction', 'score dragger', 'flashcard'], 'Final Board Boss'],
  ['Phase 3: First full mock cycle', 'Mock + correction', 'Mock', 'Mixed correction A', 'Repair top Lung/Breast/GI score draggers from first mock cycle', ['Weakness Review'], ['weakness repair', 'Lung', 'Breast', 'GI'], 'Final Board Boss'],
  ['Phase 3: First full mock cycle', 'Mock + correction', 'Mock', 'Mixed correction B', 'Repair Heme/GU/GYN/Head & Neck score draggers from first mock cycle', ['Weakness Review'], ['weakness repair', 'Heme', 'GU', 'GYN', 'Head & Neck'], 'Final Board Boss'],
  ['Phase 3: First full mock cycle', 'Mock + correction', 'Mock', 'Trial card checkpoint', 'Generate or review at least 50 pivotal trial cards; endpoint recall target 85%', ['Trial Boss'], ['trial', 'flashcard', 'endpoint'], 'Trial Boss'],
  ['Phase 3: First full mock cycle', 'Mock + correction', 'Mock', 'First cycle readiness audit', 'Review predicted score, volatility, red topics, and plan the weakness-only block', ['Readiness Audit'], ['readiness', 'volatility', 'red topic'], 'Final Board Boss'],
  ['Phase 5: Second full mock cycle', 'Mock + correction', 'Mock', '112 full mock retest', 'Retest 112; require wrong-retest conversion trend toward 90%', ['112 Retest'], ['mock', 'retest', '112'], 'Final Board Boss'],
  ['Phase 5: Second full mock cycle', 'Mock + correction', 'Mock', '113 full mock retest', 'Retest 113 and compare score volatility with first cycle', ['113 Retest'], ['mock', 'retest', '113'], 'Final Board Boss'],
  ['Phase 5: Second full mock cycle', 'Mock + correction', 'Mock', '114 full mock retest', 'Retest 114; all high-confidence wrong must become cards or review tasks', ['114 Retest'], ['mock', 'retest', '114'], 'Final Board Boss'],
  ['Phase 5: Second full mock cycle', 'Mock + correction', 'Mock', 'Wrong-retest 90 checkpoint', 'Only previously wrong questions; target wrong-retest conversion >=90%', ['Wrong Retest'], ['wrong retest', 'critical error', 'mastery'], 'Final Board Boss'],
  ['Phase 5: Second full mock cycle', 'Mock + correction', 'Mock', 'Mixed retest correction', 'Repair any remaining red topics after 112-114 retest and regenerate cards for persistent misses', ['Mixed Correction'], ['correction', 'red topic', 'flashcard'], 'Final Board Boss'],
  ['Phase 5: Second full mock cycle', 'Mock + correction', 'Mock', 'Final readiness lock', 'Confirm latest score trend, high-confidence wrong rate, and wrong-retest conversion before final rapid recall', ['Readiness Audit'], ['readiness', 'wrong retest', 'volatility'], 'Final Board Boss'],
  ['Phase 5: Second full mock cycle', 'Mock + correction', 'Mock', 'Final Board Boss', 'Mixed board boss: latest full mock >=75% and wrong-retest >=90%', ['Final Board Boss'], ['boss', 'mock', 'readiness'], 'Final Board Boss'],
];

const weaknessPlanTasks = Array.from({ length: 8 }, (_, index) => ({
  id: 83 + index,
  day: `Day ${83 + index}`,
  phase: 'Phase 4: Weakness repair only',
  module: 'Weakness Repair',
  cancer: 'Weakness Repair',
  topic: [
    'High-confidence wrong repair',
    'Wrong-rate >=50% Lung/Breast/GI',
    'Wrong-rate >=50% GU/GYN/Heme/Head & Neck',
    'Trial endpoint repair',
    'Biomarker cutoff repair',
    'Toxicity repair',
    'Statistics and trial interpretation repair',
    'Algorithm blank recall + Boss rematch',
  ][index],
  details: [
    'Redo every high-confidence wrong; write why the wrong choice felt attractive.',
    'Only Lung/Breast/GI score draggers with wrong-rate >=50%.',
    'Repair second-tier score draggers from GU, GYN, Heme, and Head & Neck.',
    'Turn every Trial confusion miss into a Trial Card.',
    'Repair PD-L1 CPS/TPS, HER2, MSI/dMMR, BRCA/HRD, RAS/BRAF, FGFR, and FRalpha cutoffs.',
    'Repair ICI, ADC, PARPi, TKI, CDK4/6, and EV toxicity traps.',
    'Repair HR/CI, non-inferiority, subgroup, crossover, and endpoint definition misses.',
    'Retry all failed Boss prompts and fill missing algorithm cards.',
  ][index],
  goldenTrials: ['Weakness Review'],
  focusTags: ['wrongRate >=50', 'mastery <=2', 'high-confidence wrong', 'repeated wrong'],
  requiredQuestionIds: [],
  bossUnlockContribution: 'Final Board Boss',
  priority: 'High',
}));

const rareSupportiveRequiredTasks = [
  ['Rare/Skin/Sarcoma/CUP/Other', 'Other', 'Melanoma / non-melanoma skin cancer', 'BRAF/MEK, PD-1, CTLA-4, relatlimab, CSCC, BCC, Merkel cell', ['COMBI-AD', 'CheckMate-238', 'KEYNOTE-629'], ['melanoma', 'skin', 'rare']],
  ['Rare/Skin/Sarcoma/CUP/Other', 'Other', 'Sarcoma / GIST', 'Separate GIST from sarcoma; KIT/PDGFRA, imatinib dose, avapritinib, pazopanib', ['GIST Review', 'PALETTE'], ['sarcoma', 'GIST', 'rare']],
  ['Rare/Skin/Sarcoma/CUP/Other', 'Other', 'CUP / IHC', 'CK7/CK20, TTF-1, PAX8, GATA3, CDX2, p40, thyroglobulin, NGS role', ['CUP Review'], ['CUP', 'IHC', 'biomarker']],
  ['Rare/Skin/Sarcoma/CUP/Other', 'Other', 'NET / thyroid / MEN / VHL / tumor-agnostic', 'NET grading, somatostatin analog, PRRT, NTRK/RET/MSI/TMB/BRAF', ['NETTER-1', 'Tumor-agnostic Review'], ['NET', 'MEN', 'VHL', 'rare']],
  ['Supportive/Emergency/Stats', 'Supportive/Stats', 'Oncologic emergencies', 'TLS, MSCC, SIADH, IICP, hypercalcemia, neutropenic fever', ['Emergency Review'], ['emergency', 'supportive', 'algorithm']],
  ['Supportive/Emergency/Stats', 'Supportive/Stats', 'Toxicity mega-review', 'ICI pneumonitis/colitis/hepatitis/endocrine/myocarditis; ADC ILD; PARPi cytopenia/MDS; TKI HTN/QTc', ['Toxicity Review'], ['ICI', 'ADC', 'toxicity']],
  ['Supportive/Emergency/Stats', 'Supportive/Stats', 'Statistics / endpoint design', 'HR/CI/KM, ITT, non-inferiority, crossover, subgroup forest plot, OS/PFS/EFS/DFS/iDFS/pCR/MRD', ['Stats Review', 'Endpoint Review'], ['statistics', 'endpoint', 'trial interpretation']],
];

const dailyCompletionCriteria = [
  'Daily Practice completed',
  'Boss 1-3 at least 2 pass',
  'Create 3-5 high-value cards',
  'Wrong answers classified by errorType',
];

function getTaskHighYieldWeight({ cancer, topic, details, focusTags = [], goldenTrials = [] }) {
  const text = [cancer, topic, details, ...focusTags, ...goldenTrials].join(' ').toLowerCase();
  const matched = HIGH_YIELD_TOPICS.filter((item) => (
    item.cancer === cancer
    || item.aliases.some((alias) => text.includes(String(alias).toLowerCase()))
  ));
  if (matched.length) return Math.max(...matched.map((item) => item.examFrequency));
  if (String(topic || '').toLowerCase().includes('toxicity') || focusTags.includes('toxicity')) return 3;
  if (['Other', 'Rare/Skin/Sarcoma/CUP/Other'].includes(cancer) || focusTags.includes('rare')) return 2;
  return 3;
}

function buildStudyPlan100() {
  const tasks = [];
  const moduleOrder = ['Lung', 'Breast', 'GI', 'GU', 'GYN', 'Head & Neck', 'Heme', 'Rare/Skin/Sarcoma/CUP/Other', 'Supportive/Emergency/Stats'];
  const orderedModules = [...planModules].sort((a, b) => moduleOrder.indexOf(a.module) - moduleOrder.indexOf(b.module));
  orderedModules.forEach((module) => {
    module.tasks.forEach(([topic, details, goldenTrials, focusTags]) => {
      const id = tasks.length + 1;
      const phase = id <= 45
        ? 'Phase 1: High-frequency cancer progression'
        : 'Phase 2: Trap-topic progression';
      tasks.push({
        id,
        day: `Day ${id}`,
        phase,
        module: module.module,
        cancer: module.cancer,
        topic,
        details,
        goldenTrials,
        focusTags,
        highYieldWeight: getTaskHighYieldWeight({ cancer: module.cancer, topic, details, focusTags, goldenTrials }),
        completionCriteria: dailyCompletionCriteria,
        requiredQuestionIds: [],
        bossUnlockContribution: module.bossUnlockContribution,
        priority: focusTags.includes('boss') || focusTags.includes('weakness repair') ? 'High' : 'High',
      });
    });
  });

  const withWeakness = tasks.slice(0, 100);

  rareSupportiveRequiredTasks.forEach(([module, cancer, topic, details, goldenTrials, focusTags], index) => {
    const id = 66 + index;
    withWeakness[id - 1] = {
      id,
      day: `Day ${id}`,
      phase: 'Phase 3: Rare + Supportive/Stats required block',
      module,
      cancer,
      topic,
      details,
      goldenTrials,
      focusTags,
      highYieldWeight: getTaskHighYieldWeight({ cancer, topic, details, focusTags, goldenTrials }),
      completionCriteria: dailyCompletionCriteria,
      requiredQuestionIds: [],
      bossUnlockContribution: 'Rare/Supportive Readiness',
      priority: 'High',
    };
  });

  mockPlanTasks.forEach(([phase, module, cancer, topic, details, goldenTrials, focusTags, bossUnlockContribution], index) => {
    const id = index < 10 ? 73 + index : 91 + (index - 10);
    withWeakness[id - 1] = {
      id,
      day: `Day ${id}`,
      phase,
      module,
      cancer,
      topic,
      details,
      goldenTrials,
      focusTags,
      highYieldWeight: getTaskHighYieldWeight({ cancer, topic, details, focusTags, goldenTrials }),
      completionCriteria: dailyCompletionCriteria,
      requiredQuestionIds: [],
      bossUnlockContribution,
      priority: 'High',
    };
  });

  weaknessPlanTasks.forEach((task) => {
    withWeakness[task.id - 1] = {
      ...task,
      highYieldWeight: getTaskHighYieldWeight(task),
      completionCriteria: dailyCompletionCriteria,
    };
  });

  [
    ['Golden trial rapid recall', 'Blank recall population/intervention/endpoint/result for all golden trials', ['Golden Trial Recall'], ['trial', 'endpoint', 'rapid recall']],
    ['Biomarker and toxicity rapid recall', 'MSI/dMMR, PD-L1 CPS/TPS, HER2, BRCA/HRD, NTRK/RET, ADC/ICI/PARPi/TKI toxicity', ['Biomarker Review', 'Toxicity Review'], ['biomarker', 'toxicity', 'rapid recall']],
    ['Algorithm final sprint', 'NSCLC, Breast, GI, GU, GYN, Heme sequencing flowcharts from memory', ['Algorithm Recall'], ['algorithm', 'rapid recall', 'final review']],
  ].forEach(([topic, details, goldenTrials, focusTags], index) => {
    const id = 98 + index;
    withWeakness[id - 1] = {
      id,
      day: `Day ${id}`,
      phase: 'Phase 6: Final rapid recall',
      module: 'Final Review',
      cancer: 'Final Review',
      topic,
      details,
      goldenTrials,
      focusTags,
      highYieldWeight: getTaskHighYieldWeight({ cancer: 'Final Review', topic, details, focusTags, goldenTrials }),
      completionCriteria: dailyCompletionCriteria,
      requiredQuestionIds: [],
      bossUnlockContribution: 'Final Board Boss',
      priority: 'High',
    };
  });

  return withWeakness.slice(0, 100);
}

const studyPlan100 = buildStudyPlan100();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeState(raw ? { ...defaultState, ...JSON.parse(raw) } : defaultState);
  } catch {
    return defaultState;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
      planTopic: session.planTopic || '',
    }));
}

function mergeFocusSessions(cloudSessions = [], localSessions = []) {
  const byId = new Map();
  [...normalizeFocusSessions(cloudSessions), ...normalizeFocusSessions(localSessions)].forEach((session) => {
    byId.set(session.id, session);
  });
  return [...byId.values()].sort((a, b) => String(b.startedAt || b.date).localeCompare(String(a.startedAt || a.date)));
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

  return normalizeState({
    ...defaultState,
    ...cloudState,
    ...localState,
    sessions: {
      ...(cloudState.sessions || {}),
      ...(localState.sessions || {}),
    },
    focusSessions: mergeFocusSessions(cloudState.focusSessions, localState.focusSessions),
    stats: {
      ...(cloudState.stats || {}),
      ...(localState.stats || {}),
    },
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
    mockExams: [
      ...(cloudState.mockExams || []),
      ...(localState.mockExams || []),
    ].filter((exam, index, exams) => exam?.id && exams.findIndex((x) => x.id === exam.id) === index),
    deletedFlashcardIds,
    flashcards: mergeFlashcardMaps(cloudState.flashcards, localState.flashcards, deletedFlashcardIds),
    flashcardStats: {
      ...(cloudState.flashcardStats || {}),
      ...(localState.flashcardStats || {}),
    },
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

function makeCloudPayload(state) {
  return {
    ...state,
    cloudMeta: {
      ...(state.cloudMeta || {}),
      updatedAt: new Date().toISOString(),
      device: navigator.userAgent,
    },
    serverUpdatedAt: serverTimestamp(),
  };
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
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

function normalizeFlashcard(card) {
  const normalizedTags = [...new Set(normalizeTextList(card.tags))];
  const normalizedTrial = [...new Set(normalizeTextList(card.trial))];
  const baseCard = {
    ...card,
    tags: normalizedTags,
    trial: normalizedTrial,
  };
  const taxonomyTags = buildFlashcardTags(baseCard);
  return {
    ...baseCard,
    front: String(card.front || ''),
    back: String(card.back || ''),
    type: normalizeFlashcardType(card.type, card.sourceType),
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
    normalized[card.id] = {
      attempts: 0,
      correct: 0,
      wrong: 0,
      mastery: card.mastery || 0,
      intervalDays: card.intervalDays || 1,
      nextReviewDate: card.nextReviewDate || null,
      lastReviewedAt: card.lastReviewedAt || null,
      ...(normalized[card.id] || {}),
    };
  });
  return normalized;
}

function removeDeletedFlashcardRecords(records = {}, deletedFlashcardIds = {}) {
  return Object.fromEntries(Object.entries(records || {}).filter(([id]) => !deletedFlashcardIds[id]));
}

function normalizePlanItemProgress(progress = {}) {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return {};
  return Object.fromEntries(Object.entries(progress).map(([taskId, item]) => {
    const criteria = item?.criteria && typeof item.criteria === 'object' && !Array.isArray(item.criteria) ? item.criteria : {};
    const knowledge = item?.knowledge && typeof item.knowledge === 'object' && !Array.isArray(item.knowledge) ? item.knowledge : {};
    return [taskId, {
      criteria: Object.fromEntries(Object.entries(criteria).filter(([, value]) => Boolean(value))),
      knowledge: Object.fromEntries(Object.entries(knowledge).filter(([, value]) => Boolean(value))),
      updatedAt: item?.updatedAt || null,
    }];
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
    .map((card) => ({
      ...card,
      ...(stats?.[card.id] || {}),
      id: card.id,
      mastery: stats?.[card.id]?.mastery ?? card.mastery ?? 0,
      intervalDays: stats?.[card.id]?.intervalDays ?? card.intervalDays ?? 1,
      nextReviewDate: stats?.[card.id]?.nextReviewDate ?? card.nextReviewDate ?? TODAY,
    }))
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
  return {
    ...defaultState,
    ...state,
    settings: {
      ...defaultState.settings,
      ...stateSettings,
      preferredYears,
      questionYearVersion: QUESTION_YEAR_KEY,
      practiceMode: PRACTICE_MODES[stateSettings.practiceMode] ? stateSettings.practiceMode : 'standard',
    },
    planItemProgress: normalizePlanItemProgress(state?.planItemProgress),
    dailyQuestProgress: state?.dailyQuestProgress || {},
    bossProgress: state?.bossProgress || {},
    questionOverrides: state?.questionOverrides || {},
    customQuestions: state?.customQuestions || {},
    deletedQuestionIds: state?.deletedQuestionIds || {},
    deletedFlashcardIds,
    focusSessions: normalizeFocusSessions(state?.focusSessions),
    flashcards,
    flashcardStats: normalizeFlashcardStats(removeDeletedFlashcardRecords(state?.flashcardStats, deletedFlashcardIds), flashcards),
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
  return Object.values(state.stats || {}).reduce((sum, stat) => {
    const reviewedToday = (stat.answerHistory || []).some((event) => event.date === date && event.mode === 'review');
    return sum + (reviewedToday ? 1 : 0);
  }, 0);
}

function getTodayFlashcardReviewCount(state, date = TODAY) {
  return Object.values(state.flashcardStats || {}).filter((stat) => stat.lastReviewedAt === date).length;
}

function getTodayWrongNoteCount(state, date = TODAY) {
  return Object.values(state.stats || {}).filter((stat) => stat.lastAttemptAt === date && String(stat.wrongNotes || '').trim()).length;
}

function getDailyChest(state, todayCompleted = false, date = TODAY) {
  const reviewCount = getTodayReviewQuestionCount(state, date);
  const flashcardCount = getTodayFlashcardReviewCount(state, date);
  const wrongNoteCount = getTodayWrongNoteCount(state, date);
  const rows = [
    {
      key: 'daily-practice',
      label: 'Daily Practice',
      target: '完成今日題組',
      value: todayCompleted ? 1 : 0,
      max: 1,
      points: todayCompleted ? 35 : 0,
      totalPoints: 35,
    },
    {
      key: 'review-queue',
      label: 'Review Queue',
      target: '8 題',
      value: Math.min(reviewCount, 8),
      max: 8,
      points: Math.round(Math.min(reviewCount / 8, 1) * 30),
      totalPoints: 30,
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
  return getQuestionPool(state).find((q) => q.id === id) || null;
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
    task: 'Targeted correction task',
    cardType: 'Exam Trap Card',
    action: '把錯因整理成一張可重測的補救卡。',
  };
}

function nextIntervalByRating(rating, stat) {
  const current = stat.intervalDays || 1;
  if (rating === 'Again') return 1;
  if (rating === 'Hard') return Math.max(2, Math.round(current * 1.2));
  if (rating === 'Good') return Math.max(4, Math.round(current * 2.2));
  if (rating === 'Easy') return Math.max(7, Math.round(current * 3.0));
  return 3;
}


function shuffleStable(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function getTaskSearchText(task) {
  if (!task) return '';
  return [
    task.cancer,
    task.module,
    task.topic,
    task.details,
    ...(task.goldenTrials || []),
    ...(task.focusTags || []),
  ].filter(Boolean).join(' ').toLowerCase();
}

function getTaskKeywords(task) {
  const text = getTaskSearchText(task);
  return [...new Set(text
    .split(/[^a-z0-9+/-]+/i)
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word.length >= 3 && !['and', 'the', 'with', 'for', 'from', 'what', 'each', 'this', 'that'].includes(word)))];
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

function questionMatchesHighYieldTopic(question, highYieldTopic) {
  if (!question || !highYieldTopic) return false;
  const questionText = getQuestionContentText(question);
  const aliases = highYieldTopic.aliases || [];
  const cancerMatch = question.cancer === highYieldTopic.cancer
    || (highYieldTopic.cancer === 'Supportive/Stats' && ['Supportive/Stats', 'Other'].includes(question.cancer));
  const aliasHit = aliases.some((alias) => questionText.includes(String(alias).toLowerCase()));
  return aliasHit || (cancerMatch && aliases.some((alias) => String(question.topic || '').toLowerCase().includes(String(alias).toLowerCase())));
}

function getQuestionHighYieldTopics(question) {
  return HIGH_YIELD_TOPICS.filter((topic) => questionMatchesHighYieldTopic(question, topic));
}

function getHighYieldTopicQuestionStats(state, highYieldTopic) {
  const rows = getQuestionPool(state)
    .map((q) => getQuestionWithOverride(q.id, state))
    .filter((q) => q && questionMatchesHighYieldTopic(q, highYieldTopic))
    .map((q) => ({ q, stat: getStat(state, q.id) }));
  const attempts = rows.reduce((sum, row) => sum + (row.stat.attempts || 0), 0);
  const wrong = rows.reduce((sum, row) => sum + (row.stat.wrong || 0), 0);
  const lastDates = rows
    .map((row) => row.stat.lastAttemptAt)
    .filter(Boolean)
    .sort();
  return {
    total: rows.length,
    attempts,
    wrongRateFactor: attempts ? Math.max(1, wrong / attempts) : 1,
    daysSinceReview: lastDates.length ? Math.max(1, daysBetween(lastDates[lastDates.length - 1], TODAY)) : 30,
  };
}

function scoreHighYieldTopic(state, highYieldTopic) {
  const stats = getHighYieldTopicQuestionStats(state, highYieldTopic);
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
  return HIGH_YIELD_TOPICS
    .map((topic) => {
      const mainlineBonus = task && (topic.cancer === task.cancer || getTaskSearchText(task).includes(topic.label.toLowerCase())) ? 1.25 : 1;
      const score = Math.round(scoreHighYieldTopic(state, topic) * mainlineBonus * 10) / 10;
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

function getBossWeaknessTier(question, task) {
  if (!question || !task) return 0;
  const questionText = getQuestionContentText(question);
  const taskTopicText = [
    task.topic,
    task.details,
    ...(task.goldenTrials || []),
  ].filter(Boolean).join(' ').toLowerCase();
  const topicWords = taskTopicText
    .split(/[^a-z0-9]+/i)
    .filter((word) => word.length >= 3 && !['and', 'the', 'with', 'for', 'from'].includes(word));
  const topicWordHits = topicWords.filter((word) => questionText.includes(word)).length;
  const trialHits = (task.goldenTrials || []).filter((trial) => questionText.includes(String(trial).toLowerCase())).length;
  const focusHits = (task.focusTags || []).filter((tag) => questionText.includes(String(tag).toLowerCase())).length;
  const topicHit = Boolean(
    question.topic
    && getTaskSearchText(task).includes(String(question.topic).toLowerCase())
  );

  if (trialHits > 0 || topicHit || topicWordHits >= 2) return 1;
  if (focusHits > 0) return 2;
  if (question.cancer === task.cancer) return 3;
  return 0;
}

function sortBossWeaknessRows(a, b) {
  return a.bossTier - b.bossTier
    || (b.stat.highConfidenceWrong || 0) - (a.stat.highConfidenceWrong || 0)
    || (b.stat.repeatedWrong || 0) - (a.stat.repeatedWrong || 0)
    || wrongRate(b.stat) - wrongRate(a.stat)
    || b.taskScore - a.taskScore;
}

function generateDailyQuestionIds(state, task = getTodayPlanTask(state), excludedIds = []) {
  const { preferredYears, preferredCancers } = state.settings;
  const modeConfig = getPracticeModeConfig(state.settings?.practiceMode);
  const excluded = new Set(excludedIds);
  const highYieldTopicIds = new Set(getRankedHighYieldTopics(state, task).slice(0, 5).map((topic) => topic.id));

  const pool = getQuestionPool(state)
    .map((q) => getQuestionWithOverride(q.id, state))
    .filter(Boolean)
    .filter((q) => !excluded.has(q.id))
    .filter((q) => {
      const yearOk = !preferredYears || preferredYears.length === 0 || preferredYears.includes(Number(q.year));
      const cancerOk = !preferredCancers || preferredCancers.length === 0 || preferredCancers.includes(q.cancer);
      return yearOk && cancerOk;
    });

  const withStats = pool.map((q) => ({ q, stat: getStat(state, q.id) }));
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
      const matchedTopics = getQuestionHighYieldTopics(item.q).filter((topic) => highYieldTopicIds.has(topic.id));
      const topicScore = matchedTopics.reduce((max, topic) => Math.max(max, scoreHighYieldTopic(state, topic)), 0);
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
    if (planProgress[task.id]) acc[task.module].completed += 1;
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
  return studyPlan100.find((task) => !state.planProgress?.[task.id]) || studyPlan100[studyPlan100.length - 1];
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
  return bucket.tasks?.[taskId] || {};
}

function writeDailyQuestTask(state, date, taskId, progress) {
  const bucket = getDailyQuestBucket(state, date);
  return {
    ...bucket,
    activeTaskId: taskId,
    tasks: {
      ...(bucket.tasks || {}),
      [taskId]: progress,
    },
  };
}

function getDailyQuestProgress(state, date = TODAY, task = getTodayPlanTask(state), practiceDone = false) {
  const planTaskId = task?.id || 1;
  const activeSaved = getSavedDailyQuestTask(state, date, planTaskId);
  const memoryDone = Boolean(activeSaved.memoryDone);
  const bossDone = Boolean(activeSaved.bossDone);
  const practiceStar = Boolean(activeSaved.practiceDone || practiceDone);
  const stars = [practiceStar, memoryDone, bossDone].filter(Boolean).length;
  return {
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

function getDailyWrongErrorTypeStatus(state, questionIds = [], date = TODAY) {
  const wrongRated = questionIds
    .map((id) => {
      const question = getQuestionWithOverride(id, state);
      const draft = state.sessions?.[date]?.practiceDrafts?.[id] || {};
      const selected = String(draft.selected || '').trim().toUpperCase();
      const correctAnswer = String(draft.correctAnswer || question?.answer || '').trim().toUpperCase();
      const isWrong = draft.rated && selected && correctAnswer && selected !== correctAnswer;
      return isWrong ? { id, errorType: draft.errorType || getStat(state, id).lastErrorType || '' } : null;
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

function updateDailyQuestMemoryProgress(state, date, task, practiceDone, cardId, rating) {
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

function getWeaknessQuestion(state, task) {
  const rows = getQuestionPool(state)
    .map((q) => ({ q: getQuestionWithOverride(q.id, state), stat: getStat(state, q.id) }))
    .filter(({ q }) => q)
    .map((row) => ({
      ...row,
      taskScore: scoreQuestionForTask(row.q, task),
      bossTier: getBossWeaknessTier(row.q, task),
    }))
    .filter(({ stat, bossTier }) => (
      bossTier > 0
    ) && ((stat.wrong || 0) > 0 || (stat.highConfidenceWrong || 0) > 0 || (stat.repeatedWrong || 0) > 0))
    .sort(sortBossWeaknessRows);

  if (rows[0]) return rows[0].q;

  return getQuestionPool(state)
    .map((q) => getQuestionWithOverride(q.id, state))
    .filter(Boolean)
    .map((q) => ({
      q,
      stat: getStat(state, q.id),
      taskScore: scoreQuestionForTask(q, task),
      bossTier: getBossWeaknessTier(q, task),
    }))
    .filter(({ bossTier }) => bossTier > 0)
    .sort(sortBossWeaknessRows)[0]?.q || null;
}

function buildBossChallenges(task, state) {
  const firstTrial = task?.goldenTrials?.[0] || 'today golden trial';
  const weakness = getWeaknessQuestion(state, task);
  const topicLabel = `${task?.day || 'Today'}｜${task?.topic || 'today topic'}`;
  return [
    {
      id: 'trial',
      title: 'Boss 1｜Trial Recall',
      prompt: `${topicLabel}\n${firstTrial}: population / endpoint / implication`,
      answerHint: '說出 P/I/C/O、primary endpoint，以及正式考最可能改寫的陷阱。',
    },
    {
      id: 'algorithm',
      title: 'Boss 2｜Algorithm Recall',
      prompt: `${topicLabel} treatment sequencing / decision algorithm`,
      answerHint: task?.details || '從 first-line 到 relapse/salvage 用空白回想講一次。',
    },
    {
      id: 'weakness',
      title: 'Boss 3｜Weakness Retry',
      prompt: weakness ? `${weakness.id}｜${weakness.cancer}｜${weakness.topic}\n${weakness.stem}` : `${task?.topic || 'today topic'} weakness retry`,
      answerHint: weakness ? `正解：${weakness.answer || '尚未輸入'}。先講出為什麼其他選項不對。` : '沒有舊錯題時，改用今日主題做 60 秒 oral recall。',
      questionId: weakness?.id || null,
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
      if (!event?.date) return;
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
    if (stat.lastAttemptAt !== date) return acc;
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
  const todayRatedCount = Object.values(todaySession.practiceDrafts || {}).filter((draft) => draft?.rated).length;
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
  const weakCancerRows = cancerSummary
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

function buildAiPrompt(state) {
  const weak = getQuestionPool(state)
    .map((q) => ({ q: getQuestionWithOverride(q.id, state), stat: getStat(state, q.id) }))
    .filter(({ q, stat }) => q && (stat.wrong > 0 || stat.bookmarked))
    .sort((a, b) => wrongRate(b.stat) - wrongRate(a.stat) || b.stat.wrong - a.stat.wrong)
    .slice(0, 15);

  return `你是一位 hematology-oncology board exam coach。請根據以下腫瘤內科專科醫師考題練習紀錄，幫我做 AI review。\n\n要求輸出：\n1. 弱點總結\n2. 高錯誤率癌別與 trial\n3. 每個弱點的補救讀書任務，需依 error type 指派 Trial Card / Cloze Card / Algorithm Card / Toxicity comparison / guideline update 等\n4. 10 題 fellow-level MCQ 題目\n5. 3 題 oral board style question\n6. 明天應該優先複習的題目與主題\n\n我的錯題/標記題：\n${weak.map(({ q, stat }) => {
    const errorType = stat.lastErrorType || stat.errorTypes?.[stat.errorTypes.length - 1] || 'none';
    const remediation = stat.lastRemediationTask?.task || (errorType !== 'none' ? getRemediationForErrorType(errorType).task : 'none');
    const taxonomy = [
      q.tags?.cancerType,
      q.tags?.stage,
      q.tags?.clinicalSetting,
      q.tags?.treatmentModality,
      q.tags?.evidenceType,
      q.tags?.questionType,
      ...(q.tags?.biomarker || []),
    ].filter(Boolean).join(' / ') || 'uncategorized';
    return `- ${q.id} | ${q.cancer} | ${q.topic} | taxonomy: ${taxonomy} | wrong rate ${wrongRate(stat)}% | attempts ${stat.attempts} | error type: ${errorType} | repair: ${remediation} | trials: ${(q.trials || []).join(', ') || 'none'} | note: ${stat.wrongNotes || 'none'} | stem: ${q.stem}`;
  }).join('\n')}`;
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

function RewardDashboard({ state, dailyChest, bossRows, onClaimDailyChest }) {
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


function QuestionCard({ question, stat, onUpdateStat, compact = false, hideAnswerUntilSubmit = false, practiceMode = false, practiceDraft = null, onPracticeChange = null, onEdit }) {
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

  useEffect(() => {
    const nextAnswer = stat.correctAnswer || question.answer || '';

    if (practiceMode && practiceDraft) {
      setSelected(practiceDraft.selected ?? '');
      setCorrectAnswer(practiceDraft.correctAnswer ?? nextAnswer);
      setExplanation(practiceDraft.explanation ?? (stat.explanation || question.explanation || ''));
      setWrongNotes(practiceDraft.wrongNotes ?? (stat.wrongNotes || ''));
      setConfidence(practiceDraft.confidence ?? stat.lastConfidence ?? 3);
      setErrorType(practiceDraft.errorType ?? stat.lastErrorType ?? '');
      setRevealed(practiceDraft.revealed ?? false);
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
    // Local answer state should reset only when the rendered question changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

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
      onPracticeChangeRef.current(patch);
    }
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

  const recordRating = (rating) => {
    if (practiceMode && practiceDraft?.rated) {
      setFeedback('此題已評分，跳過重複紀錄。');
      return;
    }

    const previous = stat;
    const newAttempts = (previous.attempts || 0) + 1;
    // Determine correctness by comparing selected option to correctAnswer
    const isCorrect = answerIsSingleChoice && selected === String(correctAnswer).trim().toUpperCase();
    const newCorrect = previous.correct + (isCorrect ? 1 : 0);
    const newWrong = previous.wrong + (isCorrect ? 0 : 1);

    if (!isCorrect && !errorType) {
      setFeedback('答錯題必須先選擇 Error type，才能送出評分並排入補救任務。');
      return;
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
    const remediation = isCorrect ? null : getRemediationForErrorType(errorType);
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
      selected: selected || null,
      correctAnswer: correctAnswer || previous.correctAnswer || question.answer || null,
      isCorrect,
      confidence: normalizedConfidence,
      rating,
      errorType: isCorrect ? '' : errorType,
      remediationTask: remediation?.task || '',
      remediationCardType: remediation?.cardType || '',
    };

    onUpdateStat(question.id, {
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
      confidenceHistory: [...(previous.confidenceHistory || []), normalizedConfidence].slice(-50),
      answerHistory: [...(previous.answerHistory || []), answerEvent].slice(-50),
      highConfidenceWrong: (previous.highConfidenceWrong || 0) + (!isCorrect && normalizedConfidence >= 4 ? 1 : 0),
      repeatedWrong: isCorrect ? 0 : (previous.repeatedWrong || 0) + 1,
      wrongRetestAttempts: (previous.wrongRetestAttempts || 0) + (wasPreviouslyWrong ? 1 : 0),
      wrongRetestCorrect: (previous.wrongRetestCorrect || 0) + (wasPreviouslyWrong && isCorrect ? 1 : 0),
      errorTypes: isCorrect || !errorType ? (previous.errorTypes || []) : [...(previous.errorTypes || []), errorType].slice(-20),
      lastRemediationTask: remediationEvent || previous.lastRemediationTask || null,
      remediationTasks: remediationEvent ? [remediationEvent, ...(previous.remediationTasks || [])].slice(0, 20) : (previous.remediationTasks || []),
    });

    setFeedback(`紀錄：${rating}，下次複習 ${interval} 天後${remediation ? `。補救任務：${remediation.task}` : ''}`);

    // Mark practiceDraft as rated so UI/logic won't double-record
    if (practiceMode && onPracticeChange) {
      onPracticeChange({ rated: true, rating });
    }
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
    // In practiceMode we reveal and wait for user rating (Again/Hard/Good/Easy)
    setFeedback(answerIsSingleChoice ? (isCorrectSelection ? '答對，請選擇評分 (Again/Hard/Good/Easy)。' : '答錯，請選擇評分 (Again/Hard/Good/Easy)。') : '請選擇評分 (Again/Hard/Good/Easy)。');
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

  return (
    <article className="question-card">
      <div className="question-top">
        <div>
          <button className="link-button" onClick={() => setOpen(!open)}>{open ? '收合' : '展開'}</button>
          <span className="qid">{question.id}</span>
          {question.notionUrl && (
            <a className="notion-link" href={question.notionUrl} target="_blank" rel="noreferrer" title="Open Notion explanation">🔗</a>
          )}
          <span className="pill">{question.cancer}</span>
          <span className="pill soft">{question.topic}</span>
          {question.trials?.map((trial) => <span key={trial} className="pill trial">{trial}</span>)}
          {taxonomyChips.slice(0, compact ? 3 : 7).map((tag) => <span key={tag} className="pill tag">{tag}</span>)}
        </div>
        <div className="question-actions">
            {onEdit && <button className="secondary" onClick={() => onEdit(question.id)}>編輯題目</button>}
            {question.notionUrl && (
              <button className="secondary" onClick={() => window.open(question.notionUrl, '_blank')}>Notion 詳解</button>
            )}
            <button className={stat.bookmarked ? 'bookmark active' : 'bookmark'} onClick={toggleBookmark}>
              {stat.bookmarked ? '★ 已標記' : '☆ 標記'}
            </button>
        </div>
      </div>

      <p className="stem">{question.stem}</p>
      {!compact && question.tags?.hashTags?.length > 0 && (
        <div className="taxonomy-tags" aria-label="Question taxonomy tags">
          {question.tags.hashTags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      )}

      {open && (
        <>
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

          {hideAnswerUntilSubmit && !revealed && (
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
                <label>
                  正解
                  <select value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)}>
                    <option value="">尚未輸入</option>
                    {['A', 'B', 'C', 'D', 'E'].map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
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
                {!isCorrectSelection && (
                  <label>
                    Error type
                    <select value={errorType} onChange={(e) => setErrorType(e.target.value)}>
                      <option value="">選擇錯因</option>
                      {ERROR_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </label>
                )}
                {!isCorrectSelection && selectedErrorRemediation && (
                  <div className="remediation-preview">
                    <strong>{selectedErrorRemediation.task}</strong>
                    <span>{selectedErrorRemediation.action}</span>
                  </div>
                )}
                <label>
                  Mastery
                  <select value={stat.mastery || 0} onChange={(e) => onUpdateStat(question.id, { ...stat, mastery: Number(e.target.value) })}>
                    {[0, 1, 2, 3, 4, 5].map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
                <div className="rating-buttons">
                  <button
                    className="rating-button again"
                    title="Again（重複）：重新學習，建議 1 天後複習"
                    onClick={() => recordRating('Again')}
                  >
                    🔁 Again
                    <div className="rating-sub">重複 · 1 天</div>
                  </button>
                  <button
                    className="rating-button hard"
                    title="Hard（難）：答對但不穩，建議 3 天後複習"
                    onClick={() => recordRating('Hard')}
                  >
                    🟠 Hard
                    <div className="rating-sub">困難 · 約 3 天</div>
                  </button>
                  <button
                    className="rating-button good"
                    title="Good（好）：正常答對，建議 7–14 天後複習"
                    onClick={() => recordRating('Good')}
                  >
                    ✅ Good
                    <div className="rating-sub">良好 · 7–14 天</div>
                  </button>
                  <button
                    className="rating-button easy"
                    title="Easy（非常熟）：秒答且熟悉，建議 21–30 天後複習"
                    onClick={() => recordRating('Easy')}
                  >
                    ✨ Easy
                    <div className="rating-sub">非常熟 · 21–30 天</div>
                  </button>
                </div>
                <button className="secondary" onClick={saveNote}>儲存詳解/筆記</button>
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
        attempts {stat.attempts} · correct {stat.correct} · wrong {stat.wrong} · wrong rate {wrongRate(stat)}% · high-confidence wrong {stat.highConfidenceWrong || 0} · next review {stat.nextReviewDate || 'not scheduled'}
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
          <p className="muted">登入同一組帳號後，MacBook、iPhone、iPad 會讀取同一份作答紀錄、錯題率、詳解與 100-Day Plan checklist。</p>
        </div>
        <span className={user ? 'cloud-badge online' : 'cloud-badge offline'}>
          {user ? 'Cloud sync on' : 'Local only'}
        </span>
      </div>

      <div className="sync-status-card">
        <strong>同步狀態</strong>
        <p>{syncStatus}</p>
        {syncError && <p className="error-text">{syncError}</p>}
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
          <li>Daily Practice、Review Queue、100-Day Plan 會自動同步。</li>
        </ol>
      </div>
    </main>
  );
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
  const selectedQuestion = editingQuestionId ? getQuestionWithOverride(editingQuestionId, state) : null;

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
            <span className="muted">符合條件，顯示前 80 題</span>
          </div>
          {questions.slice(0, 80).map((q) => (
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
  bossChallenges,
  highYieldTopics,
  completionStatus,
  onCreatePractice,
  practiceMode,
  onPracticeModeChange,
  onMarkRecall,
  onSetBossResult,
  onClaimStageClear,
  onOpenPractice,
}) {
  const [openRecallId, setOpenRecallId] = useState(recallCards[0]?.id || '');
  const [openBossId, setOpenBossId] = useState(bossChallenges[0]?.id || '');
  const bossPassed = Object.values(progress.bossResults || {}).filter(Boolean).length;
  const bossAnswered = Object.keys(progress.bossResults || {}).length;
  const allStars = progress.stars >= 3;

  const starRows = [
    {
      key: 'practice',
      title: 'Practice Star',
      done: progress.practiceDone,
      text: '完成今日 Daily Practice 題目並評分。',
      action: progress.practiceDone ? onOpenPractice : onCreatePractice,
      actionText: progress.practiceDone ? '查看今日練習' : '產生今日練習',
    },
    {
      key: 'memory',
      title: 'Memory Star',
      done: progress.memoryDone,
      text: '完成今日 5 張 topic / due flashcards。',
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
      <div className="quest-hero">
        <div>
          <div className="eyebrow">Today Quest</div>
          <h2>{task.day} {task.cancer} Dungeon</h2>
          <p className="quest-topic">{task.topic}</p>
          <p className="muted">{task.details}</p>
          <div className="trial-tags">
            {(task.goldenTrials || []).map((trial) => <span key={trial}>{trial}</span>)}
            {(task.focusTags || []).map((tag) => <span key={tag}>{tag}</span>)}
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
            {star.action && <button className="secondary" onClick={star.action}>{star.actionText}</button>}
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

      <section className="subsection">
        <h3>Memory Star｜Topic Recall / Flashcard Review</h3>
        <div className="recall-grid">
          {recallCards.map((card) => {
            const rating = progress.recallRatings?.[card.id];
            const open = openRecallId === card.id;
            return (
              <article className={rating ? 'recall-card done' : 'recall-card'} key={card.id}>
                <div className="question-top">
                  <span className="pill">{card.type}</span>
                  {rating && <span className="priority high">{rating}</span>}
                </div>
                <strong>{card.front}</strong>
                {open && <p className="recall-back">{card.back}</p>}
                <div className="inline-actions">
                  <button className="secondary" onClick={() => setOpenRecallId(open ? '' : card.id)}>{open ? '收合' : '翻卡'}</button>
                  {Object.keys(FLASHCARD_RATINGS).map((ratingOption) => (
                    <button className="tiny" key={ratingOption} onClick={() => onMarkRecall(card, ratingOption)}>{ratingOption}</button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
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
                  <button className="good" onClick={() => onSetBossResult(boss.id, true)}>Pass</button>
                  <button className="bad" onClick={() => onSetBossResult(boss.id, false)}>Fail</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function FlashcardsPanel({
  state,
  dueFlashcards,
  weakQuestions,
  onReviewCard,
  onCreateTrialCard,
  onImportFlashcards,
  onUpdateFlashcard,
  onDeleteFlashcard,
}) {
  const [trialName, setTrialName] = useState('');
  const [importJson, setImportJson] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [cardPrompt, setCardPrompt] = useState('');
  const [cardPromptMessage, setCardPromptMessage] = useState('');
  const [editingCardId, setEditingCardId] = useState(null);
  const allFlashcards = getFlashcardList(state);
  const trialCards = allFlashcards.filter((card) => card.sourceType === 'trial' || card.type === 'Trial Card');
  const weakCards = allFlashcards.filter((card) => (card.mastery || 0) <= 2);

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
Last error type: ${stat.lastErrorType || stat.errorTypes?.[stat.errorTypes.length - 1] || 'none'}
Recommended remediation: ${stat.lastRemediationTask?.task || (stat.lastErrorType ? getRemediationForErrorType(stat.lastErrorType).task : 'none')}

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

請優先抽出可轉移的 decision rule，不要把「題目放正面、選項放背面」。每題產生 2–4 張卡，優先涵蓋 pivotal trial、treatment sequencing、cutoff/duration/endpoint、常見錯選項。

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
          <h2>Flashcards</h2>
          <p className="muted">錯題只整理來源素材；先產生 ChatGPT prompt，再匯入 AI 產出的 JSON cards。</p>
        </div>
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

      <div className="subsection">
        <h3>Due Cards</h3>
        {!dueFlashcards.length ? <p className="muted">今天沒有到期卡片。</p> : (
          <div className="flashcard-grid">
            {dueFlashcards.slice(0, 40).map((card) => (
              <FlashcardCard
                key={card.id}
                card={card}
                onReviewCard={onReviewCard}
                onUpdateCard={onUpdateFlashcard}
                onDeleteCard={onDeleteFlashcard}
                editing={editingCardId === card.id}
                onStartEdit={() => setEditingCardId(card.id)}
                onCancelEdit={() => setEditingCardId(null)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="subsection">
        <h3>Trial Cards</h3>
        {!trialCards.length ? <p className="muted">尚未建立 Trial Card。</p> : (
          <div className="flashcard-grid">
            {trialCards.slice(0, 20).map((card) => (
              <FlashcardCard
                key={card.id}
                card={card}
                onReviewCard={onReviewCard}
                onUpdateCard={onUpdateFlashcard}
                onDeleteCard={onDeleteFlashcard}
                compact
                editing={editingCardId === card.id}
                onStartEdit={() => setEditingCardId(card.id)}
                onCancelEdit={() => setEditingCardId(null)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function FlashcardCard({
  card,
  onReviewCard,
  onUpdateCard,
  onDeleteCard,
  compact = false,
  editing = false,
  onStartEdit,
  onCancelEdit,
}) {
  const [showBack, setShowBack] = useState(false);
  const [draft, setDraft] = useState(() => makeFlashcardEditDraft(card));

  useEffect(() => {
    if (editing) setDraft(makeFlashcardEditDraft(card));
  }, [card, editing]);

  const saveEdit = () => {
    onUpdateCard(card.id, {
      front: draft.front,
      back: draft.back,
      type: draft.type,
      cancer: draft.cancer,
      topic: draft.topic,
      trial: splitEditableList(draft.trial),
      tags: splitEditableList(draft.tags),
      examValue: normalizeExamValue(draft.examValue),
      errorType: normalizeFlashcardErrorType(draft.errorType),
    });
    onCancelEdit();
  };

  const deleteCard = () => {
    if (!window.confirm('確定要刪除這張 card？刪除後也會移除它的複習紀錄。')) return;
    onDeleteCard(card.id);
    onCancelEdit();
  };

  return (
    <article className="flashcard-card">
      <div className="question-top">
        <div>
          <span className="pill">{card.type || 'Flashcard'}</span>
          <span className="pill">{card.cancer}</span>
          <span className="pill soft">{card.topic}</span>
          {card.trial?.map((trial) => <span className="pill trial" key={trial}>{trial}</span>)}
          {card.tags?.map((tag) => <span className="pill tag" key={tag}>{tag}</span>)}
          {card.examValue >= 4 && <span className="priority high">EV{card.examValue}</span>}
        </div>
        <span className="priority">M{card.mastery || 0}</span>
      </div>
      {editing ? (
        <div className="flashcard-editor">
          <label>Front<textarea value={draft.front} onChange={(e) => setDraft((prev) => ({ ...prev, front: e.target.value }))} /></label>
          <label>Back<textarea value={draft.back} onChange={(e) => setDraft((prev) => ({ ...prev, back: e.target.value }))} /></label>
          <div className="flashcard-editor-grid">
            <label>Type<select value={draft.type} onChange={(e) => setDraft((prev) => ({ ...prev, type: e.target.value }))}>{FLASHCARD_TYPE_OPTIONS.map((type) => <option value={type} key={type}>{type}</option>)}</select></label>
            <label>Cancer<input value={draft.cancer} onChange={(e) => setDraft((prev) => ({ ...prev, cancer: e.target.value }))} /></label>
            <label>Topic<input value={draft.topic} onChange={(e) => setDraft((prev) => ({ ...prev, topic: e.target.value }))} /></label>
            <label>Trial names<input value={draft.trial} onChange={(e) => setDraft((prev) => ({ ...prev, trial: e.target.value }))} placeholder="PACIFIC, KEYNOTE-671" /></label>
            <label>Exam value<input type="number" min="1" max="5" value={draft.examValue} onChange={(e) => setDraft((prev) => ({ ...prev, examValue: e.target.value }))} /></label>
            <label>Error type<select value={draft.errorType} onChange={(e) => setDraft((prev) => ({ ...prev, errorType: e.target.value }))}>{ERROR_TYPE_OPTIONS.map((errorType) => <option value={errorType} key={errorType}>{errorType}</option>)}</select></label>
          </div>
          <label>Tags<input value={draft.tags} onChange={(e) => setDraft((prev) => ({ ...prev, tags: e.target.value }))} placeholder="trial, endpoint, NSCLC" /></label>
          <div className="inline-actions">
            <button className="primary" onClick={saveEdit}>儲存修改</button>
            <button className="secondary" onClick={onCancelEdit}>取消</button>
            <button className="danger" onClick={deleteCard}>刪除 Card</button>
          </div>
        </div>
      ) : (
        <>
          <pre className="flashcard-front">{card.front}</pre>
          {!compact && card.cloze && <p className="muted">{card.cloze}</p>}
          {showBack && <pre className="flashcard-back">{card.back || '尚未填寫背面。'}</pre>}
          <div className="inline-actions">
            <button className="secondary" onClick={() => setShowBack(!showBack)}>{showBack ? '收合答案' : '顯示答案'}</button>
            <button className="secondary" onClick={onStartEdit}>修改</button>
            <button className="danger" onClick={deleteCard}>刪除</button>
            {Object.keys(FLASHCARD_RATINGS).map((rating) => (
              <button key={rating} className={`tiny ${rating.toLowerCase()}`} onClick={() => onReviewCard(card.id, rating)}>{rating}</button>
            ))}
          </div>
          <div className="stats-line">next review {card.nextReviewDate || 'today'} · interval {card.intervalDays || 1} days</div>
        </>
      )}
    </article>
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


function FlashcardReviewPanel({ dueFlashcards, allFlashcards, onReviewCard, onUpdateCard, onDeleteCard, onOpenImport }) {
  const [queueMode, setQueueMode] = useState('due');
  const [activeIndex, setActiveIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => makeFlashcardEditDraft({}));
  const queue = queueMode === 'all' ? allFlashcards : dueFlashcards;
  const card = queue[activeIndex] || null;

  useEffect(() => {
    setEditing(false);
    setDraft(makeFlashcardEditDraft(card || {}));
  }, [card]);

  const rateCard = (rating) => {
    if (!card) return;
    onReviewCard(card.id, rating);
    setShowBack(false);
    setActiveIndex((index) => Math.min(index + 1, Math.max(0, queue.length - 1)));
  };

  const saveEdit = () => {
    if (!card) return;
    onUpdateCard(card.id, {
      front: draft.front,
      back: draft.back,
      type: draft.type,
      cancer: draft.cancer,
      topic: draft.topic,
      trial: splitEditableList(draft.trial),
      tags: splitEditableList(draft.tags),
      examValue: normalizeExamValue(draft.examValue),
      errorType: normalizeFlashcardErrorType(draft.errorType),
    });
    setEditing(false);
  };

  const deleteCard = () => {
    if (!card || !window.confirm('確定要刪除這張 card？刪除後也會移除它的複習紀錄。')) return;
    onDeleteCard(card.id);
    setShowBack(false);
    setEditing(false);
    setActiveIndex((index) => Math.min(index, Math.max(0, queue.length - 2)));
  };

  return (
    <main className="panel flashcard-review-panel">
      <div className="section-head">
        <div>
          <h2>Flashcard Review</h2>
          <p className="muted">最小可行版：Front → Show Answer → Again / Hard / Good / Easy。這個 review queue 會餵給 Memory Star。</p>
        </div>
        <div className="inline-actions">
          <button className={queueMode === 'due' ? 'primary' : 'secondary'} onClick={() => { setQueueMode('due'); setActiveIndex(0); setShowBack(false); }}>Due Cards</button>
          <button className={queueMode === 'all' ? 'primary' : 'secondary'} onClick={() => { setQueueMode('all'); setActiveIndex(0); setShowBack(false); }}>All Cards</button>
          <button className="secondary" onClick={onOpenImport}>Import</button>
        </div>
      </div>

      {!card ? (
        <section className="empty-state">
          <h3>沒有可複習的卡片</h3>
          <p className="muted">先到 Flashcards → 產生 AI Card Prompt，貼到 ChatGPT 後再 Import JSON cards。</p>
          <button className="primary" onClick={onOpenImport}>去匯入卡片</button>
        </section>
      ) : (
        <section className="single-review-card">
          <div className="question-top">
            <div>
              <span className="pill">{card.type || card.sourceType || 'Flashcard'}</span>
              <span className="pill soft">{card.cancer}</span>
              <span className="pill soft">{card.topic}</span>
              {card.trial?.map((trial) => <span className="pill trial" key={trial}>{trial}</span>)}
              {card.tags?.map((tag) => <span className="pill tag" key={tag}>{tag}</span>)}
              {card.examValue >= 4 && <span className="priority high">EV{card.examValue}</span>}
            </div>
            <span className="priority">{activeIndex + 1}/{queue.length} · M{card.mastery || 0}</span>
          </div>
          {editing ? (
            <div className="flashcard-editor">
              <label>Front<textarea value={draft.front} onChange={(e) => setDraft((prev) => ({ ...prev, front: e.target.value }))} /></label>
              <label>Back<textarea value={draft.back} onChange={(e) => setDraft((prev) => ({ ...prev, back: e.target.value }))} /></label>
              <div className="flashcard-editor-grid">
                <label>Type<select value={draft.type} onChange={(e) => setDraft((prev) => ({ ...prev, type: e.target.value }))}>{FLASHCARD_TYPE_OPTIONS.map((type) => <option value={type} key={type}>{type}</option>)}</select></label>
                <label>Cancer<input value={draft.cancer} onChange={(e) => setDraft((prev) => ({ ...prev, cancer: e.target.value }))} /></label>
                <label>Topic<input value={draft.topic} onChange={(e) => setDraft((prev) => ({ ...prev, topic: e.target.value }))} /></label>
                <label>Trial names<input value={draft.trial} onChange={(e) => setDraft((prev) => ({ ...prev, trial: e.target.value }))} placeholder="PACIFIC, KEYNOTE-671" /></label>
                <label>Exam value<input type="number" min="1" max="5" value={draft.examValue} onChange={(e) => setDraft((prev) => ({ ...prev, examValue: e.target.value }))} /></label>
                <label>Error type<select value={draft.errorType} onChange={(e) => setDraft((prev) => ({ ...prev, errorType: e.target.value }))}>{ERROR_TYPE_OPTIONS.map((errorType) => <option value={errorType} key={errorType}>{errorType}</option>)}</select></label>
              </div>
              <label>Tags<input value={draft.tags} onChange={(e) => setDraft((prev) => ({ ...prev, tags: e.target.value }))} placeholder="trial, endpoint, NSCLC" /></label>
              <div className="inline-actions review-actions">
                <button className="primary" onClick={saveEdit}>儲存修改</button>
                <button className="secondary" onClick={() => setEditing(false)}>取消</button>
                <button className="danger" onClick={deleteCard}>刪除 Card</button>
              </div>
            </div>
          ) : (
            <>
              <pre className="flashcard-front large">{card.front}</pre>
              {showBack && <pre className="flashcard-back large">{card.back}</pre>}
              <div className="inline-actions review-actions">
                <button className="secondary" onClick={() => setShowBack(!showBack)}>{showBack ? 'Hide Answer' : 'Show Answer'}</button>
                <button className="secondary" onClick={() => { setDraft(makeFlashcardEditDraft(card)); setEditing(true); }}>修改</button>
                <button className="danger" onClick={deleteCard}>刪除</button>
                {Object.keys(FLASHCARD_RATINGS).map((rating) => (
                  <button key={rating} className={`tiny ${rating.toLowerCase()}`} disabled={!showBack} onClick={() => rateCard(rating)}>{rating}</button>
                ))}
              </div>
              <div className="stats-line">next review {card.nextReviewDate || 'today'} · attempts {card.attempts || 0} · correct {card.correct || 0} / wrong {card.wrong || 0}</div>
            </>
          )}
        </section>
      )}
    </main>
  );
}

function MockExamPanel({ state, onFinishMock }) {
  const [questionCount, setQuestionCount] = useState(80);
  const [timerMinutes, setTimerMinutes] = useState(120);
  const [examMode, setExamMode] = useState('diagnostic-mock-0');
  const [examYear, setExamYear] = useState('All');
  const [exam, setExam] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  const startMock = () => {
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
    setExam({ id: `mock-${Date.now()}`, questions: selected, mode: examMode, year: examYear === 'All' ? null : Number(examYear) });
    setStartedAt(Date.now());
    setAnswers({});
    setShowResults(false);
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
    const elapsedSec = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
    const results = exam.questions.map((q) => {
      const draft = answers[q.id] || {};
      const correctAnswer = String(q.answer || '').trim().toUpperCase();
      const selected = String(draft.selected || '').trim().toUpperCase();
      const isCorrect = Boolean(selected && correctAnswer && selected === correctAnswer);
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
    const correct = results.filter((row) => row.isCorrect).length;
    const score = results.length ? Math.round((correct / results.length) * 100) : 0;
    const cancerLoss = results.filter((row) => !row.isCorrect).reduce((acc, row) => {
      const key = `${row.cancer} · ${row.topic || 'General'}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const topScoreLoss = Object.entries(cancerLoss).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, count]) => ({ label, count }));
    const highConfidenceWrong = results.filter((row) => !row.isCorrect && row.confidence >= 4).length;
    const slowCorrect = results.filter((row) => row.isCorrect && row.timeSpentSec > 90).length;
    const fastWrong = results.filter((row) => !row.isCorrect && row.timeSpentSec < 30).length;
    const completedExam = {
      id: exam.id,
      mode: exam.mode || examMode,
      year: exam.year || null,
      questionCount: results.length,
      timerMinutes: Number(timerMinutes),
      elapsedSec,
      score,
      correct,
      highConfidenceWrong,
      slowCorrect,
      fastWrong,
      topScoreLoss,
      results,
      startedAt: new Date(startedAt || Date.now()).toISOString(),
      completedAt: new Date().toISOString(),
    };
    playResultFeedback(score >= 60 ? 'correct' : 'wrong');
    onFinishMock(completedExam);
    setExam({ ...exam, completedExam });
    setShowResults(true);
  };

  const completed = exam?.completedExam;

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
        <section className="readiness-hero">
          <MetricCard label="Score" value={`${completed.score}%`} sub={`${completed.correct}/${completed.questionCount} correct`} />
          <MetricCard label="Predicted range" value={`${Math.max(0, completed.score - 5)}–${Math.min(100, completed.score + 5)}%`} sub="mock sampling band" />
          <MetricCard label="High-confidence wrong" value={completed.highConfidenceWrong} sub="confidence 4–5 but wrong" />
          <MetricCard label="Fast wrong / Slow correct" value={`${completed.fastWrong}/${completed.slowCorrect}`} sub="speed diagnostics" />
          <div className="subsection full-span">
            <h3>Top score loss</h3>
            {completed.topScoreLoss.length ? completed.topScoreLoss.map((item) => <div className="weak-row" key={item.label}>{item.label} · lost {item.count}</div>) : <p className="muted">沒有錯題。</p>}
          </div>
        </section>
      )}

      {exam && !showResults && (
        <>
          <div className="mock-toolbar">
            <strong>{exam.questions.length} questions</strong>
            <span className="muted">已作答 {Object.values(answers).filter((a) => a.selected).length}/{exam.questions.length}</span>
            <button className="good" onClick={finishMock}>Finish exam and score</button>
          </div>
          <div className="question-list">
            {exam.questions.map((q, index) => {
              const draft = answers[q.id] || { confidence: 3, selected: '' };
              return (
                <article className="question-card" key={q.id}>
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
  const [tab, setTab] = useState('quest');
  const [search, setSearch] = useState('');
  const [bankCancer, setBankCancer] = useState('All');
  const [bankYear, setBankYear] = useState('All');
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState('尚未登入，資料目前只存在這台裝置。');
  const [syncError, setSyncError] = useState('');
  const [isApplyingCloudState, setIsApplyingCloudState] = useState(false);
  const [practicePage, setPracticePage] = useState(0);
  const [focusStartedAt, setFocusStartedAt] = useState(null);
  const [focusTick, setFocusTick] = useState(() => Date.now());
  const [leaderboardStartedAt, setLeaderboardStartedAt] = useState(() => Date.now());

  useEffect(() => {
    saveState(state);
  }, [state]);

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
      unlockFeedbackAudio();
      triggerHapticFeedback('tap');
    };

    document.addEventListener('pointerdown', handlePointerDown, { passive: true });
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setFocusTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setLeaderboardStartedAt(Date.now());
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setSyncError('');

      if (!firebaseUser) {
        setSyncStatus('尚未登入，資料目前只存在這台裝置。');
        return;
      }

      setSyncStatus('已登入，正在讀取雲端資料...');
      try {
        const ref = getCloudDocRef(firebaseUser.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const merged = mergeCloudState(loadState(), snap.data());
          setIsApplyingCloudState(true);
          setState(merged);
          saveState(merged);
          setTimeout(() => setIsApplyingCloudState(false), 500);
          setSyncStatus('已從雲端載入資料，之後會即時同步。');
        } else {
          await setDoc(ref, makeCloudPayload(loadState()), { merge: true });
          setSyncStatus('已建立雲端資料，之後會即時同步。');
        }
      } catch (error) {
        setSyncError(error.message);
        setSyncStatus('雲端讀取失敗，暫時使用本機資料。');
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    const ref = getCloudDocRef(user.uid);
    const unsubscribeSnapshot = onSnapshot(ref, (snapshot) => {
      if (!snapshot.exists()) return;
      if (isApplyingCloudState) return;

      const cloudState = snapshot.data();
      const localState = loadState();
      const cloudUpdatedAt = cloudState?.cloudMeta?.updatedAt;
      const localUpdatedAt = localState?.cloudMeta?.updatedAt;

      if (cloudUpdatedAt && cloudUpdatedAt !== localUpdatedAt) {
        const merged = mergeCloudState(localState, cloudState);
        setIsApplyingCloudState(true);
        setState(merged);
        saveState(merged);
        setTimeout(() => setIsApplyingCloudState(false), 500);
        setSyncStatus('已接收其他裝置的更新。');
      }
    }, (error) => {
      setSyncError(error.message);
      setSyncStatus('即時同步監聽失敗。');
    });

    return () => unsubscribeSnapshot();
  }, [user, isApplyingCloudState]);

  useEffect(() => {
    if (!user || isApplyingCloudState) return;

    const timeout = setTimeout(async () => {
      try {
        const nextState = {
          ...state,
          cloudMeta: {
            ...(state.cloudMeta || {}),
            updatedAt: new Date().toISOString(),
            device: navigator.userAgent,
          },
        };
        saveState(nextState);
        await setDoc(getCloudDocRef(user.uid), makeCloudPayload(nextState), { merge: true });
        setSyncStatus(`已同步到雲端：${new Date().toLocaleString()}`);
      } catch (error) {
        setSyncError(error.message);
        setSyncStatus('同步到雲端失敗，資料仍已保存在本機。');
      }
    }, 900);

    return () => clearTimeout(timeout);
  }, [state, user, isApplyingCloudState]);

  const updateState = (updater) => setState((prev) => normalizeState(typeof updater === 'function' ? updater(prev) : updater));

  const startFocusSession = () => {
    setFocusStartedAt(new Date().toISOString());
    setFocusTick(Date.now());
  };

  const finishFocusSession = () => {
    if (!focusStartedAt) return;
    const endedAt = new Date().toISOString();
    const durationSeconds = Math.max(1, Math.round((new Date(endedAt).getTime() - new Date(focusStartedAt).getTime()) / 1000));
    const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));
    updateState((prev) => ({
      ...prev,
      focusSessions: [
        {
          id: `focus-${Date.now()}`,
          date: TODAY,
          startedAt: focusStartedAt,
          endedAt,
          durationSeconds,
          durationMinutes,
          planTaskId: questTask?.id || null,
          planTopic: questTask?.topic || '',
        },
        ...(prev.focusSessions || []),
      ],
    }));
    setFocusStartedAt(null);
  };

  const cancelFocusSession = () => {
    setFocusStartedAt(null);
  };

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
    });
  };

  const createTrialCard = (trialName, sourceQuestion = null) => {
    if (!trialName.trim()) return;
    const card = normalizeFlashcard(buildTrialCardFromName(trialName.trim(), sourceQuestion));
    updateState((prev) => ({
      ...prev,
      flashcards: { ...normalizeFlashcards(prev.flashcards), [card.id]: card },
      flashcardStats: { ...(prev.flashcardStats || {}), [card.id]: makeFlashcardStats(card) },
    }));
  };

  const reviewFlashcard = (cardId, rating) => {
    const rule = FLASHCARD_RATINGS[rating] || FLASHCARD_RATINGS.Good;
    const isWrong = rating === 'Again';
    playResultFeedback(isWrong ? 'wrong' : 'correct');
    updateState((prev) => {
      const cards = normalizeFlashcards(prev.flashcards);
      const card = cards[cardId];
      if (!card) return prev;
      const previousStats = prev.flashcardStats?.[cardId] || makeFlashcardStats(card);
      const mastery = Math.max(0, Math.min(5, (previousStats.mastery ?? card.mastery ?? 0) + rule.masteryDelta));
      const currentQuest = getDailyQuestProgress(prev, TODAY, getTodayPlanTask(prev), todayCompleted);
      const currentTask = studyPlan100.find((task) => task.id === currentQuest.planTaskId) || getTodayPlanTask(prev);
      const dailyQuestProgress = updateDailyQuestMemoryProgress(prev, TODAY, currentTask, todayCompleted, cardId, rating);
      return {
        ...prev,
        flashcards: {
          ...cards,
          [cardId]: {
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
            attempts: (previousStats.attempts || 0) + 1,
            correct: (previousStats.correct || 0) + (isWrong ? 0 : 1),
            wrong: (previousStats.wrong || 0) + (isWrong ? 1 : 0),
            lastRating: rating,
            lastReviewedAt: TODAY,
            intervalDays: rule.interval,
            nextReviewDate: addDays(TODAY, rule.interval),
            mastery,
            updatedAt: new Date().toISOString(),
          },
        },
        dailyQuestProgress: {
          ...(prev.dailyQuestProgress || {}),
          [TODAY]: writeDailyQuestTask(prev, TODAY, currentTask.id, dailyQuestProgress),
        },
      };
    });
  };

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
    });
  };

  const deleteFlashcard = (cardId) => {
    updateState((prev) => {
      const cards = normalizeFlashcards(prev.flashcards);
      if (!cards[cardId]) return prev;
      const nextCards = { ...cards };
      const nextStats = { ...(prev.flashcardStats || {}) };
      delete nextCards[cardId];
      delete nextStats[cardId];
      return {
        ...prev,
        flashcards: nextCards,
        flashcardStats: nextStats,
        deletedFlashcardIds: {
          ...(prev.deletedFlashcardIds || {}),
          [cardId]: new Date().toISOString(),
        },
      };
    });
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
      }));
      return { ok: true, message: `已匯入 ${cards.length} 張卡。` };
    } catch (error) {
      return { ok: false, message: error.message || 'JSON 格式錯誤，沒有匯入任何卡片。' };
    }
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
    });
  };

  const saveCustomQuestion = (question) => {
    const normalized = normalizeQuestion({
      ...question,
      id: question.id || `custom-${Date.now()}`,
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
    }));
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
    });
  };

  const loginWithEmail = async (email, password) => {
    setSyncError('');
    setSyncStatus('登入中...');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setSyncError(error.message);
      setSyncStatus('登入失敗。');
    }
  };

  const registerWithEmail = async (email, password) => {
    setSyncError('');
    setSyncStatus('建立帳號中...');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setSyncError(error.message);
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
      await setDoc(getCloudDocRef(user.uid), makeCloudPayload(localState), { merge: true });
      setSyncStatus('已把本機資料上傳到雲端。');
    } catch (error) {
      setSyncError(error.message);
      setSyncStatus('上傳雲端失敗。');
    }
  };

  const pullCloudToLocal = async () => {
    if (!user) return;
    setSyncError('');
    try {
      const snap = await getDoc(getCloudDocRef(user.uid));
      if (!snap.exists()) {
        setSyncStatus('雲端目前沒有資料。');
        return;
      }
      const merged = mergeCloudState(defaultState, snap.data());
      setIsApplyingCloudState(true);
      setState(merged);
      saveState(merged);
      setTimeout(() => setIsApplyingCloudState(false), 500);
      setSyncStatus('已從雲端覆蓋本機資料。');
    } catch (error) {
      setSyncError(error.message);
      setSyncStatus('下載雲端資料失敗。');
    }
  };

  const todaySession = state.sessions[TODAY];
  const baseQuestTask = getTodayPlanTask(state);
  const rawTodayIds = todaySession?.questionIds || EMPTY_ARRAY;
  const todaySessionPlanTaskId = todaySession?.planTaskId || null;
  const todaySessionMatchesQuest = Number(todaySessionPlanTaskId) === Number(baseQuestTask?.id);
  const todayIds = useMemo(
    () => (todaySessionMatchesQuest ? rawTodayIds : EMPTY_ARRAY),
    [todaySessionMatchesQuest, rawTodayIds]
  );
  const todayQuestions = useMemo(
    () => todayIds.map((id) => getQuestionWithOverride(id, state)).filter(Boolean),
    [todayIds, state]
  );
  const selectedPracticeMode = state.settings?.practiceMode || 'standard';
  const selectedPracticeConfig = getPracticeModeConfig(selectedPracticeMode);
  const todayPracticeMode = todaySession?.practiceMode || selectedPracticeMode;
  const todayPracticeConfig = getPracticeModeConfig(todayPracticeMode);
  const todayPracticeTargetCount = todayPracticeConfig.total;
  const todayPracticeTargetIds = todayIds.slice(0, todayPracticeTargetCount);
  const todayRatedCount = todayPracticeTargetIds.filter((id) => todaySession?.practiceDrafts?.[id]?.rated).length;
  const todayCompleted = todaySessionMatchesQuest
    && todayPracticeTargetCount > 0
    && todayPracticeTargetIds.length >= todayPracticeTargetCount
    && todayRatedCount >= todayPracticeTargetCount;
  const questProgress = getDailyQuestProgress(state, TODAY, baseQuestTask, todayCompleted);
  const questTask = studyPlan100.find((task) => task.id === questProgress.planTaskId) || baseQuestTask;
  const todayFocusMinutes = sumFocusMinutesByDate(state, TODAY);
  const focusStreak = getFocusStreak(state, TODAY);
  const focusElapsedSeconds = focusStartedAt
    ? Math.max(0, Math.floor((focusTick - new Date(focusStartedAt).getTime()) / 1000))
    : 0;
  const leaderboardFocusMinutes = todayFocusMinutes + (focusStartedAt ? Math.ceil(focusElapsedSeconds / 60) : 0);
  const leaderboardElapsedSeconds = Math.max(0, Math.floor((focusTick - leaderboardStartedAt) / 1000));
  const focusLeaderboardRows = useMemo(
    () => buildFocusLeaderboard(leaderboardFocusMinutes, leaderboardElapsedSeconds),
    [leaderboardFocusMinutes, leaderboardElapsedSeconds]
  );
  const currentPracticePage = Math.min(practicePage, Math.max(0, Math.ceil(todayQuestions.length / PRACTICE_PAGE_SIZE) - 1));
  const visibleTodayQuestions = todayQuestions.slice(currentPracticePage * PRACTICE_PAGE_SIZE, (currentPracticePage + 1) * PRACTICE_PAGE_SIZE);
  const totalPracticePages = Math.ceil(todayPracticeConfig.total / PRACTICE_PAGE_SIZE);
  const questRecallCards = getQuestMemoryCards(state, questTask);
  const questBossChallenges = buildBossChallenges(questTask, state);
  const highYieldTopics = getRankedHighYieldTopics(state, questTask);
  const todayHighValueCards = getHighValueCardsCreatedToday(state);
  const todayErrorTypeStatus = getDailyWrongErrorTypeStatus(state, todayIds);
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

  const updatePracticeDraft = useCallback((questionId, patch) => {
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

      return {
        ...prev,
        sessions: {
          ...(prev.sessions || {}),
          [TODAY]: {
            ...sess,
            practiceDrafts: drafts,
          },
        },
      };
    });
  }, []);

  const createTodaySession = ({ force = false } = {}) => {
    const modeConfig = getPracticeModeConfig(state.settings?.practiceMode);
    updateState((prev) => {
      const existing = prev.sessions?.[TODAY];
      const existingMatchesQuest = Number(existing?.planTaskId) === Number(questTask.id);
      const existingQuestionIds = existingMatchesQuest ? (existing?.questionIds || []) : [];
      const generatedIds = generateDailyQuestionIds(prev, questTask, force ? [] : existingQuestionIds);
      const targetCount = force ? modeConfig.total : Math.min(modeConfig.total, Math.max(PRACTICE_PAGE_SIZE, existingQuestionIds.length));
      const questionIds = force
        ? generatedIds
        : [...existingQuestionIds, ...generatedIds].filter((id, index, ids) => ids.indexOf(id) === index).slice(0, targetCount);
      if (!force && existingQuestionIds.length >= targetCount && existingMatchesQuest) return prev;
      return {
        ...prev,
        sessions: {
          ...prev.sessions,
          [TODAY]: {
            ...(force ? {} : existing),
            date: TODAY,
            planTaskId: questTask.id,
            planTopic: questTask.topic,
            practiceMode: state.settings?.practiceMode || 'standard',
            practiceModeLabel: modeConfig.shortLabel,
            practiceRecipe: {
              total: modeConfig.total,
              newCount: modeConfig.newCount,
              topicCount: modeConfig.topicCount,
              dueCount: modeConfig.dueCount,
              weaknessCount: modeConfig.weaknessCount,
              highYieldCount: modeConfig.highYieldCount || 0,
            },
            highYieldInserts: getRankedHighYieldTopics(prev, questTask).slice(0, 5).map(({ id, label, type, priorityScore }) => ({ id, label, type, priorityScore })),
            questionIds,
            createdAt: force || !existing?.createdAt ? new Date().toISOString() : existing.createdAt,
            updatedAt: new Date().toISOString(),
            completed: false,
            practiceDrafts: force ? {} : (existing?.practiceDrafts || {}),
          },
        },
      };
    });
    setPracticePage(0);
    setTab('today');
  };

  const loadNextPracticePage = () => {
    const nextPage = currentPracticePage + 1;
    const requiredCount = Math.min(todayPracticeConfig.total, (nextPage + 1) * PRACTICE_PAGE_SIZE);
    if (todayQuestions.length >= requiredCount) {
      setPracticePage(nextPage);
      return;
    }
    if (todayQuestions.length >= todayPracticeConfig.total) return;

    updateState((prev) => {
      const existing = prev.sessions?.[TODAY];
      const existingMatchesQuest = Number(existing?.planTaskId) === Number(questTask.id);
      if (!existingMatchesQuest) return prev;
      const existingQuestionIds = existing?.questionIds || [];
      const targetCount = Math.min(todayPracticeConfig.total, (nextPage + 1) * PRACTICE_PAGE_SIZE);
      const generatedIds = generateDailyQuestionIds(prev, questTask, existingQuestionIds);
      const questionIds = [...existingQuestionIds, ...generatedIds]
        .filter((id, index, ids) => ids.indexOf(id) === index)
        .slice(0, targetCount);
      if (questionIds.length <= existingQuestionIds.length) return prev;

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
    });
    setPracticePage(nextPage);
  };

  const claimDailyCompletion = () => {
    if (!todayCompleted || state.game?.dailyClaims?.[TODAY]) return;
    updateState((prev) => ({
      ...prev,
      sessions: {
        ...(prev.sessions || {}),
        [TODAY]: { ...(prev.sessions?.[TODAY] || {}), planTaskId: questTask.id, planTopic: questTask.topic, completed: true },
      },
      game: {
        ...awardXp(prev.game || defaultState.game, getPracticeModeConfig(prev.sessions?.[TODAY]?.practiceMode).xp, `${getPracticeModeConfig(prev.sessions?.[TODAY]?.practiceMode).shortLabel} Daily Practice completed`, { date: TODAY, practiceMode: prev.sessions?.[TODAY]?.practiceMode || 'standard' }),
        streak: (prev.game?.streak || 0) + 1,
        dailyClaims: { ...(prev.game?.dailyClaims || {}), [TODAY]: true },
      },
    }));
  };

  const claimDailyChest = () => {
    const currentChest = getDailyChest(state, todayCompleted);
    if (currentChest.progress < 100 || currentChest.claimed) return;
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
    });
  };

  const markQuestRecall = (card, rating) => {
    const cardId = typeof card === 'string' ? card : card.id;
    const isPersistentCard = typeof card !== 'string' && card.sourceType !== 'topic-recall' && normalizeFlashcards(state.flashcards)[card.id];
    const rule = FLASHCARD_RATINGS[rating] || FLASHCARD_RATINGS.Good;
    playResultFeedback(rating === 'Again' ? 'wrong' : 'correct');
    updateState((prev) => {
      const next = updateDailyQuestMemoryProgress(prev, TODAY, questTask, todayCompleted, cardId, rating);

      if (!isPersistentCard) {
        return {
          ...prev,
          dailyQuestProgress: {
            ...(prev.dailyQuestProgress || {}),
            [TODAY]: writeDailyQuestTask(prev, TODAY, questTask.id, next),
          },
        };
      }

      const cards = normalizeFlashcards(prev.flashcards);
      const persistedCard = cards[cardId];
      const previousStats = prev.flashcardStats?.[cardId] || makeFlashcardStats(persistedCard);
      const isWrong = rating === 'Again';
      const mastery = Math.max(0, Math.min(5, (previousStats.mastery ?? persistedCard.mastery ?? 0) + rule.masteryDelta));
      return {
        ...prev,
        flashcards: {
          ...cards,
          [cardId]: {
            ...persistedCard,
            difficulty: rating === 'Again' ? Math.min(5, (persistedCard.difficulty || 3) + 0.5) : persistedCard.difficulty || 3,
            updatedAt: new Date().toISOString(),
            lastRating: rating,
          },
        },
        flashcardStats: {
          ...(prev.flashcardStats || {}),
          [cardId]: {
            ...previousStats,
            attempts: (previousStats.attempts || 0) + 1,
            correct: (previousStats.correct || 0) + (isWrong ? 0 : 1),
            wrong: (previousStats.wrong || 0) + (isWrong ? 1 : 0),
            lastRating: rating,
            lastReviewedAt: TODAY,
            intervalDays: rule.interval,
            nextReviewDate: addDays(TODAY, rule.interval),
            mastery,
            updatedAt: new Date().toISOString(),
          },
        },
        dailyQuestProgress: {
          ...(prev.dailyQuestProgress || {}),
          [TODAY]: writeDailyQuestTask(prev, TODAY, questTask.id, next),
        },
      };
    });
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
            planTaskId: questTask.id,
            results: nextResults,
            passed: passCount,
            bossDone,
            perfectClear: passCount === 3,
          },
        },
        dailyQuestProgress: {
          ...(prev.dailyQuestProgress || {}),
          [TODAY]: writeDailyQuestTask(prev, TODAY, questTask.id, next),
        },
      };
    });
  };

  const claimStageClear = () => {
    const current = getDailyQuestProgress(state, TODAY, questTask, todayCompleted);
    if (current.stars < 3 || current.xpClaimed) return;
    updateState((prev) => {
      const currentProgress = getDailyQuestProgress(prev, TODAY, questTask, todayCompleted);
      if (currentProgress.xpClaimed || currentProgress.stars < 3) return prev;
      const awardedGame = awardXp(prev.game || defaultState.game, XP_RULES.stageClear, 'Daily quest stage clear', { date: TODAY, taskId: questTask.id });
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
        planProgress: {
          ...(prev.planProgress || {}),
          [questTask.id]: true,
        },
        dailyQuestProgress: {
          ...(prev.dailyQuestProgress || {}),
          [TODAY]: writeDailyQuestTask(prev, TODAY, questTask.id, {
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
    });
  };

  const regenerateTodaySession = () => {
    if (!window.confirm('重新抽題會覆蓋今天的題目清單，但不會刪除作答紀錄。確定？')) return;
    createTodaySession({ force: true });
  };

  const dueReview = useMemo(() => getQuestionPool(state)
    .map((q) => ({ q: getQuestionWithOverride(q.id, state), stat: getStat(state, q.id) }))
    .filter(({ q, stat }) => q && stat.nextReviewDate && stat.nextReviewDate <= TODAY)
    .sort((a, b) => wrongRate(b.stat) - wrongRate(a.stat)), [state]);

  const weakQuestions = useMemo(() => getQuestionPool(state)
    .map((q) => ({ q: getQuestionWithOverride(q.id, state), stat: getStat(state, q.id) }))
    .filter(({ q, stat }) => q && (stat.wrong > 0 || stat.bookmarked))
    .sort((a, b) => wrongRate(b.stat) - wrongRate(a.stat) || b.stat.wrong - a.stat.wrong), [state]);

  const remediationQueue = useMemo(() => weakQuestions
    .map(({ q, stat }) => {
      const errorType = stat.lastErrorType || stat.errorTypes?.[stat.errorTypes.length - 1] || '';
      const remediation = stat.lastRemediationTask || (errorType ? {
        errorType,
        ...getRemediationForErrorType(errorType),
      } : null);
      return remediation ? { q, stat, remediation } : null;
    })
    .filter(Boolean)
    .sort((a, b) => wrongRate(b.stat) - wrongRate(a.stat) || b.stat.wrong - a.stat.wrong), [weakQuestions]);

  const summary = useMemo(() => {
    const stats = Object.values(state.stats);
    const attempts = stats.reduce((s, x) => s + (x.attempts || 0), 0);
    const correct = stats.reduce((s, x) => s + (x.correct || 0), 0);
    const wrong = stats.reduce((s, x) => s + (x.wrong || 0), 0);
    const reviewed = Object.keys(state.stats).filter((id) => state.stats[id]?.attempts > 0).length;
    return { attempts, correct, wrong, reviewed, accuracy: attempts ? Math.round((correct / attempts) * 100) : 0 };
  }, [state]);

  const cancerSummary = useMemo(() => getCancerSummary(state), [state]);
  const taxonomyAnalytics = useMemo(() => getTaxonomyAnalytics(state), [state]);
  const readiness = useMemo(() => getReadinessMetrics(state), [state]);
  const bossRows = useMemo(() => getBossRows(state, readiness), [state, readiness]);
  const dailyChest = getDailyChest(state, todayCompleted);
  const allFlashcards = useMemo(() => getFlashcardList(state), [state]);
  const dueFlashcards = useMemo(() => getDueFlashcards(state), [state]);

  const finishMockExam = (completedExam) => {
    updateState((prev) => {
      const nextStats = { ...(prev.stats || {}) };
      completedExam.results.forEach((result) => {
        const previous = getStat(prev, result.questionId);
        const wasPreviouslyWrong = (previous.wrong || 0) > 0;
        const interval = result.isCorrect ? nextIntervalByRating(result.confidence >= 4 ? 'Easy' : 'Good', previous) : 1;
        const event = { ...result, date: TODAY, mode: 'mock', rating: result.isCorrect ? 'Good' : 'Again' };
        nextStats[result.questionId] = {
          ...previous,
          attempts: (previous.attempts || 0) + 1,
          correct: (previous.correct || 0) + (result.isCorrect ? 1 : 0),
          wrong: (previous.wrong || 0) + (result.isCorrect ? 0 : 1),
          lastResult: result.isCorrect ? 'correct' : 'wrong',
          lastRating: result.isCorrect ? 'Good' : 'Again',
          lastAttemptAt: TODAY,
          nextReviewDate: addDays(TODAY, interval),
          mastery: result.isCorrect ? Math.min(5, (previous.mastery || 0) + 1) : Math.max(0, (previous.mastery || 0) - 1),
          intervalDays: interval,
          userAnswer: result.selected,
          correctAnswer: result.correctAnswer,
          lastConfidence: result.confidence,
          confidenceHistory: [...(previous.confidenceHistory || []), result.confidence].slice(-50),
          answerHistory: [...(previous.answerHistory || []), event].slice(-50),
          timeHistory: [...(previous.timeHistory || []), result.timeSpentSec].slice(-50),
          highConfidenceWrong: (previous.highConfidenceWrong || 0) + (!result.isCorrect && result.confidence >= 4 ? 1 : 0),
          repeatedWrong: result.isCorrect ? 0 : (previous.repeatedWrong || 0) + 1,
          wrongRetestAttempts: (previous.wrongRetestAttempts || 0) + (wasPreviouslyWrong ? 1 : 0),
          wrongRetestCorrect: (previous.wrongRetestCorrect || 0) + (wasPreviouslyWrong && result.isCorrect ? 1 : 0),
        };
      });
      return {
        ...prev,
        stats: nextStats,
        mockExams: [completedExam, ...(prev.mockExams || [])].slice(0, 20),
      };
    });
  };

  const planProgress = useMemo(() => state.planProgress || {}, [state.planProgress]);

  const planSummary = useMemo(() => {
    const total = studyPlan100.length;
    const completed = studyPlan100.filter((task) => planProgress[task.id]).length;
    const percent = total ? Math.round((completed / total) * 100) : 0;

    const byCancerMap = studyPlan100.reduce((acc, task) => {
      if (!acc[task.cancer]) acc[task.cancer] = { cancer: task.cancer, total: 0, completed: 0 };
      acc[task.cancer].total += 1;
      if (planProgress[task.id]) acc[task.cancer].completed += 1;
      return acc;
    }, {});

    const goldenTotal = studyPlan100.filter((task) => task.goldenTrials?.length).length;
    const goldenCompleted = studyPlan100.filter((task) => task.goldenTrials?.length && planProgress[task.id]).length;

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

  const statsDashboard = useMemo(
    () => getStatsDashboard(state, planSummary, readiness, cancerSummary),
    [state, planSummary, readiness, cancerSummary]
  );


  const nextPlanTask = studyPlan100.find((task) => !planProgress[task.id]) || studyPlan100[studyPlan100.length - 1];
  const topWeakCancer = cancerSummary.find((row) => row.status === 'Red') || cancerSummary[0];
  const topRedTopic = readiness.redTopics?.[0];
  const dueCount = dueReview.length;
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
    const task = studyPlan100.find((item) => Number(item.id) === Number(id));
    if (!task) return;
    updateState((prev) => {
      const wasDone = Boolean(prev.planProgress?.[id]);
      const checked = checkedOverride == null ? !wasDone : Boolean(checkedOverride);
      const nextState = {
        ...prev,
        game: checked && !wasDone ? awardXp(prev.game || defaultState.game, XP_RULES.planTask, '100-Day task completed', { taskId: id }) : prev.game,
        planProgress: {
          ...(prev.planProgress || {}),
          [id]: checked,
        },
        planItemProgress: {
          ...(prev.planItemProgress || {}),
          [id]: buildFullPlanItemProgress(task, checked),
        },
      };
      return syncBossGameState(nextState);
    });
  };

  const togglePlanItem = (task, group, item) => {
    updateState((prev) => {
      const taskId = task.id;
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
      };
      const fullyConfirmed = isTaskFullyConfirmed(task, nextItemProgress);
      const questCleared = Object.values(prev.dailyQuestProgress || {}).some((bucket) => {
        const saved = bucket?.tasks?.[taskId] || (Number(bucket?.planTaskId) === Number(taskId) ? bucket : null);
        return Boolean(saved?.xpClaimed || saved?.stageClearedAt);
      });
      const wasDone = Boolean(prev.planProgress?.[taskId]);
      const nextPlanProgress = {
        ...(prev.planProgress || {}),
        [taskId]: fullyConfirmed || (wasDone && questCleared),
      };
      const nextState = {
        ...prev,
        game: fullyConfirmed && !wasDone ? awardXp(prev.game || defaultState.game, XP_RULES.planTask, '100-Day task completed', { taskId }) : prev.game,
        planProgress: nextPlanProgress,
        planItemProgress: nextPlanItemProgress,
      };
      return syncBossGameState(nextState);
    });
  };

  const setPlanCancerCompleted = (cancer, completed) => {
    updateState((prev) => {
      const next = { ...(prev.planProgress || {}) };
      const nextItemProgress = { ...(prev.planItemProgress || {}) };
      studyPlan100.filter((task) => task.cancer === cancer).forEach((task) => {
        next[task.id] = completed;
        nextItemProgress[task.id] = buildFullPlanItemProgress(task, completed);
      });
      return syncBossGameState({ ...prev, planProgress: next, planItemProgress: nextItemProgress });
    });
  };

  const resetPlanProgress = () => {
    const updatedAt = new Date().toISOString();
    updateState((prev) => ({
      ...prev,
      planProgress: {},
      planItemProgress: {},
      dailyQuestProgress: {},
      bossProgress: {},
      game: { ...defaultState.game },
      player: { ...defaultState.player },
      cloudMeta: {
        ...(prev.cloudMeta || {}),
        updatedAt,
        planResetAt: updatedAt,
        gameResetAt: updatedAt,
        device: navigator.userAgent,
      },
    }));
    setSyncStatus('已重新開始 100-Day Plan，並重設完成度與 XP。');
  };


  const bankQuestions = useMemo(() => getQuestionPool(state)
    .map((q) => getQuestionWithOverride(q.id, state))
    .filter(Boolean)
    .filter((q) => {
      const text = `${questionSearchText(q)} ${tagSearchText(q.tags)}`;
      const searchOk = !search || text.includes(search.toLowerCase());
      const cancerOk = bankCancer === 'All' || (q.tags?.cancerDomain || q.cancer) === bankCancer;
      const yearOk = bankYear === 'All' || String(q.year) === String(bankYear);
      return searchOk && cancerOk && yearOk;
    }), [search, bankCancer, bankYear, state]);

  const updateSettings = (patch) => {
    updateState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  };

  const setPracticeMode = (practiceMode) => {
    const modeConfig = getPracticeModeConfig(practiceMode);
    updateState((prev) => {
      const existing = prev.sessions?.[TODAY];
      const existingMatchesQuest = Number(existing?.planTaskId) === Number(questTask.id);
      return {
        ...prev,
        settings: {
          ...prev.settings,
          practiceMode,
          dailyCount: modeConfig.total,
        },
        sessions: {
          ...(prev.sessions || {}),
          ...(existingMatchesQuest ? {
            [TODAY]: {
              ...existing,
              practiceMode,
              practiceModeLabel: modeConfig.shortLabel,
              practiceRecipe: {
                total: modeConfig.total,
                newCount: modeConfig.newCount,
                topicCount: modeConfig.topicCount,
                dueCount: modeConfig.dueCount,
                weaknessCount: modeConfig.weaknessCount,
              },
              updatedAt: new Date().toISOString(),
            },
          } : {}),
        },
      };
    });
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
          <button className="primary" onClick={() => createTodaySession()}>產生今日 Daily Practice</button>
          <button className="secondary" onClick={() => setAiPromptOpen(!aiPromptOpen)}>AI Review Prompt</button>
        </div>
      </header>

      <section className="metrics-grid">
        <MetricCard label="題庫總數" value={getQuestionPool(state).length} sub={`${QUESTION_YEAR_LABEL} 年`} />
        <MetricCard label="已練題目" value={summary.reviewed} sub={`${summary.attempts} total attempts`} />
        <MetricCard label="正確率" value={`${summary.accuracy}%`} sub={`${summary.correct} correct / ${summary.wrong} wrong`} />
        <MetricCard label="今日待複習" value={dueReview.length} sub="依 next review date" />
        <MetricCard label="≥80 機率" value={`${readiness.probability80}%`} sub={readiness.readinessLevel} />
        <MetricCard label="Level / XP" value={`Lv ${state.game?.level || 1}`} sub={`${state.game?.xp || 0} XP · streak ${state.game?.streak || 0}`} />
        <MetricCard label="今日專注" value={`${todayFocusMinutes} 分`} sub={`focus streak ${focusStreak} 天`} />
        <MetricCard label="Flashcards" value={getFlashcardList(state).length} sub={`${dueFlashcards.length} due today`} />
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
        <section className="focus-timer" aria-label="Focus timer">
          <div>
            <span>專注計時</span>
            <strong>{focusStartedAt ? formatFocusDuration(focusElapsedSeconds) : `${todayFocusMinutes} 分`}</strong>
            <em>{focusStartedAt ? '正在記錄這段讀書時間' : `今日已記錄 · 連續 ${focusStreak} 天`}</em>
          </div>
          <div className="focus-timer-actions">
            {focusStartedAt ? (
              <>
                <button className="good" type="button" onClick={finishFocusSession}>結束並記錄</button>
                <button className="secondary" type="button" onClick={cancelFocusSession}>取消</button>
              </>
            ) : (
              <button className="primary" type="button" onClick={startFocusSession}>開始專注</button>
            )}
          </div>
        </section>
        <FocusMarquee />
        <StudyLeaderboard rows={focusLeaderboardRows} />
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

      {aiPromptOpen && (
        <section className="panel">
          <div className="panel-title">AI Review Prompt</div>
          <p className="muted">複製到 ChatGPT / OpenAI API，即可根據錯題產生弱點分析、MCQ、oral board 題。</p>
          <textarea className="prompt-box" readOnly value={buildAiPrompt(state)} />
        </section>
      )}

      <nav className="tabs">
        {[['quest', 'Quest'], ['stats', 'Stats'], ['readiness', 'Board Readiness'], ['mock', 'Mock Exam'], ['critical', 'Critical Errors'], ['flashcards', 'Flashcards'], ['flashcard-review', 'Card Review'], ['today', 'Daily Practice'], ['review', 'Review Queue'], ['questions', 'Question Manager'], ['analytics', 'Analytics'], ['plan', '100-Day Plan'], ['sync', 'Cloud Sync'], ['settings', 'Settings']].map(([key, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>
        ))}
      </nav>

      {tab === 'quest' && (
        <QuestPanel
          task={questTask}
          progress={questProgress}
          recallCards={questRecallCards}
          bossChallenges={questBossChallenges}
          highYieldTopics={highYieldTopics}
          completionStatus={completionStatus}
          onCreatePractice={createTodaySession}
          practiceMode={selectedPracticeMode}
          onPracticeModeChange={setPracticeMode}
          onMarkRecall={markQuestRecall}
          onSetBossResult={setQuestBossResult}
          onClaimStageClear={claimStageClear}
          onOpenPractice={() => setTab('today')}
        />
      )}

      {tab === 'stats' && (
        <StatsDashboard stats={statsDashboard} />
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
        <MockExamPanel state={state} onFinishMock={finishMockExam} />
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
          dueFlashcards={dueFlashcards}
          weakQuestions={weakQuestions}
          onReviewCard={reviewFlashcard}
          onCreateTrialCard={createTrialCard}
          onImportFlashcards={importFlashcards}
          onUpdateFlashcard={updateFlashcard}
          onDeleteFlashcard={deleteFlashcard}
        />
      )}


      {tab === 'flashcard-review' && (
        <FlashcardReviewPanel
          dueFlashcards={dueFlashcards}
          allFlashcards={allFlashcards}
          onReviewCard={reviewFlashcard}
          onUpdateCard={updateFlashcard}
          onDeleteCard={deleteFlashcard}
          onOpenImport={() => setTab('flashcards')}
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
            </div>
            <div className="inline-actions">
              <button className="secondary" onClick={regenerateTodaySession}>重新抽題</button>
              <button className="good" disabled={!todayCompleted || state.game?.dailyClaims?.[TODAY]} onClick={claimDailyCompletion}>
                {state.game?.dailyClaims?.[TODAY] ? '今日 XP 已領取' : '領取每日 XP'}
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
              <button className="primary" onClick={() => createTodaySession()}>產生今日 Daily Practice</button>
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
                <span>目前已載入 {todayQuestions.length}/{todayPracticeConfig.total} 題，每頁 10 題。</span>
              </div>
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
                  />
                ))}
              </div>
              <div className="practice-page-actions">
                <button className="secondary" disabled={currentPracticePage === 0} onClick={() => setPracticePage(Math.max(0, currentPracticePage - 1))}>上一頁</button>
                <button className="primary" disabled={currentPracticePage + 1 >= totalPracticePages} onClick={loadNextPracticePage}>
                  {todayQuestions.length < Math.min(todayPracticeConfig.total, (currentPracticePage + 2) * PRACTICE_PAGE_SIZE) ? '下一頁並補題' : '下一頁'}
                </button>
              </div>
            </>
          )}
        </main>
      )}

      {tab === 'review' && (
        <main className="panel">
          <h2>Review Queue</h2>
          <p className="muted">優先順序：錯因補救任務 → 今日到期 → 錯誤率 ≥50% → 已標記題目 → 未練新題。</p>
          <div className="subsection">
            <h3>錯因補救任務</h3>
            {remediationQueue.length === 0 ? <p className="muted">答錯並選擇 Error type 後，這裡會自動排入 Trial Card、Cloze Card、Algorithm Card 等補救任務。</p> : remediationQueue.slice(0, 20).map(({ q, stat, remediation }) => (
              <div className="remediation-row" key={`${q.id}-${remediation.errorType || remediation.task}`}>
                <div>
                  <strong>{q.id}</strong> · {q.cancer} · {q.topic} · wrong rate {wrongRate(stat)}%
                  <p>{remediation.errorType || stat.lastErrorType} → {remediation.task}</p>
                  <span>{remediation.action}</span>
                </div>
                <span className="pill tag">{remediation.cardType}</span>
              </div>
            ))}
          </div>
          <div className="subsection">
            <h3>今日到期複習</h3>
            {dueReview.length === 0 ? <p className="muted">目前沒有到期題目。</p> : dueReview.slice(0, 30).map(({ q, stat }) => (
              <QuestionCard key={q.id} question={q} stat={stat} onUpdateStat={updateStat} compact />
            ))}
          </div>
          <div className="subsection">
            <h3>高錯誤率 / 標記題</h3>
            {weakQuestions.slice(0, 30).map(({ q, stat }) => (
              <QuestionCard key={q.id} question={q} stat={stat} onUpdateStat={updateStat} compact />
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
            onClaimDailyChest={claimDailyChest}
          />

          <section className="plan-overview">
            <MetricCard label="總完成率" value={`${planSummary.percent}%`} sub={`${planSummary.completed}/${planSummary.total} tasks`} />
            <MetricCard label="Golden trial 完成率" value={`${planSummary.goldenPercent}%`} sub={`${planSummary.goldenCompleted}/${planSummary.goldenTotal} trial tasks`} />
            <MetricCard label="今日建議" value={`Day ${Math.min(planSummary.completed + 1, 100)}`} sub="照順序推進，錯題用 Review Queue 補強" />
            <MetricCard label="Game level" value={`Lv ${state.game?.level || 1}`} sub={`${state.game?.xp || 0} XP`} />
            <MetricCard label="Boss defeated" value={(state.game?.defeatedBosses || []).length} sub={`${(state.game?.unlockedBosses || []).length} unlocked`} />
            <MetricCard label="Trial cards" value={getFlashcardList(state).filter((card) => card.sourceType === 'trial' || card.type === 'Trial Card').length} sub="Trial Boss target 50" />
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
                const done = Boolean(planProgress[task.id]);
                const itemProgress = getPlanItemProgressForTask(state, task.id);
                const criteriaItems = getTaskCriteriaItems(task);
                const knowledgeItems = getTaskKnowledgeItems(task);
                const confirmedCount = criteriaItems.filter((item) => itemProgress.criteria?.[item]).length
                  + knowledgeItems.filter((item) => itemProgress.knowledge?.[item]).length;
                const totalConfirmations = criteriaItems.length + knowledgeItems.length;
                return (
                  <article key={task.id} className={done ? 'plan-task done' : 'plan-task'}>
                    <input
                      type="checkbox"
                      checked={done}
                      aria-label={`${task.day} complete`}
                      onChange={(event) => togglePlanTask(task.id, event.target.checked)}
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
