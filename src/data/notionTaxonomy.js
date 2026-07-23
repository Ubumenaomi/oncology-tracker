const CANCER_DOMAIN_DEFINITIONS = Object.freeze([
  {
    trackerDomain: 'Lung',
    planAliases: ['Lung'],
    notionValues: ['lung cancer', 'mesothelioma', 'methothelioma'],
  },
  {
    trackerDomain: 'Breast',
    planAliases: ['Breast'],
    notionValues: ['breast cancer', 'breast'],
  },
  {
    trackerDomain: 'GI',
    planAliases: ['GI'],
    notionValues: ['colon cancer', 'gastric cancer', 'esophageal cancer', 'HCC', 'cholangiocarcinoma', 'biliary tract', 'pancreatic cancer', 'small bowel'],
  },
  {
    trackerDomain: 'GU',
    planAliases: ['GU'],
    notionValues: ['GU', 'prostatic cancer'],
  },
  {
    trackerDomain: 'GYN',
    planAliases: ['GYN'],
    notionValues: ['GYN', 'endometrial adenocarcinoma'],
  },
  {
    trackerDomain: 'Head & Neck',
    planAliases: ['Head & Neck'],
    notionValues: ['Head and neck', 'NPC'],
  },
  {
    trackerDomain: 'Heme',
    planAliases: ['Heme'],
    notionValues: ['AML', 'hodgkin Lymphoma'],
  },
  {
    trackerDomain: 'Other',
    planAliases: ['Other', 'Rare/Skin/Sarcoma/CUP/Other'],
    notionValues: ['rare cancer', 'soft tissue', 'GIST', 'thymoma', 'melanoma', 'adenoid cystic carcinoma', 'adrenal gland carcinoma', 'CNS'],
  },
  {
    trackerDomain: 'Supportive/Stats',
    planAliases: ['Supportive/Stats', 'Supportive/Emergency/Stats'],
    notionValues: ['drug toxicity'],
  },
]);

const NOTION_TAG_RULES = Object.freeze([
  { value: 'Early stage', keywords: ['perioperative', 'neoadjuvant', 'adjuvant', 'resectable', 'stage i', 'stage ii', 'stage iii', 'postop', 'post-op'] },
  { value: 'advance and meta', keywords: ['metastatic', 'advance', 'advanced', 'second line', 'later-line', 'maintenance', 'progression'] },
  { value: 'Locally advance', keywords: ['unresectable', 'locally advanced', 'ccrt', 'definitive ccrt', 'induction'] },
  { value: 'Supportive care', keywords: ['toxicity', 'irae', 'pneumonitis', 'myocarditis', 'nephritis', 'endocrinopathy', 'supportive'] },
  { value: 'Basic', keywords: ['algorithm', 'foundation', 'biomarker', 'basic'] },
  { value: 'case', keywords: ['case', 'eligibility', 'population'] },
]);

const NOTION_TREATMENT_RULES = Object.freeze([
  { value: 'perioperative', keywords: ['perioperative'] },
  { value: 'neoadjuvant', keywords: ['perioperative', 'neoadjuvant', 'preop', 'pre-op'] },
  { value: 'adjuvant', keywords: ['perioperative', 'adjuvant', 'postop', 'post-op'] },
  { value: 'Induction', keywords: ['induction'] },
  { value: 'first line', keywords: ['first line', 'frontline', '1l', 'first-line'] },
  { value: 'second line', keywords: ['second line', '2l', 'later-line', 'salvage'] },
  { value: 'adjuvant CCRT', keywords: ['adjuvant ccrt'] },
]);

export const NOTION_DRUG_TERMS = Object.freeze([
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
]);

function unique(items = []) {
  const values = new Map();
  (items || []).forEach((item) => {
    const value = String(item || '').trim();
    if (value) values.set(value.toLowerCase(), value);
  });
  return [...values.values()];
}

function includesKeyword(text, keyword) {
  const normalizedText = String(text || '').toLowerCase();
  const normalizedKeyword = String(keyword || '').toLowerCase();
  if (!normalizedKeyword) return false;
  if (/^[a-z0-9]+$/i.test(normalizedKeyword)) {
    const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(normalizedText);
  }
  return normalizedText.includes(normalizedKeyword);
}

function valuesFromRules(text, rules) {
  return rules
    .filter((rule) => rule.keywords.some((keyword) => includesKeyword(text, keyword)))
    .map((rule) => rule.value);
}

export function getNotionCancerTypesForTrackerDomain(domain = '') {
  const normalized = String(domain || '').trim().toLowerCase();
  const definition = CANCER_DOMAIN_DEFINITIONS.find((item) => (
    item.trackerDomain.toLowerCase() === normalized
    || item.planAliases.some((alias) => alias.toLowerCase() === normalized)
  ));
  return definition ? [...definition.notionValues] : [];
}

export function mapNotionCancerToTrackerDomain(cancerTypes = []) {
  const values = new Set(unique(cancerTypes).map((value) => value.toLowerCase()));
  const definition = CANCER_DOMAIN_DEFINITIONS.find((item) => (
    item.notionValues.some((value) => values.has(value.toLowerCase()))
  ));
  return definition?.trackerDomain || '';
}

export function getNotionMetadataCriteriaForTaskText(text = '', domain = '') {
  const normalizedText = String(text || '').toLowerCase();
  return {
    cancerTypes: getNotionCancerTypesForTrackerDomain(domain),
    tags: unique(valuesFromRules(normalizedText, NOTION_TAG_RULES)),
    treatments: unique(valuesFromRules(normalizedText, NOTION_TREATMENT_RULES)),
    drugs: unique(NOTION_DRUG_TERMS.filter((drug) => includesKeyword(normalizedText, drug))),
  };
}

export function slugifyNotionTaxonomyValue(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\+/g, '-positive')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildNotionLearningTags(note = {}, trials = []) {
  const makeTags = (prefix, values) => unique(values).map((value) => `${prefix}/${slugifyNotionTaxonomyValue(value)}`);
  return unique([
    'source/notion',
    ...makeTags('disease', note.cancerTypes),
    ...makeTags('subtype', note.subtypes),
    ...makeTags('biomarker', note.genes),
    ...makeTags('setting', note.treatments),
    ...makeTags('drug', note.drugs),
    ...makeTags('trial', trials),
    ...makeTags('topic', note.tags),
  ].filter((tag) => !tag.endsWith('/')));
}

export const NOTION_CANCER_DOMAINS = Object.freeze(
  CANCER_DOMAIN_DEFINITIONS.map(({ trackerDomain }) => trackerDomain),
);
