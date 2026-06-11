import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import './App.css';
import { questionBank, cancerCategories } from './data/questionBank.js';
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

const FLASHCARD_RATINGS = {
  Again: { interval: 1, masteryDelta: -1 },
  Hard: { interval: 3, masteryDelta: 0 },
  Good: { interval: 7, masteryDelta: 1 },
  Easy: { interval: 21, masteryDelta: 2 },
};

const XP_RULES = {
  dailyComplete: 30,
  planTask: 50,
  wrongAgainRecovery: 80,
  highConfidenceWrongCorrected: 120,
  cancerBoss: 150,
  fullMock75: 300,
  wrongRetest90: 300,
};

const TODAY = (() => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
})();


const defaultState = {
  sessions: {},
  stats: {},
  settings: {
    dailyCount: 12,
    preferredYears: [112, 113, 114],
    preferredCancers: [],
  },
  planProgress: {},
  questionOverrides: {},
  mockExams: [],
  cloudMeta: {
    updatedAt: null,
    device: null,
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

const weaknessPlanTasks = Array.from({ length: 15 }, (_, index) => ({
  id: 76 + index,
  day: `Day ${76 + index}`,
  phase: 'Phase 4: Weakness repair only',
  module: 'Weakness Repair',
  cancer: 'Weakness Repair',
  topic: [
    'High-confidence wrong repair',
    'Wrong-rate >=50% Lung/Breast/GI',
    'Mastery <=2 trial endpoints',
    'Critical Error Queue pass 1',
    'Biomarker cutoff repair',
    'ADC and toxicity repair',
    'Heme/GU/GYN repair',
    'Head & Neck/Rare repair',
    'Statistics and trial interpretation repair',
    'Algorithm blank recall',
    'Previously wrong retest A',
    'Previously wrong retest B',
    'Red topic mini mocks',
    'Boss rematch day',
    'Readiness audit before retest cycle',
  ][index],
  details: 'Only study questions/topics matching wrongRate >=50%, mastery <=2, high-confidence wrong, repeated wrong, or failed boss categories.',
  goldenTrials: ['Weakness Review'],
  focusTags: ['wrongRate >=50', 'mastery <=2', 'high-confidence wrong', 'repeated wrong'],
  requiredQuestionIds: [],
  bossUnlockContribution: 'Final Board Boss',
  priority: 'High',
}));

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
        requiredQuestionIds: [],
        bossUnlockContribution: module.bossUnlockContribution,
        priority: focusTags.includes('boss') || focusTags.includes('weakness repair') ? 'High' : 'High',
      });
    });
  });

  const withWeakness = [...tasks.slice(0, 75), ...weaknessPlanTasks];
  mockPlanTasks.forEach(([phase, module, cancer, topic, details, goldenTrials, focusTags, bossUnlockContribution], index) => {
    const id = index < 10 ? 66 + index : 91 + (index - 10);
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
      requiredQuestionIds: [],
      bossUnlockContribution,
      priority: 'High',
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

function mergeCloudState(localState, cloudState) {
  if (!cloudState) return normalizeState({ ...defaultState, ...localState });

  return normalizeState({
    ...defaultState,
    ...cloudState,
    ...localState,
    sessions: {
      ...(cloudState.sessions || {}),
      ...(localState.sessions || {}),
    },
    stats: {
      ...(cloudState.stats || {}),
      ...(localState.stats || {}),
    },
    settings: {
      ...defaultState.settings,
      ...(cloudState.settings || {}),
      ...(localState.settings || {}),
    },
    planProgress: {
      ...(cloudState.planProgress || {}),
      ...(localState.planProgress || {}),
    },
    questionOverrides: {
      ...(cloudState.questionOverrides || {}),
      ...(localState.questionOverrides || {}),
    },
    mockExams: [
      ...(cloudState.mockExams || []),
      ...(localState.mockExams || []),
    ].filter((exam, index, exams) => exam?.id && exams.findIndex((x) => x.id === exam.id) === index),
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
  return date.toISOString().slice(0, 10);
}

function normalizeState(state) {
  return {
    ...defaultState,
    ...state,
    settings: {
      ...defaultState.settings,
      ...(state?.settings || {}),
    },
    flashcards: state?.flashcards || [],
    game: {
      ...defaultState.game,
      ...(state?.game || {}),
      badges: state?.game?.badges || [],
      unlockedBosses: state?.game?.unlockedBosses || [],
      defeatedBosses: state?.game?.defeatedBosses || [],
      xpEvents: state?.game?.xpEvents || [],
      dailyClaims: state?.game?.dailyClaims || {},
    },
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

function makeQuestionTags(question) {
  const text = `${question.stem || ''} ${question.topic || ''} ${(question.trials || []).join(' ')}`.toLowerCase();
  const includesAny = (items) => items.some((item) => text.includes(item.toLowerCase()));
  return {
    domain: question.cancer,
    subtopic: question.topic || 'General',
    trial: question.trials || [],
    biomarker: [
      ['EGFR', 'egfr'], ['ALK', 'alk'], ['KRAS', 'kras'], ['HER2', 'her2'], ['BRCA/HRD', 'brca', 'hrd'],
      ['MSI/dMMR', 'msi', 'dmmr'], ['PD-L1', 'pd-l1', 'cps', 'tps'], ['FGFR', 'fgfr'], ['NTRK/RET', 'ntrk', 'ret'],
    ].filter(([, ...terms]) => includesAny(terms)).map(([label]) => label),
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
    examWeight: question.cancer === 'Lung' ? 5 : ['Breast', 'GI', 'Heme'].includes(question.cancer) ? 4 : ['GU', 'Head & Neck'].includes(question.cancer) ? 3 : 2,
    cardEligible: Boolean(question.explanation || (question.trials || []).length || question.answer),
  };
}

function findQuestionById(id) {
  return questionBank.find((q) => q.id === id);
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
  const original = findQuestionById(id);
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

function generateDailyQuestionIds(state) {
  const { dailyCount, preferredYears, preferredCancers } = state.settings;

  const pool = questionBank
    .map((q) => getQuestionWithOverride(q.id, state))
    .filter(Boolean)
    .filter((q) => {
      const yearOk = !preferredYears || preferredYears.length === 0 || preferredYears.includes(Number(q.year));
      const cancerOk = !preferredCancers || preferredCancers.length === 0 || preferredCancers.includes(q.cancer);
      return yearOk && cancerOk;
    });

  const withStats = pool.map((q) => ({ q, stat: getStat(state, q.id) }));

  const due = withStats.filter(({ stat }) => stat.nextReviewDate && stat.nextReviewDate <= TODAY);
  const highWrong = withStats.filter(({ stat }) => stat.wrong > 0 && wrongRate(stat) >= 50);
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

  const used = new Set();
  const result = [];

  const readiness = getReadinessMetrics(state);
  let dueRatio = 0.4;
  let wrongRatio = 0.3;
  let newRatio = 0.2;
  let bookmarkRatio = 0.1;

  if (readiness.predictedScore < 70) {
    dueRatio = 0.2;
    wrongRatio = 0.3;
    newRatio = 0.5;
    bookmarkRatio = 0;
  } else if (readiness.predictedScore >= 70 && readiness.predictedScore < 80) {
    dueRatio = 0.35;
    wrongRatio = 0.3;
    newRatio = 0.25;
    bookmarkRatio = 0.1;
  } else if (readiness.predictedScore >= 80) {
    dueRatio = 0.3;
    wrongRatio = 0.4;
    newRatio = 0.2;
    bookmarkRatio = 0.1;
  }

  const dueCount = Math.ceil(dailyCount * dueRatio);
  const wrongCount = Math.ceil(dailyCount * wrongRatio);
  const newCount = Math.ceil(dailyCount * newRatio);
  const bookmarkCount = Math.max(0, dailyCount - dueCount - wrongCount - newCount, Math.floor(dailyCount * bookmarkRatio));

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
  const trialCards = (state.flashcards || []).filter((card) => card.sourceType === 'trial').length;
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
      unlocked = [112, 113, 114].every((year) => completedYears.has(year));
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

function getCancerSummary(state) {
  return cancerCategories.map((cancer) => {
    const ids = questionBank
      .map((q) => getQuestionWithOverride(q.id, state))
      .filter((q) => q?.cancer === cancer)
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
  questionBank
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

function getCriticalErrorItems(state) {
  return questionBank
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
  const weak = questionBank
    .map((q) => ({ q: getQuestionWithOverride(q.id, state), stat: getStat(state, q.id) }))
    .filter(({ q, stat }) => q && (stat.wrong > 0 || stat.bookmarked))
    .sort((a, b) => wrongRate(b.stat) - wrongRate(a.stat) || b.stat.wrong - a.stat.wrong)
    .slice(0, 15);

  return `你是一位 hematology-oncology board exam coach。請根據以下腫瘤內科專科醫師考題練習紀錄，幫我做 AI review。\n\n要求輸出：\n1. 弱點總結\n2. 高錯誤率癌別與 trial\n3. 每個弱點的補救讀書任務\n4. 10 題 fellow-level MCQ 題目\n5. 3 題 oral board style question\n6. 明天應該優先複習的題目與主題\n\n我的錯題/標記題：\n${weak.map(({ q, stat }) => `- ${q.id} | ${q.cancer} | ${q.topic} | wrong rate ${wrongRate(stat)}% | attempts ${stat.attempts} | trials: ${(q.trials || []).join(', ') || 'none'} | note: ${stat.wrongNotes || 'none'} | stem: ${q.stem}`).join('\n')}`;
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


function QuestionCard({ question, stat, onUpdateStat, compact = false, hideAnswerUntilSubmit = false, practiceMode = false, practiceDraft = null, onPracticeChange = null, onEdit, onCreateFlashcard }) {
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

    setFeedback('');
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
  }, [selected, revealed, correctAnswer, explanation, wrongNotes, confidence, errorType, practiceMode]);

  const answerIsSingleChoice = /^[A-E]$/.test(String(correctAnswer || '').trim().toUpperCase());
  const isCorrectSelection = selected && answerIsSingleChoice && selected === String(correctAnswer).trim().toUpperCase();

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
    const answerEvent = {
      date: TODAY,
      mode: practiceMode ? 'daily' : 'review',
      selected: selected || null,
      correctAnswer: correctAnswer || previous.correctAnswer || question.answer || null,
      isCorrect,
      confidence: normalizedConfidence,
      rating,
      errorType: isCorrect ? '' : errorType,
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
    });

    setFeedback(`紀錄：${rating}，下次複習 ${interval} 天後`);

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

  const createFlashcard = () => {
    onCreateFlashcard?.(question, { ...stat, correctAnswer, explanation, wrongNotes });
    setFeedback('已生成抽認卡。');
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
        </div>
        <div className="question-actions">
            {onEdit && <button className="secondary" onClick={() => onEdit(question.id)}>編輯題目</button>}
            {question.notionUrl && (
              <button className="secondary" onClick={() => window.open(question.notionUrl, '_blank')}>Notion 詳解</button>
            )}
            {onCreateFlashcard && <button className="secondary" onClick={createFlashcard}>生成抽認卡</button>}
            <button className={stat.bookmarked ? 'bookmark active' : 'bookmark'} onClick={toggleBookmark}>
              {stat.bookmarked ? '★ 已標記' : '☆ 標記'}
            </button>
        </div>
      </div>

      <p className="stem">{question.stem}</p>

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
              </div>

              <div className="textareas">
                <label>
                  詳解 / guideline / trial note
                  <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="例如：KEYNOTE-671 為 perioperative pembrolizumab + platinum-doublet chemotherapy，primary endpoint 為 EFS 與 OS..." />
                </label>
                <label>
                  錯誤原因 / 弱點標籤
                  <textarea value={wrongNotes} onChange={(e) => setWrongNotes(e.target.value)} placeholder="例如：忘記 eligibility、HR、primary endpoint、biomarker cutoff、toxicity..." />
                </label>
              </div>

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
            <option value="112">112</option>
            <option value="113">113</option>
            <option value="114">114</option>
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
          <option>112</option>
          <option>113</option>
          <option>114</option>
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
function MockExamPanel({ state, onFinishMock }) {
  const [questionCount, setQuestionCount] = useState(80);
  const [timerMinutes, setTimerMinutes] = useState(120);
  const [exam, setExam] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  const startMock = () => {
    const pool = shuffleStable(questionBank.map((q) => getQuestionWithOverride(q.id, state)).filter(Boolean));
    const selected = pool.slice(0, Number(questionCount));
    setExam({ id: `mock-${Date.now()}`, questions: selected });
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
      mode: 'mixed-mock',
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
          <p className="muted">全癌別混合、隨機排序、結束後才顯示分數；每題記錄 confidence，供 Readiness Score 使用。</p>
        </div>
        <div className="inline-actions">
          <label>題數
            <select value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))}>
              {[50, 80, 120].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label>Timer
            <select value={timerMinutes} onChange={(e) => setTimerMinutes(Number(e.target.value))}>
              {[60, 90, 120, 180].map((n) => <option key={n} value={n}>{n} min</option>)}
            </select>
          </label>
          <button className="primary" onClick={startMock}>Start mixed mock</button>
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
  const [tab, setTab] = useState('readiness');
  const [search, setSearch] = useState('');
  const [bankCancer, setBankCancer] = useState('All');
  const [bankYear, setBankYear] = useState('All');
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState('尚未登入，資料目前只存在這台裝置。');
  const [syncError, setSyncError] = useState('');
  const [isApplyingCloudState, setIsApplyingCloudState] = useState(false);

  useEffect(() => {
    saveState(state);
  }, [state]);

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

  const createFlashcardFromQuestion = (question, stat) => {
    const card = buildQuickCardFromQuestion(question, stat);
    updateState((prev) => ({
      ...prev,
      flashcards: [card, ...(prev.flashcards || [])],
    }));
  };

  const createTrialCard = (trialName, sourceQuestion = null) => {
    if (!trialName.trim()) return;
    const card = buildTrialCardFromName(trialName.trim(), sourceQuestion);
    updateState((prev) => ({
      ...prev,
      flashcards: [card, ...(prev.flashcards || [])],
    }));
  };

  const reviewFlashcard = (cardId, rating) => {
    updateState((prev) => ({
      ...prev,
      flashcards: (prev.flashcards || []).map((card) => {
        if (card.id !== cardId) return card;
        const rule = FLASHCARD_RATINGS[rating] || FLASHCARD_RATINGS.Good;
        return {
          ...card,
          intervalDays: rule.interval,
          nextReviewDate: addDays(TODAY, rule.interval),
          mastery: Math.max(0, Math.min(5, (card.mastery || 0) + rule.masteryDelta)),
          difficulty: rating === 'Again' ? Math.min(5, (card.difficulty || 3) + 0.5) : card.difficulty || 3,
          updatedAt: new Date().toISOString(),
          lastRating: rating,
        };
      }),
    }));
  };

  const generateWeakFlashcards = () => {
    updateState((prev) => {
      const existingSources = new Set((prev.flashcards || []).map((card) => `${card.sourceType}:${card.sourceId}`));
      const cards = questionBank
        .map((q) => ({ q: getQuestionWithOverride(q.id, prev), stat: getStat(prev, q.id) }))
        .filter(({ q, stat }) => q && (stat.wrong > 0 || stat.bookmarked || (stat.highConfidenceWrong || 0) > 0 || (stat.mastery || 0) <= 2))
        .filter(({ q }) => !existingSources.has(`question:${q.id}`))
        .slice(0, 30)
        .map(({ q, stat }) => buildQuickCardFromQuestion(q, stat));
      return { ...prev, flashcards: [...cards, ...(prev.flashcards || [])] };
    });
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
  const todayIds = todaySession?.questionIds || [];
  const todayQuestions = todayIds.map((id) => getQuestionWithOverride(id, state)).filter(Boolean);
  const todayCompleted = todayIds.length > 0 && todayIds.every((id) => todaySession?.practiceDrafts?.[id]?.rated);

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
  }, [TODAY]);

  const createTodaySession = () => {
    const ids = generateDailyQuestionIds(state);
    updateState((prev) => ({
      ...prev,
      sessions: {
        ...prev.sessions,
        [TODAY]: { date: TODAY, questionIds: ids, createdAt: new Date().toISOString(), completed: false, practiceDrafts: {} },
      },
    }));
    setTab('today');
  };

  const claimDailyCompletion = () => {
    if (!todayCompleted || state.game?.dailyClaims?.[TODAY]) return;
    updateState((prev) => ({
      ...prev,
      sessions: {
        ...(prev.sessions || {}),
        [TODAY]: { ...(prev.sessions?.[TODAY] || {}), completed: true },
      },
      game: {
        ...awardXp(prev.game || defaultState.game, XP_RULES.dailyComplete, 'Daily 10-15 questions completed', { date: TODAY }),
        streak: (prev.game?.streak || 0) + 1,
        dailyClaims: { ...(prev.game?.dailyClaims || {}), [TODAY]: true },
      },
    }));
  };

  const regenerateTodaySession = () => {
    if (!window.confirm('重新抽題會覆蓋今天的題目清單，但不會刪除作答紀錄。確定？')) return;
    createTodaySession();
  };

  const dueReview = useMemo(() => questionBank
    .map((q) => ({ q: getQuestionWithOverride(q.id, state), stat: getStat(state, q.id) }))
    .filter(({ q, stat }) => q && stat.nextReviewDate && stat.nextReviewDate <= TODAY)
    .sort((a, b) => wrongRate(b.stat) - wrongRate(a.stat)), [state]);

  const weakQuestions = useMemo(() => questionBank
    .map((q) => ({ q: getQuestionWithOverride(q.id, state), stat: getStat(state, q.id) }))
    .filter(({ q, stat }) => q && (stat.wrong > 0 || stat.bookmarked))
    .sort((a, b) => wrongRate(b.stat) - wrongRate(a.stat) || b.stat.wrong - a.stat.wrong), [state]);

  const summary = useMemo(() => {
    const stats = Object.values(state.stats);
    const attempts = stats.reduce((s, x) => s + (x.attempts || 0), 0);
    const correct = stats.reduce((s, x) => s + (x.correct || 0), 0);
    const wrong = stats.reduce((s, x) => s + (x.wrong || 0), 0);
    const reviewed = Object.keys(state.stats).filter((id) => state.stats[id]?.attempts > 0).length;
    return { attempts, correct, wrong, reviewed, accuracy: attempts ? Math.round((correct / attempts) * 100) : 0 };
  }, [state]);

  const cancerSummary = useMemo(() => getCancerSummary(state), [state]);
  const readiness = useMemo(() => getReadinessMetrics(state), [state]);

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

  const planProgress = state.planProgress || {};

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

  const togglePlanTask = (id) => {
    updateState((prev) => {
      const wasDone = Boolean(prev.planProgress?.[id]);
      const nextState = {
        ...prev,
        game: wasDone ? prev.game : awardXp(prev.game || defaultState.game, XP_RULES.planTask, '100-Day task completed', { taskId: id }),
        planProgress: {
          ...(prev.planProgress || {}),
          [id]: !wasDone,
        },
      };
      return syncBossGameState(nextState);
    });
  };

  const setPlanCancerCompleted = (cancer, completed) => {
    updateState((prev) => {
      const next = { ...(prev.planProgress || {}) };
      studyPlan100.filter((task) => task.cancer === cancer).forEach((task) => {
        next[task.id] = completed;
      });
      return syncBossGameState({ ...prev, planProgress: next });
    });
  };

  const resetPlanProgress = () => {
    if (!window.confirm('確定要清除 100-Day Plan 的所有 checklist 完成狀態？')) return;
    updateState((prev) => ({ ...prev, planProgress: {} }));
  };


  const bankQuestions = useMemo(() => questionBank
    .map((q) => getQuestionWithOverride(q.id, state))
    .filter(Boolean)
    .filter((q) => {
      const text = `${q.id} ${q.stem} ${Object.values(q.options || {}).join(' ')} ${(q.trials || []).join(' ')}`.toLowerCase();
      const searchOk = !search || text.includes(search.toLowerCase());
      const cancerOk = bankCancer === 'All' || q.cancer === bankCancer;
      const yearOk = bankYear === 'All' || String(q.year) === String(bankYear);
      return searchOk && cancerOk && yearOk;
    })
    .slice(0, 80), [search, bankCancer, bankYear, state.questionOverrides]);

  const updateSettings = (patch) => {
    updateState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
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
        setState({ ...defaultState, ...data });
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
          <p>112–114 腫專考古題、mixed mock、confidence calibration、critical error queue、≥80 分預測。</p>
        </div>
        <div className="header-actions">
          <button className="primary" onClick={createTodaySession}>產生今日 10–15 題</button>
          <button className="secondary" onClick={() => setAiPromptOpen(!aiPromptOpen)}>AI Review Prompt</button>
        </div>
      </header>

      <section className="metrics-grid">
        <MetricCard label="題庫總數" value={questionBank.length} sub="112–114 年" />
        <MetricCard label="已練題目" value={summary.reviewed} sub={`${summary.attempts} total attempts`} />
        <MetricCard label="正確率" value={`${summary.accuracy}%`} sub={`${summary.correct} correct / ${summary.wrong} wrong`} />
        <MetricCard label="今日待複習" value={dueReview.length} sub="依 next review date" />
        <MetricCard label="≥80 機率" value={`${readiness.probability80}%`} sub={readiness.readinessLevel} />
        <MetricCard label="同步狀態" value={user ? 'Cloud' : 'Local'} sub={user ? user.email : '尚未登入'} />
      </section>

      {aiPromptOpen && (
        <section className="panel">
          <div className="panel-title">AI Review Prompt</div>
          <p className="muted">複製到 ChatGPT / OpenAI API，即可根據錯題產生弱點分析、MCQ、oral board 題。</p>
          <textarea className="prompt-box" readOnly value={buildAiPrompt(state)} />
        </section>
      )}

      <nav className="tabs">
        {[['readiness', 'Board Readiness'], ['mock', 'Mock Exam'], ['critical', 'Critical Errors'], ['today', 'Daily Practice'], ['review', 'Review Queue'], ['bank', 'Question Bank'], ['manual', 'Manual Add'], ['question-edit', 'Question Edit'], ['analytics', 'Analytics'], ['plan', '100-Day Plan'], ['sync', 'Cloud Sync'], ['settings', 'Settings']].map(([key, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>
        ))}
      </nav>

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

      {tab === 'today' && (
        <main className="panel">
          <div className="section-head">
            <div>
              <h2>今日練習：{TODAY}</h2>
              <p className="muted">每日建議 10–15 題。系統會優先抽「到期複習題 + 高錯誤率題 + 新題」。</p>
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
              <p>按下「產生今日 10–15 題」開始。若你已有大量錯題，系統會自動提高錯題複習比例。</p>
              <button className="primary" onClick={createTodaySession}>產生今日題目</button>
            </div>
          ) : (
            <div className="question-list">
              {todayQuestions.map((q) => (
                <QuestionCard
                  key={`${todaySession?.createdAt || TODAY}-${q.id}`}
                  question={q}
                  stat={getStat(state, q.id)}
                  onUpdateStat={updateStat}
                  hideAnswerUntilSubmit
                  practiceMode
                  practiceDraft={todaySession?.practiceDrafts?.[q.id]}
                  onPracticeChange={(patch) => updatePracticeDraft(q.id, patch)}
                  onCreateFlashcard={createFlashcardFromQuestion}
                />
              ))}
            </div>
          )}
        </main>
      )}

      {tab === 'review' && (
        <main className="panel">
          <h2>Review Queue</h2>
          <p className="muted">優先順序：今日到期 → 錯誤率 ≥50% → 已標記題目 → 未練新題。</p>
          <div className="subsection">
            <h3>今日到期複習</h3>
            {dueReview.length === 0 ? <p className="muted">目前沒有到期題目。</p> : dueReview.slice(0, 30).map(({ q, stat }) => (
              <QuestionCard key={q.id} question={q} stat={stat} onUpdateStat={updateStat} compact onCreateFlashcard={createFlashcardFromQuestion} />
            ))}
          </div>
          <div className="subsection">
            <h3>高錯誤率 / 標記題</h3>
            {weakQuestions.slice(0, 30).map(({ q, stat }) => (
              <QuestionCard key={q.id} question={q} stat={stat} onUpdateStat={updateStat} compact onCreateFlashcard={createFlashcardFromQuestion} />
            ))}
          </div>
        </main>
      )}

      {tab === 'bank' && (
        <main className="panel">
          <div className="section-head">
            <div>
              <h2>Question Bank</h2>
              <p className="muted">可搜尋 trial、癌別、年份、題幹文字；每題可補上答案與詳解。</p>
            </div>
          </div>
          <div className="filters">
            <input name="bank_search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜尋：KEYNOTE-671、EGFR、breast、PARP..." />
            <select name="bank_year" value={bankYear} onChange={(e) => setBankYear(e.target.value)}>
              <option>All</option>
              <option>112</option>
              <option>113</option>
              <option>114</option>
            </select>
            <select name="bank_cancer" value={bankCancer} onChange={(e) => setBankCancer(e.target.value)}>
              <option>All</option>
              {cancerCategories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <p className="muted">顯示前 80 題，共符合 {bankQuestions.length} 題。</p>
          <div className="question-list">
            {bankQuestions.map((q) => (
              <div key={q.id} className="bank-question-wrapper">
                <QuestionCard
                  question={q}
                  stat={getStat(state, q.id)}
                  onUpdateStat={updateStat}
                  compact
                  onEdit={(id) => setEditingQuestionId(id)}
                  onCreateFlashcard={createFlashcardFromQuestion}
                />
                {editingQuestionId === q.id && (
                  <QuestionEditor
                    question={q}
                    override={state.questionOverrides?.[q.id]}
                    onSave={saveQuestionOverride}
                    onCancel={() => setEditingQuestionId(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </main>
      )}


      {tab === 'manual' && (
        <ManualExplanationPanel state={state} onUpdateStat={updateStat} />
      )}

      {tab === 'question-edit' && (
        <QuestionEditPanel state={state} onSaveOverride={saveQuestionOverride} />
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
            <h3>Top weak questions</h3>
            {weakQuestions.slice(0, 12).map(({ q, stat }) => (
              <div className="weak-row" key={q.id}>
                <strong>{q.id}</strong> · {q.cancer} · {q.topic} · wrong rate {wrongRate(stat)}% · {q.stem.slice(0, 120)}...
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
            <button className="secondary" onClick={resetPlanProgress}>重設完成度</button>
          </div>

          <section className="plan-overview">
            <MetricCard label="總完成率" value={`${planSummary.percent}%`} sub={`${planSummary.completed}/${planSummary.total} tasks`} />
            <MetricCard label="Golden trial 完成率" value={`${planSummary.goldenPercent}%`} sub={`${planSummary.goldenCompleted}/${planSummary.goldenTotal} trial tasks`} />
            <MetricCard label="今日建議" value={`Day ${Math.min(planSummary.completed + 1, 100)}`} sub="照順序推進，錯題用 Review Queue 補強" />
            <MetricCard label="Game level" value={`Lv ${state.game?.level || 1}`} sub={`${state.game?.xp || 0} XP`} />
            <MetricCard label="Boss defeated" value={(state.game?.defeatedBosses || []).length} sub={`${(state.game?.unlockedBosses || []).length} unlocked`} />
            <MetricCard label="Trial cards" value={(state.flashcards || []).filter((card) => card.sourceType === 'trial').length} sub="Trial Boss target 50" />
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
                return (
                  <label key={task.id} className={done ? 'plan-task done' : 'plan-task'}>
                    <input type="checkbox" checked={done} onChange={() => togglePlanTask(task.id)} />
                    <div className="plan-task-main">
                      <div className="plan-task-title">
                        <span className="day-chip">{task.day}</span>
                        <strong>{task.topic}</strong>
                        <span className="pill soft">{task.module}</span>
                        <span className="pill">{task.cancer}</span>
                        <span className={task.priority === 'High' ? 'priority high' : 'priority'}>{task.priority}</span>
                      </div>
                      <p className="phase-line">{task.phase}</p>
                      <p>{task.details}</p>
                      <div className="trial-tags">
                        {(task.goldenTrials || []).map((trial) => <span key={trial}>{trial}</span>)}
                        {(task.focusTags || []).map((tag) => <span key={tag}>{tag}</span>)}
                      </div>
                    </div>
                  </label>
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
        <main className="panel">
          <h2>Settings / Backup</h2>
          <div className="settings-grid">
            <label>
              每日題數
              <input name="dailyCount" type="number" min="10" max="15" value={state.settings.dailyCount} onChange={(e) => updateSettings({ dailyCount: Math.max(10, Math.min(15, Number(e.target.value))) })} />
            </label>
            <label>
              年份篩選
              <div className="check-row">
                {[112, 113, 114].map((year) => (
                  <label key={year}><input type="checkbox" checked={state.settings.preferredYears.includes(year)} onChange={(e) => {
                    const next = e.target.checked
                      ? [...state.settings.preferredYears, year]
                      : state.settings.preferredYears.filter((x) => x !== year);
                    updateSettings({ preferredYears: next });
                  }} /> {year}</label>
                ))}
              </div>
            </label>
          </div>
          <div className="subsection">
            <h3>癌別練習篩選</h3>
            <div className="category-grid">
              {cancerCategories.map((c) => (
                <label key={c}>
                  <input type="checkbox" checked={state.settings.preferredCancers.includes(c)} onChange={(e) => {
                    const next = e.target.checked
                      ? [...state.settings.preferredCancers, c]
                      : state.settings.preferredCancers.filter((x) => x !== c);
                    updateSettings({ preferredCancers: next });
                  }} /> {c}
                </label>
              ))}
            </div>
            <button className="secondary" onClick={() => updateSettings({ preferredCancers: [] })}>清除癌別篩選</button>
          </div>
          <div className="subsection inline-actions">
            <button className="secondary" onClick={exportBackup}>匯出備份 JSON</button>
            <label className="file-button">匯入備份 JSON<input type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} /></label>
            <button className="danger" onClick={resetAll}>清除所有資料</button>
          </div>
        </main>
      )}
    </div>
  );
}
