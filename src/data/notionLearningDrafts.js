import { normalizeNotionLibraryItem } from './notionLibrary.js';
import { buildNotionLearningTags, mapNotionCancerToTrackerDomain } from './notionTaxonomy.js';
import { trialRegistryCandidates } from './trialRegistry.js';

export const NOTION_LEARNING_ARTIFACTS = Object.freeze([
  { id: 'flashcards', label: 'Mixed flashcards', target: 'Card Manager' },
  { id: 'trial-cards', label: 'Trial cards', target: 'Card Manager' },
  { id: 'quiz', label: '5-option quiz', target: 'Question Manager' },
  { id: 'board-traps', label: 'Board traps', target: 'Card Manager' },
]);

const CARD_TYPES = new Set(['Trial Card', 'Algorithm Card', 'Cloze Card', 'Trap Card']);
const STOP_WORDS = new Set([
  'about', 'after', 'before', 'cancer', 'disease', 'early', 'late', 'note', 'review',
  'stage', 'therapy', 'treatment', 'with', 'without', '整理', '治療', '重點', '癌症',
]);

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

function noteSearchText(note = {}) {
  const normalized = normalizeNotionLibraryItem(note);
  return [normalized.title, normalized.plainText, normalized.searchText]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function textIncludesTerm(text, term) {
  const normalized = String(term || '').trim().toLowerCase();
  return normalized.length >= 2 && text.includes(normalized);
}

function textIncludesKnownName(text, name) {
  const normalized = String(name || '').trim().toLowerCase();
  if (!normalized) return false;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
}

function titleTerms(title = '') {
  return unique(String(title).split(/[^a-zA-Z0-9+\u4e00-\u9fff-]+/))
    .map((term) => term.toLowerCase())
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term));
}

function inferKnownTrials(note = {}, relatedQuestions = []) {
  const text = noteSearchText(note);
  const fromQuestions = (relatedQuestions || [])
    .flatMap((question) => question.trials || [])
    .filter((name) => textIncludesKnownName(text, name));
  const fromRegistry = trialRegistryCandidates
    .filter((trial) => [trial.canonicalName, ...(trial.aliases || [])]
      .some((name) => textIncludesKnownName(text, name)))
    .map((trial) => trial.canonicalName);
  return unique([...fromQuestions, ...fromRegistry]);
}

export function deriveNotionLearningContext(note = {}, relatedQuestions = []) {
  const normalized = normalizeNotionLibraryItem(note);
  const cancer = mapNotionCancerToTrackerDomain(normalized.cancerTypes)
    || relatedQuestions.find((question) => question.cancer)?.cancer
    || 'Other';
  const trials = inferKnownTrials(normalized, relatedQuestions);
  const autoTags = buildNotionLearningTags(normalized, trials);

  return {
    cancer,
    topic: normalized.title,
    trials,
    autoTags,
    note: normalized,
  };
}

export function scoreQuestionForNotionNote(note = {}, question = {}) {
  const context = deriveNotionLearningContext(note);
  const noteText = noteSearchText(note);
  const questionText = [
    question.id,
    question.cancer,
    question.topic,
    question.stem,
    question.explanation,
    ...(question.trials || []),
    ...Object.values(question.options || {}),
  ].filter(Boolean).join(' ').toLowerCase();
  const sameCancer = Boolean(context.cancer && context.cancer === question.cancer);
  const trialHits = normalizeList(question.trials).filter((trial) => textIncludesTerm(noteText, trial)).length;
  const geneHits = context.note.genes.filter((gene) => textIncludesTerm(questionText, gene)).length;
  const metadataTerms = unique([
    ...context.note.subtypes,
    ...context.note.tags,
    ...context.note.treatments,
    ...context.note.drugs,
  ]).filter((term) => String(term).length >= 3);
  const metadataHits = metadataTerms.filter((term) => textIncludesTerm(questionText, term)).length;
  const headingHits = titleTerms(context.note.title).filter((term) => textIncludesTerm(questionText, term)).length;
  if (!sameCancer && trialHits === 0 && geneHits === 0) return 0;
  if (trialHits === 0 && geneHits === 0 && headingHits < 2 && metadataHits < 2) return 0;
  return (sameCancer ? 35 : 0)
    + (trialHits * 70)
    + (geneHits * 32)
    + (headingHits * 12)
    + (metadataHits * 8);
}

export function getRelatedQuestionsForNotionNote(note = {}, questions = [], limit = 12) {
  return (questions || [])
    .map((question) => ({ question, score: scoreQuestionForNotionNote(note, question) }))
    .filter(({ score }) => score >= 55)
    .sort((a, b) => b.score - a.score || String(a.question.id).localeCompare(String(b.question.id)))
    .slice(0, limit);
}

function artifactInstructions(artifactType) {
  if (artifactType === 'quiz') {
    return `產生 3–5 題五選一題目。只輸出 JSON array，每題 schema：
{"stem":"","options":{"A":"","B":"","C":"","D":"","E":""},"answer":"A","explanation":"","cancer":"","topic":"","trials":[],"tags":[],"sourceEvidence":""}
規則：每題只測一個 decision point；干擾選項必須合理；explanation 要說明正解與主要陷阱。`;
  }
  const forcedType = artifactType === 'trial-cards'
    ? '每張 type 必須是 "Trial Card"。'
    : artifactType === 'board-traps'
      ? '每張 type 必須是 "Trap Card"。正面放常見錯誤或易混淆判斷，背面說明為何錯。'
      : 'type 只能是 "Trial Card", "Algorithm Card", "Cloze Card", "Trap Card"。依內容選最適合的類型。';
  return `產生 3–8 張卡。只輸出 JSON array，每張 schema：
{"front":"","back":"","type":"Trial Card","cancer":"","topic":"","trial":[],"tags":[],"examValue":1,"errorType":"Knowledge gap","sourceEvidence":""}
${forcedType}
Trial Card 要包含 population/intervention/comparator/endpoint/trap；Algorithm Card 要呈現順序與例外；Cloze Card 使用 {{c1::answer}}；Trap Card 要指出錯誤直覺。`;
}

export function buildNotionLearningPrompt({ artifactType = 'flashcards', note = {}, relatedQuestions = [] } = {}) {
  const context = deriveNotionLearningContext(note, relatedQuestions);
  const sourceText = String(context.note.plainText || '').slice(0, 14000);
  const questionLinks = relatedQuestions.slice(0, 8).map((question) => (
    `${question.id}: ${question.topic || ''}; trials=${normalizeList(question.trials).join(', ') || 'none'}`
  )).join('\n');
  return `你是一位 hematology-oncology board exam coach。請把以下 Fellow training 筆記轉成可審核的學習草稿。

SOURCE-GROUNDED SAFETY RULES
1. 只能使用下方 SOURCE NOTE 明確提供的內容；不可補寫未出現的數字、療效、適應症或 guideline 建議。
2. 若來源不足以製作某一項，省略該項，不要猜測。
3. 每個輸出都必須有 sourceEvidence，使用簡短原文片段或可定位的 heading；不得杜撰 evidence。
4. 醫學名詞與藥名保留英文，其餘使用繁體中文。
5. 只輸出 JSON，不要 markdown，不要前後說明。

TARGET
${artifactInstructions(artifactType)}

AUTO MAPPING
Cancer: ${context.cancer}
Topic: ${context.topic}
Trials: ${context.trials.join(', ') || 'none detected'}
Tags: ${context.autoTags.join(', ') || 'source/notion'}
Notion page ID: ${context.note.id || ''}

RELATED EXISTING QUESTIONS（只作連結提示，不可拿來補寫筆記沒有的醫學事實）
${questionLinks || 'none'}

SOURCE NOTE
Title: ${context.note.title}
Headings: ${(context.note.headings || []).map((heading) => heading.text).filter(Boolean).join(' | ') || 'none'}
Content:
${sourceText || '[No plain-text content available. Do not generate items.]'}`.trim();
}

function parseJsonArray(rawJson) {
  const parsed = JSON.parse(String(rawJson || '').trim());
  const items = Array.isArray(parsed) ? parsed : parsed?.items;
  if (!Array.isArray(items)) throw new Error('請貼上 JSON array，或包含 items array 的 JSON object。');
  if (items.length > 20) throw new Error('一次最多審核 20 個 learning drafts。');
  return items;
}

function normalizeCardType(value, artifactType) {
  if (artifactType === 'trial-cards') return 'Trial Card';
  if (artifactType === 'board-traps') return 'Trap Card';
  const normalized = String(value || '').trim();
  return CARD_TYPES.has(normalized) ? normalized : '';
}

export function canonicalLearningText(value = '') {
  return String(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

export function parseNotionLearningDrafts(rawJson, artifactType, note = {}, relatedQuestions = []) {
  const sourceItems = parseJsonArray(rawJson);
  const context = deriveNotionLearningContext(note, relatedQuestions);
  const items = [];
  const errors = [];

  sourceItems.forEach((source, index) => {
    const position = index + 1;
    const sourceEvidence = String(source?.sourceEvidence || '').trim();
    if (!sourceEvidence) {
      errors.push(`第 ${position} 項缺少 sourceEvidence，未納入草稿。`);
      return;
    }

    if (artifactType === 'quiz') {
      const options = Object.fromEntries(['A', 'B', 'C', 'D', 'E']
        .map((key) => [key, String(source?.options?.[key] || '').trim()]));
      const answer = String(source?.answer || '').trim().toUpperCase();
      if (!String(source?.stem || '').trim() || Object.values(options).some((value) => !value) || !options[answer]) {
        errors.push(`第 ${position} 題需要 stem、A–E 五個選項及有效 answer。`);
        return;
      }
      items.push({
        draftId: `notion-quiz-${position}`,
        kind: 'question',
        stem: String(source.stem).trim(),
        options,
        answer,
        explanation: String(source.explanation || '').trim(),
        cancer: source.cancer || context.cancer,
        topic: source.topic || context.topic,
        trials: unique([...context.trials, ...normalizeList(source.trials || source.trial)]),
        tags: unique([...context.autoTags, ...normalizeList(source.tags)]),
        sourceEvidence,
        notionPageId: context.note.id,
        notionUrl: context.note.url,
        sourceTitle: context.note.title,
      });
      return;
    }

    const type = normalizeCardType(source?.type, artifactType);
    if (!String(source?.front || '').trim() || !String(source?.back || '').trim() || !type) {
      errors.push(`第 ${position} 張卡需要 front、back 與有效的四類 card type。`);
      return;
    }
    items.push({
      draftId: `notion-card-${position}`,
      kind: 'flashcard',
      front: String(source.front).trim(),
      back: String(source.back).trim(),
      cloze: String(source.cloze || '').trim(),
      type,
      cancer: source.cancer || context.cancer,
      topic: source.topic || context.topic,
      trial: unique([...context.trials, ...normalizeList(source.trial || source.trials)]),
      tags: unique([...context.autoTags, ...normalizeList(source.tags)]),
      examValue: Math.max(1, Math.min(5, Number(source.examValue) || 3)),
      errorType: String(source.errorType || (type === 'Trial Card' ? 'Trial confusion' : type === 'Trap Card' ? 'Misread question' : 'Knowledge gap')),
      sourceEvidence,
      sourceType: 'notion',
      sourceId: context.note.id,
      sourceQuestionId: `notion:${context.note.id}`,
      notionPageId: context.note.id,
      notionUrl: context.note.url,
      sourceTitle: context.note.title,
    });
  });

  return { items, errors, total: sourceItems.length };
}

export function markLearningDraftDuplicates(items = [], existingFlashcards = [], existingQuestions = []) {
  const cardKeys = new Set((existingFlashcards || []).map((card) => canonicalLearningText(card.front)));
  const questionKeys = new Set((existingQuestions || []).map((question) => canonicalLearningText(question.stem)));
  const seenCards = new Set();
  const seenQuestions = new Set();
  return (items || []).map((item) => {
    const key = canonicalLearningText(item.kind === 'question' ? item.stem : item.front);
    const existing = item.kind === 'question' ? questionKeys.has(key) : cardKeys.has(key);
    const repeatedInBatch = item.kind === 'question' ? seenQuestions.has(key) : seenCards.has(key);
    if (item.kind === 'question') seenQuestions.add(key);
    else seenCards.add(key);
    return { ...item, duplicate: existing || repeatedInBatch };
  });
}
