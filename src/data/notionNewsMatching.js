const CANCER_TYPE_ALIASES = {
  Lung: ['lung cancer'],
  Breast: ['breast cancer', 'breast'],
  GI: ['colon cancer', 'Gastric cancer', 'esophageal cancer', 'HCC', 'cholangiocarcinoma', 'biliary tract', 'pancreatic cancer', 'small bowel'],
  GU: ['GU', 'prostatic cancer'],
  GYN: ['GYN', 'endometrial adenocarcinoma'],
  'Head & Neck': ['Head and neck', 'NPC'],
  Heme: ['AML', 'hodgkin Lymphoma'],
  'Rare/Skin/Sarcoma/CUP/Other': ['rare cancer', 'soft tissue', 'GIST', 'thymoma', 'melanoma', 'adenoid cystic carcinoma', 'adrenal gland carcinoma', 'CNS'],
  'Supportive/Emergency/Stats': ['drug toxicity'],
};

const DRUG_TERMS = [
  'pembrolizumab',
  'nivolumab',
  'ipilimumab',
  'atezolizumab',
  'durvalumab',
  'cemiplimab',
  'dostarlimab',
  'avelumab',
  'osimertinib',
  'gefitinib',
  'erlotinib',
  'alectinib',
  'brigatinib',
  'lorlatinib',
  'sotorasib',
  'adagrasib',
  'trastuzumab',
  'trastuzumab deruxtecan',
  'sacituzumab',
  'enfortumab',
  'capecitabine',
  'gemcitabine',
  'cisplatin',
  'carboplatin',
  'paclitaxel',
  'docetaxel',
  'pemetrexed',
  'bevacizumab',
  'cetuximab',
  'panitumumab',
  'lenvatinib',
  'cabozantinib',
  'sunitinib',
  'olaparib',
  'talazoparib',
  'abemaciclib',
  'ribociclib',
  'palbociclib',
  'ponatinib',
  'imatinib',
  'dasatinib',
  'nilotinib',
  'bosutinib',
  'asciminib',
  'ivosidenib',
];

function unique(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const value = String(item || '').trim();
    if (!value) return false;
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function includesAny(text, terms = []) {
  const normalized = String(text || '').toLowerCase();
  return terms.some((term) => normalized.includes(String(term).toLowerCase()));
}

function normalizeList(items = []) {
  return unique((items || []).flatMap((item) => {
    if (Array.isArray(item)) return item;
    return String(item || '').split(',').map((part) => part.trim());
  }));
}

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
  const lower = text.toLowerCase();
  const cancerTypes = [...(CANCER_TYPE_ALIASES[task.cancer] || CANCER_TYPE_ALIASES[task.module] || [])];
  const tags = [];
  const treatments = [];

  if (includesAny(lower, ['perioperative', 'neoadjuvant', 'adjuvant', 'resectable', 'stage i', 'stage ii', 'stage iii', 'postop', 'post-op'])) {
    tags.push('Early stage');
  }
  if (includesAny(lower, ['metastatic', 'advance', 'advanced', 'second line', 'later-line', 'maintenance', 'progression'])) {
    tags.push('advance and meta');
  }
  if (includesAny(lower, ['unresectable', 'locally advanced', 'ccrt', 'definitive ccrt', 'induction'])) {
    tags.push('Locally advance');
  }
  if (includesAny(lower, ['toxicity', 'irae', 'pneumonitis', 'myocarditis', 'nephritis', 'endocrinopathy', 'supportive'])) {
    tags.push('Supportive care');
  }
  if (includesAny(lower, ['algorithm', 'foundation', 'biomarker', 'basic'])) {
    tags.push('Basic');
  }
  if (includesAny(lower, ['case', 'eligibility', 'population'])) {
    tags.push('case');
  }

  if (includesAny(lower, ['perioperative'])) treatments.push('perioperative', 'neoadjuvant', 'adjuvant');
  if (includesAny(lower, ['neoadjuvant', 'preop', 'pre-op'])) treatments.push('neoadjuvant');
  if (includesAny(lower, ['adjuvant', 'postop', 'post-op'])) treatments.push('adjuvant');
  if (includesAny(lower, ['induction'])) treatments.push('Induction');
  if (includesAny(lower, ['first line', 'frontline', '1l', 'first-line'])) treatments.push('first line');
  if (includesAny(lower, ['second line', '2l', 'later-line', 'salvage'])) treatments.push('second line');
  if (includesAny(lower, ['adjuvant ccrt'])) treatments.push('adjuvant CCRT');

  const drugs = DRUG_TERMS.filter((drug) => lower.includes(drug.toLowerCase()));

  return {
    cancerTypes: unique(cancerTypes),
    tags: unique(tags),
    treatments: unique(treatments),
    drugs: unique(drugs),
  };
}

export function getCriteriaFromSearchParams(searchParams) {
  const criteriaParam = searchParams.get('criteria');
  if (criteriaParam) {
    try {
      const parsed = JSON.parse(criteriaParam);
      return {
        cancerTypes: normalizeList(parsed.cancerTypes),
        tags: normalizeList(parsed.tags),
        treatments: normalizeList(parsed.treatments),
        drugs: normalizeList(parsed.drugs),
      };
    } catch {
      return { cancerTypes: [], tags: [], treatments: [], drugs: [] };
    }
  }
  return {
    cancerTypes: normalizeList(searchParams.get('cancerTypes') || ''),
    tags: normalizeList(searchParams.get('tags') || ''),
    treatments: normalizeList(searchParams.get('treatments') || ''),
    drugs: normalizeList(searchParams.get('drugs') || ''),
  };
}

export function buildNotionNewsQuery(task, criteria = getNotionNewsCriteriaForTask(task)) {
  const params = new URLSearchParams();
  if (task?.id) params.set('day', String(task.id));
  params.set('criteria', JSON.stringify(criteria));
  return `/api/notion-news?${params.toString()}`;
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
