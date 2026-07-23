import { getNotionMetadataCriteriaForTaskText } from './notionTaxonomy.js';

function getTaskSearchText(task = {}) {
  return [
    task.module,
    task.cancer,
    task.topic,
    task.details,
    ...(task.focusTags || []),
    ...(task.goldenTrials || []),
  ].filter(Boolean).join(' ');
}

export function getNotionNewsCriteriaForTask(task = {}) {
  const text = getTaskSearchText(task);
  return getNotionMetadataCriteriaForTaskText(text, task.cancer || task.module);
}

function intersectLabels(source = [], targets = []) {
  const targetSet = new Set((targets || []).map((item) => String(item).toLowerCase()));
  return (source || []).filter((item) => targetSet.has(String(item).toLowerCase()));
}

function intersectTextTerms(source = [], targets = []) {
  const sourceText = (source || []).join(' ').toLowerCase();
  return (targets || []).filter((item) => sourceText.includes(String(item).toLowerCase()));
}

export function scoreNotionNewsItem(item = {}, criteria = {}) {
  const match = {
    cancerTypes: intersectLabels(item.cancerTypes, criteria.cancerTypes),
    tags: intersectLabels(item.tags, criteria.tags),
    treatments: intersectLabels(item.treatments, criteria.treatments),
    drugs: intersectTextTerms(item.drugs, criteria.drugs),
  };
  const rank = [
    match.cancerTypes.length,
    match.tags.length,
    match.treatments.length,
    match.drugs.length,
  ];
  return {
    ...item,
    match: {
      ...match,
      rank,
    },
  };
}

export function rankNotionNewsItems(items = [], criteria = {}) {
  return (items || [])
    .map((item) => scoreNotionNewsItem(item, criteria))
    .sort((a, b) => (
      (b.match?.rank?.[0] || 0) - (a.match?.rank?.[0] || 0)
      || (b.match?.rank?.[1] || 0) - (a.match?.rank?.[1] || 0)
      || (b.match?.rank?.[2] || 0) - (a.match?.rank?.[2] || 0)
      || (b.match?.rank?.[3] || 0) - (a.match?.rank?.[3] || 0)
      || new Date(b.publishedAt || b.createdTime || 0) - new Date(a.publishedAt || a.createdTime || 0)
    ));
}

export function hasCriteriaMatches(item = {}) {
  return (item.match?.rank || []).some((count) => count > 0);
}
