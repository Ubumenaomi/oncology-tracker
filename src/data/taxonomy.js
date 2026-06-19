export const TAXONOMY_CANCER_TYPE_RULES = [
  ['NSCLC', ['nsclc', 'non-small cell', 'adenocarcinoma', 'squamous cell lung']],
  ['SCLC', ['sclc', 'small cell lung']],
  ['Mesothelioma', ['mesothelioma']],
  ['Thymic malignancy', ['thymic', 'thymoma']],
  ['Salivary gland tumor', ['salivary gland']],
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
  ['Head and neck cancer', ['oropharynx', 'larynx', 'hypopharynx', 'oral cavity', 'buccal', 'hnscc']],
  ['Nasopharyngeal carcinoma', ['nasopharyngeal', 'npc', 'ebv dna']],
  ['Glioma/GBM', ['glioma', 'glioblastoma', 'gbm']],
  ['Brain metastasis', ['brain metastasis', 'leptomeningeal']],
  ['AML', ['acute myeloid', 'aml']],
  ['ALL', ['acute lymphoblastic', 'all']],
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

export const CANCER_DOMAIN_RULES = [
  ['Lung', ['nsclc', 'sclc', 'small cell lung', 'non-small cell', 'lung cancer', 'mesothelioma', 'thymic', 'thymoma']],
  ['Breast', ['breast cancer', 'tnbc', 'her2-positive breast', 'hr+/her2', 'mammography', 'mastectomy']],
  ['GI', ['colorectal', 'colon cancer', 'rectal cancer', 'gastric', 'gastroesophageal', 'gej', 'esophageal', 'pancreatic', 'biliary', 'cholangiocarcinoma', 'hcc', 'hepatocellular', 'gist']],
  ['GU', ['prostate', 'renal cell', 'rcc', 'clear cell', 'urothelial', 'bladder cancer', 'seminoma', 'testicular', 'germ cell']],
  ['GYN', ['ovarian', 'endometrial', 'cervical cancer', 'vulvar']],
  ['Head & Neck', ['head and neck', 'hnscc', 'oropharynx', 'hypopharyngeal', 'larynx', 'oral cavity', 'buccal', 'nasopharyngeal', 'npc', 'salivary gland']],
  ['CNS', ['glioma', 'glioblastoma', 'gbm', 'brain metastasis', 'leptomeningeal']],
  ['Heme', ['aml', 'acute myeloid', 'all', 'acute lymphoblastic', 'cml', 'mds', 'mpn', 'myeloma', 'lymphoma', 'cll']],
  ['Melanoma/Sarcoma', ['melanoma', 'sarcoma', 'gist']],
  ['Supportive/Stats', ['antiemesis', 'fatigue', 'febrile neutropenia', 'thromboembolism', 'vte', 'statistics', 'hazard ratio', 'phase ii', 'phase iii']],
  ['Other', ['ngs', 'tumor agnostic', 'basket', 'companion diagnostic']],
];

export const STAGE_RULES = [
  ['localized', ['localized', 'early-stage', 'stage i', 'stage ii', 'stage iii', 'post-nephrectomy']],
  ['resectable', ['resectable', 'operable', 'surgery']],
  ['borderline resectable', ['borderline resectable']],
  ['unresectable locally advanced', ['unresectable', 'locally advanced', 'definitive ccrt', 'stage iii nsclc', '局部晚期']],
  ['metastatic', ['metastatic', 'advanced', 'stage iv', 'm1', '轉移', '復發']],
  ['relapsed/refractory', ['relapsed', 'refractory', 'salvage', 'progression after', 'post-platinum', 'post-tki', 'post-io', '復發']],
  ['palliative/supportive', ['palliative', 'supportive', 'symptom', 'fatigue', 'antiemesis']],
];

export const CLINICAL_SETTING_RULES = [
  ['diagnosis/staging/risk', ['staging', 'tnm', 'risk group', 'imdc', 'figo', 'bclc', 'iss', 'r-iss', 'eln', 'diagnosis', '分期']],
  ['localized curative intent', ['localized', 'resectable', 'curative', 'surgery', 'margin', 'lymph node dissection', '根治']],
  ['neoadjuvant therapy', ['neoadjuvant', 'preoperative', 'pre-operative', 'induction chemotherapy']],
  ['adjuvant therapy', ['adjuvant', 'postoperative', 'post-operative', 'post-nephrectomy', '術後']],
  ['perioperative therapy', ['perioperative', 'peri-operative', 'flot']],
  ['locally advanced unresectable', ['unresectable', 'definitive ccrt', 'concurrent chemoradiation', 'brachytherapy', '局部晚期']],
  ['metastatic first-line', ['first-line', '1l', '1st line', 'metastatic 1l', '第一線']],
  ['later-line/refractory', ['second-line', '2l', 'third-line', '3l', 'salvage', 'relapsed', 'refractory', 'progression after', 'second-line', '第二線']],
  ['maintenance therapy', ['maintenance']],
  ['toxicity/supportive care', ['toxicity', 'adverse event', 'pneumonitis', 'colitis', 'neuropathy', 'antiemesis', 'fatigue', 'febrile neutropenia', '副作用']],
  ['biomarker/companion diagnostic', ['biomarker', 'companion diagnostic', 'ngs', 'msi', 'dmmr', 'pd-l1', 'her2', 'egfr', 'alk', 'brca', 'mutation']],
];

export const MODALITY_RULES = [
  ['surgery', ['surgery', 'surgical', 'resection', 'nephrectomy', 'mastectomy', '手術']],
  ['radiation therapy', ['radiation', 'radiotherapy', 'rt', 'ccrt', 'brachytherapy', 'pci', '放射']],
  ['chemotherapy', ['chemotherapy', 'chemo', 'folfox', 'folfiri', 'cisplatin', 'carboplatin', 'gemcitabine', 'docetaxel', '化療']],
  ['immunotherapy', ['immunotherapy', 'immune checkpoint', 'ici', 'pd-1', 'pd-l1', 'ctla-4', 'pembrolizumab', 'nivolumab', 'atezolizumab', 'durvalumab', 'ipilimumab']],
  ['targeted therapy', ['targeted', 'tki', 'osimertinib', 'alectinib', 'selpercatinib', 'olaparib', 'parp', 'braf', 'mek', 'fgfr', 'trk inhibitor']],
  ['ADC', ['adc', 'antibody-drug', 'trastuzumab deruxtecan', 't-dxd', 'sacituzumab', 'enfortumab']],
  ['endocrine therapy', ['endocrine', 'hormone therapy', 'aromatase', 'tamoxifen', 'fulvestrant', 'abemaciclib', 'cdk4/6', 'abiraterone', 'enzalutamide']],
  ['cellular/bispecific therapy', ['car-t', 'bispecific', 'tarlatamab', 'crs', 'icans']],
  ['supportive care', ['supportive', 'antiemesis', 'denosumab', 'zoledronic', 'anticoagulation', 'fatigue']],
];

export const GOLDEN_TRIAL_TERMS = [
  'pacific', 'laura', 'adaura', 'keynote-671', 'checkmate 816', 'impower133', 'caspian',
  'keynote-522', 'katherine', 'cleopatra', 'destiny-breast03', 'her2climb',
  'cross', 'checkmate-577', 'flot4', 'keynote-811', 'checkmate-649', 'idea', 'rapido',
  'prodige 23', 'opra', 'beacon', 'prodige 24', 'topaz-1', 'keynote-966', 'imbrave150',
  'himalaya', 'keynote-564', 'checkmate 274', 'ev-302', 'javelin bladder 100',
  'vision', 'ruby', 'keynote-a18', 'keynote-775', 'echelon-1', 'keynote-048',
];

export function normalizeTextList(value) {
  if (Array.isArray(value)) return value.flatMap(normalizeTextList).map((item) => String(item).trim()).filter(Boolean);
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

export function questionSearchText(question = {}) {
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

export function cardSearchText(card = {}) {
  return [
    card.id,
    card.cancer,
    card.topic,
    card.type,
    card.front,
    card.back,
    card.cloze,
    ...(card.trial || card.trials || []),
    ...normalizeTextList(card.tags),
  ].filter(Boolean).join(' ').toLowerCase();
}

export function matchesAny(text, terms = []) {
  return terms.some((term) => text.includes(String(term).toLowerCase()));
}

export function pickRuleLabel(text, rules, fallback = '') {
  return rules.find(([, terms]) => matchesAny(text, terms))?.[0] || fallback;
}

export function inferCancerDomain(text, fallback = 'Other') {
  return pickRuleLabel(text, CANCER_DOMAIN_RULES, fallback || 'Other');
}

export function inferEvidenceType(source, text) {
  const trials = source.trials || source.trial || [];
  if (trials.some((trial) => matchesAny(String(trial).toLowerCase(), GOLDEN_TRIAL_TERMS)) || matchesAny(text, GOLDEN_TRIAL_TERMS)) return 'Golden trial';
  if (trials.length) return 'Recognized trial';
  if (matchesAny(text, ['negative trial', 'did not improve', 'no benefit', 'failed to', 'inferior', 'not superior'])) return 'Negative trial';
  if (matchesAny(text, ['guideline', 'nccn', 'asco', 'esmo', 'category'])) return 'Guideline-only';
  if (pickRuleLabel(text, MODALITY_RULES) === 'supportive care') return 'Toxicity/supportive principle';
  if (matchesAny(text, ['biomarker', 'companion diagnostic', 'msi', 'dmmr', 'pd-l1', 'her2', 'egfr', 'alk', 'brca'])) return 'Biomarker principle';
  return 'Guideline principle';
}

export function inferQuestionType(text) {
  if (matchesAny(text, ['toxicity', 'adverse event', 'pneumonitis', 'colitis', 'neuropathy', 'crs', 'icans', '副作用'])) return 'toxicity';
  if (matchesAny(text, ['biomarker', 'mutation', 'ngs', 'companion diagnostic', 'msi', 'dmmr', 'pd-l1', 'her2', 'egfr', 'alk'])) return 'biomarker';
  if (matchesAny(text, ['sequence', 'after progression', 'post-platinum', 'post-tki', 'second-line', 'salvage'])) return 'sequence';
  if (matchesAny(text, ['except', 'not correct', 'incorrect', 'wrong', '錯誤', '不正確', '最不恰當', '證據最弱'])) return 'exception/wrong statement';
  if (matchesAny(text, ['endpoint', 'os', 'pfs', 'efs', 'dfs', 'orr', 'hazard ratio'])) return 'endpoint recognition';
  return 'standard of care';
}

export function extractBiomarkers(text) {
  return [
    ['EGFR', 'egfr'], ['ALK', 'alk'], ['ROS1', 'ros1'], ['KRAS', 'kras'], ['HER2', 'her2'], ['BRCA/HRD', 'brca', 'hrd'],
    ['MSI/dMMR', 'msi', 'dmmr', 'mismatch repair'], ['PD-L1', 'pd-l1', 'cps', 'tps'], ['FGFR', 'fgfr'], ['NTRK/RET', 'ntrk', 'ret'],
    ['BRAF', 'braf'], ['CLDN18.2', 'cldn18'], ['Nectin-4', 'nectin'], ['PSMA', 'psma'], ['EBV', 'ebv'],
  ].filter(([, ...terms]) => matchesAny(text, terms)).map(([label]) => label);
}

export function makeHashTags(source, taxonomy) {
  const baseTags = [
    taxonomy.cancerType,
    taxonomy.stage,
    taxonomy.clinicalSetting,
    taxonomy.treatmentModality,
    taxonomy.evidenceType,
    taxonomy.questionType,
    ...(source.trials || source.trial || []),
    ...(taxonomy.biomarker || []),
  ];
  return [...new Set(baseTags
    .filter(Boolean)
    .map((tag) => `#${String(tag).replace(/[^a-z0-9]+/gi, '')}`)
    .filter((tag) => tag.length > 1))]
    .slice(0, 8);
}

export function buildQuestionTags(question = {}) {
  const text = questionSearchText(question);
  const biomarker = extractBiomarkers(text);
  const taxonomy = {
    domain: inferCancerDomain(text, question.cancer || 'Other'),
    cancerDomain: inferCancerDomain(text, question.cancer || 'Other'),
    cancerType: pickRuleLabel(text, TAXONOMY_CANCER_TYPE_RULES, question.topic || question.cancer || 'General'),
    stage: pickRuleLabel(text, STAGE_RULES, ''),
    clinicalSetting: pickRuleLabel(text, CLINICAL_SETTING_RULES, question.topic || 'General'),
    treatmentModality: pickRuleLabel(text, MODALITY_RULES, ''),
    biomarker,
    evidenceType: inferEvidenceType(question, text),
    questionType: inferQuestionType(text),
  };
  return {
    ...taxonomy,
    subtopic: question.topic || 'General',
    trial: question.trials || [],
    treatmentLine: taxonomy.clinicalSetting.includes('first-line') ? 'first-line'
      : taxonomy.clinicalSetting.includes('later-line') ? 'later-line'
        : taxonomy.clinicalSetting.includes('adjuvant') ? 'adjuvant'
          : taxonomy.clinicalSetting.includes('neoadjuvant') ? 'neoadjuvant'
            : '',
    endpoint: ['OS', 'PFS', 'EFS', 'DFS', 'iDFS', 'pCR', 'ORR'].filter((endpoint) => text.includes(endpoint.toLowerCase())),
    toxicity: [
      ['ILD/pneumonitis', 'ild', 'pneumonitis'],
      ['neuropathy', 'neuropathy'],
      ['cytopenia', 'neutropenia', 'anemia', 'thrombocytopenia'],
      ['hyperglycemia', 'hyperglycemia'],
      ['hypertension', 'hypertension'],
      ['CRS/ICANS', 'crs', 'icans'],
    ].filter(([, ...terms]) => matchesAny(text, terms)).map(([label]) => label),
    guidelineConcept: question.topic || '',
    hashTags: makeHashTags(question, taxonomy),
    examWeight: question.cancer === 'Lung' ? 5 : ['Breast', 'GI', 'Heme'].includes(question.cancer) ? 4 : ['GU', 'Head & Neck'].includes(question.cancer) ? 3 : 2,
    cardEligible: Boolean(question.explanation || (question.trials || []).length || question.answer),
    raw: Array.isArray(question.tags) ? question.tags : question.tags?.raw || [],
  };
}

export function buildFlashcardTags(card = {}) {
  const text = cardSearchText(card);
  const biomarker = extractBiomarkers(text);
  const taxonomy = {
    domain: inferCancerDomain(text, card.cancer || 'Flashcards'),
    cancerDomain: inferCancerDomain(text, card.cancer || 'Flashcards'),
    cancerType: pickRuleLabel(text, TAXONOMY_CANCER_TYPE_RULES, card.topic || card.cancer || 'Flashcard'),
    stage: pickRuleLabel(text, STAGE_RULES, ''),
    clinicalSetting: pickRuleLabel(text, CLINICAL_SETTING_RULES, card.topic || card.type || 'Flashcard'),
    treatmentModality: pickRuleLabel(text, MODALITY_RULES, ''),
    biomarker,
    evidenceType: inferEvidenceType(card, text),
    questionType: inferQuestionType(text),
  };
  return {
    ...taxonomy,
    subtopic: card.topic || 'Flashcard',
    trial: card.trial || [],
    hashTags: makeHashTags(card, taxonomy),
    raw: normalizeTextList(card.tags),
  };
}

export function tagSearchText(tags = {}) {
  return Object.values(tags)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value) => ['string', 'number'].includes(typeof value))
    .join(' ')
    .toLowerCase();
}
