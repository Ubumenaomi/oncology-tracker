import { buildFlashcardTags } from './taxonomy.js';

const KNOWLEDGE_DOMAIN_ALIASES = Object.freeze({
  CNS: 'Other',
  'Melanoma/Sarcoma': 'Other',
});

const TASK_STOP_WORDS = new Set([
  'and',
  'the',
  'with',
  'for',
  'from',
  'what',
  'each',
  'this',
  'that',
]);

function normalizeTextList(value = []) {
  if (Array.isArray(value)) return value.flatMap(normalizeTextList);
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

export function getTaskSearchText(task) {
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

export function getTaskKeywords(task) {
  return [...new Set(getTaskSearchText(task)
    .split(/[^a-z0-9+/-]+/i)
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word.length >= 3 && !TASK_STOP_WORDS.has(word)))];
}

export function getKnowledgeCardCancerDomain(card = {}) {
  const inferredDomain = card.taxonomyTags?.cancerDomain
    || buildFlashcardTags(card).cancerDomain
    || card.cancer
    || '';
  return KNOWLEDGE_DOMAIN_ALIASES[inferredDomain] || inferredDomain;
}

function getKnowledgeCardText(card = {}) {
  return [
    card.id,
    card.cancer,
    card.topic,
    card.type,
    card.front,
    card.back,
    card.cloze,
    ...normalizeTextList(card.trial || card.trials),
    ...normalizeTextList(card.tags),
  ].filter(Boolean).join(' ').toLowerCase();
}

export function knowledgeCardMatchesTask(card, task) {
  if (!card || !task) return false;
  const text = getKnowledgeCardText(card);
  const trialHits = [...(task.goldenTrials || []), ...(task.relatedTrials || [])]
    .filter((trial) => text.includes(String(trial).toLowerCase())).length;
  const focusHits = (task.focusTags || []).filter((tag) => text.includes(String(tag).toLowerCase())).length;
  const keywordHits = getTaskKeywords(task).filter((keyword) => text.includes(keyword)).length;
  const sameCancer = getKnowledgeCardCancerDomain(card) === task.cancer;
  return sameCancer && (trialHits > 0 || focusHits > 0 || keywordHits >= 2);
}
