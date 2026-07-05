// Manual editing guide:
// - Edit topic/details/goldenTrials/focusTags freely.
// - Keep each task.key stable; progress and session history use it as identity.
// - id/day are display and legacy compatibility fields. Reordering is safe when key stays unchanged.
// - New tasks need a new unique key. Do not reuse keys from deleted tasks.
export const HIGH_YIELD_TOPICS = [
  {
    "id": "lung-perioperative-io",
    "label": "Lung perioperative IO",
    "cancer": "Lung",
    "type": "每年高頻＋近年更新",
    "examFrequency": 5,
    "recentUpdate": 5,
    "aliases": [
      "perioperative",
      "neoadjuvant",
      "adjuvant",
      "pembrolizumab",
      "nivolumab",
      "atezolizumab",
      "checkmate 816",
      "keynote-671",
      "impower010"
    ]
  },
  {
    "id": "breast-adc",
    "label": "Breast ADC",
    "cancer": "Breast",
    "type": "每年高頻＋近年更新",
    "examFrequency": 5,
    "recentUpdate": 5,
    "aliases": [
      "adc",
      "t-dxd",
      "trastuzumab deruxtecan",
      "sacituzumab",
      "her2-low",
      "destiny-breast",
      "trop2"
    ]
  },
  {
    "id": "gu-ev-pembro",
    "label": "GU EV/pembro",
    "cancer": "GU",
    "type": "每年高頻＋近年更新",
    "examFrequency": 5,
    "recentUpdate": 5,
    "aliases": [
      "enfortumab",
      "ev",
      "pembrolizumab",
      "urothelial",
      "ev-302",
      "javelin",
      "fgfr"
    ]
  },
  {
    "id": "gyn-io",
    "label": "GYN IO",
    "cancer": "GYN",
    "type": "每年高頻＋近年更新",
    "examFrequency": 5,
    "recentUpdate": 5,
    "aliases": [
      "endometrial",
      "cervical",
      "dmmr",
      "pmmr",
      "dostarlimab",
      "pembrolizumab",
      "keynote-a18",
      "keynote-775",
      "ruby"
    ]
  },
  {
    "id": "crc-algorithm",
    "label": "CRC algorithm",
    "cancer": "GI",
    "type": "常考 algorithm",
    "examFrequency": 4,
    "recentUpdate": 3,
    "aliases": [
      "crc",
      "colon",
      "rectal",
      "ras",
      "braf",
      "msi",
      "her2",
      "anti-egfr",
      "folfox",
      "folfiri",
      "tnt"
    ]
  },
  {
    "id": "hcc-algorithm",
    "label": "HCC algorithm",
    "cancer": "GI",
    "type": "常考 algorithm",
    "examFrequency": 4,
    "recentUpdate": 4,
    "aliases": [
      "hcc",
      "atezo",
      "bevacizumab",
      "stride",
      "himalaya",
      "imbrave",
      "durvalumab",
      "tremelimumab"
    ]
  },
  {
    "id": "mcrpc-algorithm",
    "label": "mCRPC",
    "cancer": "GU",
    "type": "常考 algorithm",
    "examFrequency": 4,
    "recentUpdate": 4,
    "aliases": [
      "mcrpc",
      "prostate",
      "parpi",
      "lu-177",
      "psma",
      "cabazitaxel",
      "abiraterone",
      "enzalutamide"
    ]
  },
  {
    "id": "rcc-algorithm",
    "label": "RCC algorithm",
    "cancer": "GU",
    "type": "常考 algorithm",
    "examFrequency": 4,
    "recentUpdate": 4,
    "aliases": [
      "rcc",
      "renal",
      "keynote-564",
      "io/tki",
      "checkmate-9er",
      "clear",
      "cabozantinib",
      "lenvatinib"
    ]
  },
  {
    "id": "ici-toxicity",
    "label": "ICI toxicity",
    "cancer": "Supportive/Stats",
    "type": "支持性治療 / toxicity",
    "examFrequency": 3,
    "recentUpdate": 3,
    "aliases": [
      "ici",
      "irae",
      "pneumonitis",
      "colitis",
      "hepatitis",
      "endocrine",
      "myocarditis",
      "toxicity"
    ]
  },
  {
    "id": "adc-ild",
    "label": "ADC ILD",
    "cancer": "Supportive/Stats",
    "type": "支持性治療 / toxicity",
    "examFrequency": 3,
    "recentUpdate": 5,
    "aliases": [
      "adc",
      "ild",
      "pneumonitis",
      "t-dxd",
      "trastuzumab deruxtecan",
      "enfortumab",
      "sacituzumab"
    ]
  },
  {
    "id": "febrile-neutropenia",
    "label": "Febrile neutropenia",
    "cancer": "Supportive/Stats",
    "type": "支持性治療 / toxicity",
    "examFrequency": 3,
    "recentUpdate": 2,
    "aliases": [
      "febrile neutropenia",
      "neutropenic fever",
      "anc",
      "mascc",
      "g-csf",
      "infection"
    ]
  },
  {
    "id": "rare-sarcoma-cup-hereditary",
    "label": "Sarcoma / CUP / MEN / VHL",
    "cancer": "Other",
    "type": "低頻但會考",
    "examFrequency": 2,
    "recentUpdate": 2,
    "aliases": [
      "sarcoma",
      "cup",
      "men",
      "vhl",
      "gist",
      "net",
      "thyroid",
      "ihc",
      "rare"
    ]
  },
  {
    "id": "epidemiology-background",
    "label": "Epidemiology background",
    "cancer": "Other",
    "type": "純背景知識",
    "examFrequency": 1,
    "recentUpdate": 1,
    "aliases": [
      "epidemiology",
      "incidence",
      "mortality",
      "risk factor",
      "screening"
    ]
  }
];

export const dailyCompletionCriteria = [
  "Daily Practice completed",
  "Boss 1-3 at least 2 pass",
  "Create 3-5 high-value cards",
  "Wrong answers classified by errorType"
];

const STUDY_PLAN_100_BASE = [
  {
    "key": "lung-nsclc-foundation",
    "id": 1,
    "day": "Day 1",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Lung",
    "cancer": "Lung",
    "topic": "NSCLC foundation",
    "details": "TNM, resectability, molecular testing, PD-L1 TPS, perioperative decision points",
    "goldenTrials": [
      "NCCN Algorithm"
    ],
    "focusTags": [
      "algorithm",
      "biomarker",
      "NSCLC"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Lung Boss",
    "priority": "High",
    "legacyId": 1
  },
  {
    "key": "lung-egfr-early-nsclc",
    "id": 2,
    "day": "Day 2",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Lung",
    "cancer": "Lung",
    "topic": "EGFR early NSCLC",
    "details": "Adjuvant osimertinib, EGFR exon 19/L858R, postop chemotherapy role",
    "goldenTrials": [
      "ADAURA"
    ],
    "focusTags": [
      "EGFR",
      "adjuvant",
      "targeted therapy"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Lung Boss",
    "priority": "High",
    "legacyId": 2
  },
  {
    "key": "lung-unresectable-stage-iii-nsclc",
    "id": 3,
    "day": "Day 3",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Lung",
    "cancer": "Lung",
    "topic": "Unresectable stage III NSCLC",
    "details": "Definitive CCRT, durvalumab consolidation, PACIFIC eligibility and endpoints",
    "goldenTrials": [
      "PACIFIC"
    ],
    "focusTags": [
      "CCRT",
      "durvalumab",
      "endpoint"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Lung Boss",
    "priority": "High",
    "legacyId": 3
  },
  {
    "key": "lung-neoadjuvant-chemo-io",
    "id": 4,
    "day": "Day 4",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Lung",
    "cancer": "Lung",
    "topic": "Neoadjuvant chemo-IO",
    "details": "Resectable NSCLC, pCR/MPR/EFS definitions and trial traps",
    "goldenTrials": [
      "CheckMate 816"
    ],
    "focusTags": [
      "neoadjuvant",
      "ICI",
      "endpoint"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Lung Boss",
    "priority": "High",
    "legacyId": 4
  },
  {
    "key": "lung-perioperative-pembrolizumab",
    "id": 5,
    "day": "Day 5",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Lung",
    "cancer": "Lung",
    "topic": "Perioperative pembrolizumab",
    "details": "Stage II-IIIB NSCLC, neoadjuvant pembrolizumab-chemo to adjuvant pembrolizumab",
    "goldenTrials": [
      "KEYNOTE-671"
    ],
    "focusTags": [
      "perioperative",
      "ICI",
      "EFS"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Lung Boss",
    "priority": "High",
    "legacyId": 5
  },
  {
    "key": "lung-alk-ros1-ret-met-ntrk",
    "id": 6,
    "day": "Day 6",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Lung",
    "cancer": "Lung",
    "topic": "ALK/ROS1/RET/MET/NTRK",
    "details": "Driver-positive metastatic sequencing and resistance pattern recognition",
    "goldenTrials": [
      "CROWN",
      "PROFILE",
      "LIBRETTO"
    ],
    "focusTags": [
      "biomarker",
      "targeted therapy",
      "sequencing"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Lung Boss",
    "priority": "High",
    "legacyId": 6
  },
  {
    "key": "lung-kras-her2-braf-met-exon-14",
    "id": 7,
    "day": "Day 7",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Lung",
    "cancer": "Lung",
    "topic": "KRAS/HER2/BRAF/MET exon 14",
    "details": "Actionable mutations, drug names, eligibility, toxicity traps",
    "goldenTrials": [
      "CodeBreaK",
      "DESTINY-Lung"
    ],
    "focusTags": [
      "KRAS",
      "HER2",
      "biomarker"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Lung Boss",
    "priority": "High",
    "legacyId": 7
  },
  {
    "key": "lung-metastatic-ici-algorithms",
    "id": 8,
    "day": "Day 8",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Lung",
    "cancer": "Lung",
    "topic": "Metastatic ICI algorithms",
    "details": "PD-L1 high, chemo-IO, dual IO, contraindications, progression patterns",
    "goldenTrials": [
      "KEYNOTE-024",
      "KEYNOTE-189",
      "CheckMate-227"
    ],
    "focusTags": [
      "metastatic",
      "ICI",
      "algorithm"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Lung Boss",
    "priority": "High",
    "legacyId": 8
  },
  {
    "key": "lung-sclc-limited-stage",
    "id": 9,
    "day": "Day 9",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Lung",
    "cancer": "Lung",
    "topic": "SCLC limited stage",
    "details": "Concurrent chemoradiation, BID vs QD RT, PCI, CONVERT and CALGB 30610",
    "goldenTrials": [
      "CONVERT",
      "CALGB 30610"
    ],
    "focusTags": [
      "SCLC",
      "radiation",
      "trial"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Lung Boss",
    "priority": "High",
    "legacyId": 9
  },
  {
    "key": "lung-sclc-extensive-stage",
    "id": 10,
    "day": "Day 10",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Lung",
    "cancer": "Lung",
    "topic": "SCLC extensive stage",
    "details": "Platinum-etoposide plus ICI, maintenance, lurbinectedin, thoracic RT traps",
    "goldenTrials": [
      "IMpower133",
      "CASPIAN"
    ],
    "focusTags": [
      "SCLC",
      "metastatic",
      "ICI"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Lung Boss",
    "priority": "High",
    "legacyId": 10
  },
  {
    "key": "lung-mesothelioma",
    "id": 11,
    "day": "Day 11",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Lung",
    "cancer": "Lung",
    "topic": "Mesothelioma",
    "details": "First-line IO, histology, surgical controversies, TTFields and toxicity",
    "goldenTrials": [
      "CheckMate-743"
    ],
    "focusTags": [
      "mesothelioma",
      "ICI",
      "rare"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Lung Boss",
    "priority": "High",
    "legacyId": 11
  },
  {
    "key": "lung-lung-toxicity-drill",
    "id": 12,
    "day": "Day 12",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Lung",
    "cancer": "Lung",
    "topic": "Lung toxicity drill",
    "details": "Pneumonitis, EGFR/ALK adverse effects, ADC ILD, radiation recall",
    "goldenTrials": [
      "Toxicity Review"
    ],
    "focusTags": [
      "toxicity",
      "ILD",
      "TKI"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Lung Boss",
    "priority": "High",
    "legacyId": 12
  },
  {
    "key": "lung-lung-boss-prep",
    "id": 13,
    "day": "Day 13",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Lung",
    "cancer": "Lung",
    "topic": "Lung boss prep",
    "details": "20-question Lung mixed bank: biomarkers, perioperative, SCLC, mesothelioma",
    "goldenTrials": [
      "Lung Boss"
    ],
    "focusTags": [
      "boss",
      "mixed mock",
      "weakness repair"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Lung Boss",
    "priority": "High",
    "legacyId": 13
  },
  {
    "key": "breast-early-hr-her2-framework",
    "id": 14,
    "day": "Day 14",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Breast",
    "cancer": "Breast",
    "topic": "Early HR+/HER2- framework",
    "details": "Risk stratification, endocrine therapy, OFS, chemo decision",
    "goldenTrials": [
      "TAILORx",
      "RxPONDER"
    ],
    "focusTags": [
      "HR+",
      "adjuvant",
      "algorithm"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Breast Boss",
    "priority": "High",
    "legacyId": 14
  },
  {
    "key": "breast-gene-expression-profile",
    "id": 15,
    "day": "Day 15",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Breast",
    "cancer": "Breast",
    "topic": "Gene expression profile",
    "details": "Oncotype DX, MammaPrint, PAM50, EndoPredict, what each test can and cannot do",
    "goldenTrials": [
      "TAILORx",
      "MINDACT"
    ],
    "focusTags": [
      "biomarker",
      "gene expression",
      "adjuvant"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Breast Boss",
    "priority": "High",
    "legacyId": 15
  },
  {
    "key": "breast-adjuvant-cdk4-6",
    "id": 16,
    "day": "Day 16",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Breast",
    "cancer": "Breast",
    "topic": "Adjuvant CDK4/6",
    "details": "High-risk criteria, monarchE, NATALEE, duration, toxicity",
    "goldenTrials": [
      "monarchE",
      "NATALEE"
    ],
    "focusTags": [
      "CDK4/6",
      "adjuvant",
      "toxicity"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Breast Boss",
    "priority": "High",
    "legacyId": 16
  },
  {
    "key": "breast-her2-early-disease",
    "id": 17,
    "day": "Day 17",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Breast",
    "cancer": "Breast",
    "topic": "HER2+ early disease",
    "details": "Neoadjuvant HP-chemo, residual disease, adjuvant T-DM1",
    "goldenTrials": [
      "KATHERINE",
      "APHINITY"
    ],
    "focusTags": [
      "HER2",
      "neoadjuvant",
      "ADC"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Breast Boss",
    "priority": "High",
    "legacyId": 17
  },
  {
    "key": "breast-tnbc-neoadjuvant-io",
    "id": 18,
    "day": "Day 18",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Breast",
    "cancer": "Breast",
    "topic": "TNBC neoadjuvant IO",
    "details": "KEYNOTE-522 population, pCR/EFS, adjuvant pembrolizumab continuation",
    "goldenTrials": [
      "KEYNOTE-522"
    ],
    "focusTags": [
      "TNBC",
      "ICI",
      "neoadjuvant"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Breast Boss",
    "priority": "High",
    "legacyId": 18
  },
  {
    "key": "breast-gbrca-and-parpi",
    "id": 19,
    "day": "Day 19",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Breast",
    "cancer": "Breast",
    "topic": "gBRCA and PARPi",
    "details": "OlympiA eligibility, TNBC/luminal high-risk definitions, iDFS/OS",
    "goldenTrials": [
      "OlympiA"
    ],
    "focusTags": [
      "PARPi",
      "BRCA",
      "adjuvant"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Breast Boss",
    "priority": "High",
    "legacyId": 19
  },
  {
    "key": "breast-metastatic-hr-her2",
    "id": 20,
    "day": "Day 20",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Breast",
    "cancer": "Breast",
    "topic": "Metastatic HR+/HER2-",
    "details": "Endocrine-CDK4/6 sequencing, ESR1, PIK3CA, AKT pathway choices",
    "goldenTrials": [
      "PALOMA",
      "MONALEESA",
      "SOLAR-1"
    ],
    "focusTags": [
      "metastatic",
      "sequencing",
      "biomarker"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Breast Boss",
    "priority": "High",
    "legacyId": 20
  },
  {
    "key": "breast-her2-metastatic",
    "id": 21,
    "day": "Day 21",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Breast",
    "cancer": "Breast",
    "topic": "HER2+ metastatic",
    "details": "First-line HP-taxane, second-line T-DXd, brain metastasis options",
    "goldenTrials": [
      "CLEOPATRA",
      "DESTINY-Breast03",
      "HER2CLIMB"
    ],
    "focusTags": [
      "HER2",
      "metastatic",
      "ADC"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Breast Boss",
    "priority": "High",
    "legacyId": 21
  },
  {
    "key": "breast-her2-low-and-adc",
    "id": 22,
    "day": "Day 22",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Breast",
    "cancer": "Breast",
    "topic": "HER2-low and ADC",
    "details": "HER2-low definition, T-DXd eligibility, ILD monitoring",
    "goldenTrials": [
      "DESTINY-Breast04"
    ],
    "focusTags": [
      "HER2-low",
      "ADC",
      "toxicity"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Breast Boss",
    "priority": "High",
    "legacyId": 22
  },
  {
    "key": "breast-tnbc-metastatic",
    "id": 23,
    "day": "Day 23",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Breast",
    "cancer": "Breast",
    "topic": "TNBC metastatic",
    "details": "PD-L1 assays, sacituzumab, PARPi, TROP2 ADC traps",
    "goldenTrials": [
      "ASCENT",
      "KEYNOTE-355"
    ],
    "focusTags": [
      "TNBC",
      "ADC",
      "PD-L1"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Breast Boss",
    "priority": "High",
    "legacyId": 23
  },
  {
    "key": "breast-breast-toxicity-drill",
    "id": 24,
    "day": "Day 24",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Breast",
    "cancer": "Breast",
    "topic": "Breast toxicity drill",
    "details": "CDK4/6 neutropenia/QTc/diarrhea, PI3K hyperglycemia, ADC ILD",
    "goldenTrials": [
      "Toxicity Review"
    ],
    "focusTags": [
      "toxicity",
      "ADC",
      "CDK4/6"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Breast Boss",
    "priority": "High",
    "legacyId": 24
  },
  {
    "key": "breast-breast-trial-endpoint-recall",
    "id": 25,
    "day": "Day 25",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Breast",
    "cancer": "Breast",
    "topic": "Breast trial endpoint recall",
    "details": "Blank recall for population, intervention, endpoint, OS/PFS/iDFS",
    "goldenTrials": [
      "Golden Trial Recall"
    ],
    "focusTags": [
      "trial",
      "endpoint",
      "flashcard"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Breast Boss",
    "priority": "High",
    "legacyId": 25
  },
  {
    "key": "breast-breast-boss-prep",
    "id": 26,
    "day": "Day 26",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "Breast",
    "cancer": "Breast",
    "topic": "Breast boss prep",
    "details": "HER2/TNBC/HR+ mixed mock and correction",
    "goldenTrials": [
      "Breast Boss"
    ],
    "focusTags": [
      "boss",
      "mixed mock",
      "weakness repair"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Breast Boss",
    "priority": "High",
    "legacyId": 26
  },
  {
    "key": "gi-crc-biomarkers",
    "id": 27,
    "day": "Day 27",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "GI",
    "cancer": "GI",
    "topic": "CRC biomarkers",
    "details": "RAS/BRAF/MSI/HER2/NTRK, sidedness, anti-EGFR rules",
    "goldenTrials": [
      "FIRE-3",
      "PARADIGM"
    ],
    "focusTags": [
      "CRC",
      "biomarker",
      "metastatic"
    ],
    "highYieldWeight": 4,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GI Boss",
    "priority": "High",
    "legacyId": 27
  },
  {
    "key": "gi-metastatic-crc-sequencing",
    "id": 28,
    "day": "Day 28",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "GI",
    "cancer": "GI",
    "topic": "Metastatic CRC sequencing",
    "details": "FOLFOX/FOLFIRI, bevacizumab beyond progression, EGFR rechallenge, TAS-102",
    "goldenTrials": [
      "VELOUR",
      "RAISE",
      "SUNLIGHT"
    ],
    "focusTags": [
      "CRC",
      "sequencing",
      "metastatic"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GI Boss",
    "priority": "High",
    "legacyId": 28
  },
  {
    "key": "gi-rectal-tnt",
    "id": 29,
    "day": "Day 29",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "GI",
    "cancer": "GI",
    "topic": "Rectal TNT",
    "details": "PRODIGE-23, RAPIDO, OPRA, watch-and-wait, endpoint traps",
    "goldenTrials": [
      "PRODIGE-23",
      "RAPIDO",
      "OPRA"
    ],
    "focusTags": [
      "rectal",
      "neoadjuvant",
      "radiation"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GI Boss",
    "priority": "High",
    "legacyId": 29
  },
  {
    "key": "gi-adjuvant-colon-cancer",
    "id": 30,
    "day": "Day 30",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "GI",
    "cancer": "GI",
    "topic": "Adjuvant colon cancer",
    "details": "Stage II risk, stage III duration, IDEA, ctDNA caveats",
    "goldenTrials": [
      "IDEA"
    ],
    "focusTags": [
      "colon",
      "adjuvant",
      "algorithm"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GI Boss",
    "priority": "High",
    "legacyId": 30
  },
  {
    "key": "gi-gastric-gej-first-line",
    "id": 31,
    "day": "Day 31",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "GI",
    "cancer": "GI",
    "topic": "Gastric/GEJ first-line",
    "details": "HER2, PD-L1 CPS, CLDN18.2, chemo-IO, trastuzumab choices",
    "goldenTrials": [
      "CheckMate-649",
      "KEYNOTE-859",
      "SPOTLIGHT"
    ],
    "focusTags": [
      "gastric",
      "GEJ",
      "biomarker"
    ],
    "highYieldWeight": 4,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GI Boss",
    "priority": "High",
    "legacyId": 31
  },
  {
    "key": "gi-esophageal-cancer",
    "id": 32,
    "day": "Day 32",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "GI",
    "cancer": "GI",
    "topic": "Esophageal cancer",
    "details": "CROSS, CheckMate-577, definitive CCRT, squamous vs adenocarcinoma",
    "goldenTrials": [
      "CROSS",
      "CheckMate-577"
    ],
    "focusTags": [
      "esophageal",
      "CCRT",
      "adjuvant"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GI Boss",
    "priority": "High",
    "legacyId": 32
  },
  {
    "key": "gi-hcc-systemic-therapy",
    "id": 33,
    "day": "Day 33",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "GI",
    "cancer": "GI",
    "topic": "HCC systemic therapy",
    "details": "Atezo-bev, STRIDE, second-line sequencing, contraindications",
    "goldenTrials": [
      "IMbrave150",
      "HIMALAYA"
    ],
    "focusTags": [
      "HCC",
      "ICI",
      "sequencing"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GI Boss",
    "priority": "High",
    "legacyId": 33
  },
  {
    "key": "gi-pancreas-cancer",
    "id": 34,
    "day": "Day 34",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "GI",
    "cancer": "GI",
    "topic": "Pancreas cancer",
    "details": "Adjuvant modified FOLFIRINOX, metastatic regimens, BRCA/PARPi",
    "goldenTrials": [
      "PRODIGE-24",
      "POLO"
    ],
    "focusTags": [
      "pancreas",
      "PARPi",
      "adjuvant"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GI Boss",
    "priority": "High",
    "legacyId": 34
  },
  {
    "key": "gi-biliary-tract-cancer",
    "id": 35,
    "day": "Day 35",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "GI",
    "cancer": "GI",
    "topic": "Biliary tract cancer",
    "details": "TOPAZ-1, KEYNOTE-966, FGFR2, IDH1, HER2, BRAF",
    "goldenTrials": [
      "TOPAZ-1",
      "KEYNOTE-966"
    ],
    "focusTags": [
      "biliary",
      "biomarker",
      "ICI"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GI Boss",
    "priority": "High",
    "legacyId": 35
  },
  {
    "key": "gi-gist-and-net",
    "id": 36,
    "day": "Day 36",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "GI",
    "cancer": "GI",
    "topic": "GIST and NET",
    "details": "KIT/PDGFRA, imatinib dose, avapritinib, sunitinib/regorafenib/ripretinib",
    "goldenTrials": [
      "GIST Review"
    ],
    "focusTags": [
      "GIST",
      "targeted therapy",
      "rare"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GI Boss",
    "priority": "High",
    "legacyId": 36
  },
  {
    "key": "gi-gi-toxicity-and-supportive-traps",
    "id": 37,
    "day": "Day 37",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "GI",
    "cancer": "GI",
    "topic": "GI toxicity and supportive traps",
    "details": "EGFR rash/hypomagnesemia, diarrhea, hepatic dysfunction, nutrition",
    "goldenTrials": [
      "Toxicity Review"
    ],
    "focusTags": [
      "toxicity",
      "supportive",
      "GI"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GI Boss",
    "priority": "High",
    "legacyId": 37
  },
  {
    "key": "gi-gi-boss-prep",
    "id": 38,
    "day": "Day 38",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "GI",
    "cancer": "GI",
    "topic": "GI boss prep",
    "details": "GI mixed mock with CRC, gastric/GEJ, rectal TNT, HCC, biliary",
    "goldenTrials": [
      "GI Boss"
    ],
    "focusTags": [
      "boss",
      "mixed mock",
      "weakness repair"
    ],
    "highYieldWeight": 4,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GI Boss",
    "priority": "High",
    "legacyId": 38
  },
  {
    "key": "gu-rcc-adjuvant-and-metastatic",
    "id": 39,
    "day": "Day 39",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "GU",
    "cancer": "GU",
    "topic": "RCC adjuvant and metastatic",
    "details": "KEYNOTE-564, IO/TKI first-line choices, risk groups, toxicity",
    "goldenTrials": [
      "KEYNOTE-564",
      "CheckMate-9ER",
      "CLEAR"
    ],
    "focusTags": [
      "RCC",
      "ICI",
      "TKI"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GU Readiness",
    "priority": "High",
    "legacyId": 39
  },
  {
    "key": "gu-urothelial-perioperative",
    "id": 40,
    "day": "Day 40",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "GU",
    "cancer": "GU",
    "topic": "Urothelial perioperative",
    "details": "Cisplatin eligibility, neoadjuvant chemo, adjuvant nivolumab",
    "goldenTrials": [
      "CheckMate-274"
    ],
    "focusTags": [
      "urothelial",
      "perioperative",
      "cisplatin"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GU Readiness",
    "priority": "High",
    "legacyId": 40
  },
  {
    "key": "gu-urothelial-metastatic",
    "id": 41,
    "day": "Day 41",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "GU",
    "cancer": "GU",
    "topic": "Urothelial metastatic",
    "details": "EV-pembrolizumab, avelumab maintenance, FGFR, EV toxicity",
    "goldenTrials": [
      "EV-302",
      "JAVELIN-Bladder-100",
      "THOR"
    ],
    "focusTags": [
      "urothelial",
      "ADC",
      "FGFR"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GU Readiness",
    "priority": "High",
    "legacyId": 41
  },
  {
    "key": "gu-prostate-hormone-sensitive",
    "id": 42,
    "day": "Day 42",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "GU",
    "cancer": "GU",
    "topic": "Prostate hormone-sensitive",
    "details": "Triplet therapy, ARPI selection, docetaxel, volume/risk traps",
    "goldenTrials": [
      "ARASENS",
      "PEACE-1"
    ],
    "focusTags": [
      "prostate",
      "ARPI",
      "metastatic"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GU Readiness",
    "priority": "High",
    "legacyId": 42
  },
  {
    "key": "gu-mcrpc-sequencing",
    "id": 43,
    "day": "Day 43",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "GU",
    "cancer": "GU",
    "topic": "mCRPC sequencing",
    "details": "PARPi combinations, Lu-177 PSMA, radium-223, cabazitaxel",
    "goldenTrials": [
      "VISION",
      "PROpel",
      "TALAPRO-2"
    ],
    "focusTags": [
      "prostate",
      "PARPi",
      "radioligand"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GU Readiness",
    "priority": "High",
    "legacyId": 43
  },
  {
    "key": "gu-seminoma-and-germ-cell",
    "id": 44,
    "day": "Day 44",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "GU",
    "cancer": "GU",
    "topic": "Seminoma and germ cell",
    "details": "Stage I/II seminoma, RT fields, BEP/EP, salvage concepts",
    "goldenTrials": [
      "Seminoma Review"
    ],
    "focusTags": [
      "seminoma",
      "radiation",
      "algorithm"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GU Readiness",
    "priority": "High",
    "legacyId": 44
  },
  {
    "key": "gu-gu-biomarkers",
    "id": 45,
    "day": "Day 45",
    "phase": "Phase 1: High-frequency cancer progression",
    "module": "GU",
    "cancer": "GU",
    "topic": "GU biomarkers",
    "details": "BRCA/HRR, FGFR, MSI, PD-L1 caveats, germline testing",
    "goldenTrials": [
      "Biomarker Review"
    ],
    "focusTags": [
      "biomarker",
      "BRCA",
      "FGFR"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GU Readiness",
    "priority": "High",
    "legacyId": 45
  },
  {
    "key": "gu-gu-toxicity-drill",
    "id": 46,
    "day": "Day 46",
    "phase": "Phase 2: Trap-topic progression",
    "module": "GU",
    "cancer": "GU",
    "topic": "GU toxicity drill",
    "details": "EV rash/hyperglycemia/neuropathy, TKI HTN, IO nephritis",
    "goldenTrials": [
      "Toxicity Review"
    ],
    "focusTags": [
      "toxicity",
      "ADC",
      "TKI"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GU Readiness",
    "priority": "High",
    "legacyId": 46
  },
  {
    "key": "gu-gu-mixed-correction",
    "id": 47,
    "day": "Day 47",
    "phase": "Phase 2: Trap-topic progression",
    "module": "GU",
    "cancer": "GU",
    "topic": "GU mixed correction",
    "details": "Fix GU wrong-rate >=50% and mastery <=2 questions",
    "goldenTrials": [
      "Weakness Review"
    ],
    "focusTags": [
      "weakness repair",
      "wrong retest",
      "GU"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GU Readiness",
    "priority": "High",
    "legacyId": 47
  },
  {
    "key": "gyn-endometrial-io",
    "id": 48,
    "day": "Day 48",
    "phase": "Phase 2: Trap-topic progression",
    "module": "GYN",
    "cancer": "GYN",
    "topic": "Endometrial IO",
    "details": "dMMR/pMMR, lenvatinib-pembrolizumab, dostarlimab/carbo-taxol",
    "goldenTrials": [
      "KEYNOTE-775",
      "RUBY"
    ],
    "focusTags": [
      "endometrial",
      "ICI",
      "biomarker"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GYN Readiness",
    "priority": "High",
    "legacyId": 48
  },
  {
    "key": "gyn-cervical-ccrt-and-io",
    "id": 49,
    "day": "Day 49",
    "phase": "Phase 2: Trap-topic progression",
    "module": "GYN",
    "cancer": "GYN",
    "topic": "Cervical CCRT and IO",
    "details": "KEYNOTE-A18, brachytherapy OAR, recurrent/metastatic pembrolizumab",
    "goldenTrials": [
      "KEYNOTE-A18",
      "KEYNOTE-826"
    ],
    "focusTags": [
      "cervical",
      "CCRT",
      "ICI"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GYN Readiness",
    "priority": "High",
    "legacyId": 49
  },
  {
    "key": "gyn-ovarian-first-line-maintenance",
    "id": 50,
    "day": "Day 50",
    "phase": "Phase 2: Trap-topic progression",
    "module": "GYN",
    "cancer": "GYN",
    "topic": "Ovarian first-line maintenance",
    "details": "BRCA/HRD, bevacizumab, olaparib/niraparib, PAOLA-1",
    "goldenTrials": [
      "SOLO-1",
      "PAOLA-1",
      "PRIMA"
    ],
    "focusTags": [
      "ovarian",
      "PARPi",
      "maintenance"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GYN Readiness",
    "priority": "High",
    "legacyId": 50
  },
  {
    "key": "gyn-ovarian-recurrence",
    "id": 51,
    "day": "Day 51",
    "phase": "Phase 2: Trap-topic progression",
    "module": "GYN",
    "cancer": "GYN",
    "topic": "Ovarian recurrence",
    "details": "Platinum-sensitive vs resistant, mirvetuximab, FRalpha, PARPi retreatment traps",
    "goldenTrials": [
      "MIRASOL"
    ],
    "focusTags": [
      "ovarian",
      "ADC",
      "biomarker"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GYN Readiness",
    "priority": "High",
    "legacyId": 51
  },
  {
    "key": "gyn-gyn-trial-interpretation",
    "id": 52,
    "day": "Day 52",
    "phase": "Phase 2: Trap-topic progression",
    "module": "GYN",
    "cancer": "GYN",
    "topic": "GYN trial interpretation",
    "details": "PFS vs OS, maintenance endpoints, subgroup forest plots",
    "goldenTrials": [
      "Trial Interpretation"
    ],
    "focusTags": [
      "endpoint",
      "statistics",
      "GYN"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GYN Readiness",
    "priority": "High",
    "legacyId": 52
  },
  {
    "key": "gyn-gyn-toxicity-drill",
    "id": 53,
    "day": "Day 53",
    "phase": "Phase 2: Trap-topic progression",
    "module": "GYN",
    "cancer": "GYN",
    "topic": "GYN toxicity drill",
    "details": "PARPi cytopenia/MDS, IO toxicity, bevacizumab bowel/perforation risk",
    "goldenTrials": [
      "Toxicity Review"
    ],
    "focusTags": [
      "toxicity",
      "PARPi",
      "ICI"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GYN Readiness",
    "priority": "High",
    "legacyId": 53
  },
  {
    "key": "gyn-gyn-rapid-algorithm",
    "id": 54,
    "day": "Day 54",
    "phase": "Phase 2: Trap-topic progression",
    "module": "GYN",
    "cancer": "GYN",
    "topic": "GYN rapid algorithm",
    "details": "Endometrial/cervical/ovarian treatment sequencing blank recall",
    "goldenTrials": [
      "Algorithm Recall"
    ],
    "focusTags": [
      "algorithm",
      "flashcard",
      "GYN"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GYN Readiness",
    "priority": "High",
    "legacyId": 54
  },
  {
    "key": "gyn-gyn-mixed-correction",
    "id": 55,
    "day": "Day 55",
    "phase": "Phase 2: Trap-topic progression",
    "module": "GYN",
    "cancer": "GYN",
    "topic": "GYN mixed correction",
    "details": "Fix GYN wrong-rate >=50% and high-confidence wrong questions",
    "goldenTrials": [
      "Weakness Review"
    ],
    "focusTags": [
      "weakness repair",
      "wrong retest",
      "GYN"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "GYN Readiness",
    "priority": "High",
    "legacyId": 55
  },
  {
    "key": "head-and-neck-hpv-oropharynx-and-staging",
    "id": 56,
    "day": "Day 56",
    "phase": "Phase 2: Trap-topic progression",
    "module": "Head & Neck",
    "cancer": "Head & Neck",
    "topic": "HPV oropharynx and staging",
    "details": "HPV-positive prognosis, AJCC differences, de-escalation traps",
    "goldenTrials": [
      "HPV HNSCC Review"
    ],
    "focusTags": [
      "HPV",
      "staging",
      "radiation"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Head & Neck Boss",
    "priority": "High",
    "legacyId": 56
  },
  {
    "key": "head-and-neck-definitive-and-induction-ccrt",
    "id": 57,
    "day": "Day 57",
    "phase": "Phase 2: Trap-topic progression",
    "module": "Head & Neck",
    "cancer": "Head & Neck",
    "topic": "Definitive and induction CCRT",
    "details": "Cisplatin vs cetuximab, TPF induction, larynx preservation trial traps",
    "goldenTrials": [
      "DeCIDE",
      "RTOG 1016"
    ],
    "focusTags": [
      "CCRT",
      "induction",
      "trial"
    ],
    "highYieldWeight": 3,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Head & Neck Boss",
    "priority": "High",
    "legacyId": 57
  },
  {
    "key": "head-and-neck-recurrent-metastatic-hnscc",
    "id": 58,
    "day": "Day 58",
    "phase": "Phase 2: Trap-topic progression",
    "module": "Head & Neck",
    "cancer": "Head & Neck",
    "topic": "Recurrent/metastatic HNSCC",
    "details": "KEYNOTE-048, CheckMate-141, platinum timing, CPS interpretation",
    "goldenTrials": [
      "KEYNOTE-048",
      "CheckMate-141"
    ],
    "focusTags": [
      "metastatic",
      "ICI",
      "PD-L1"
    ],
    "highYieldWeight": 3,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Head & Neck Boss",
    "priority": "High",
    "legacyId": 58
  },
  {
    "key": "head-and-neck-nasopharyngeal-carcinoma",
    "id": 59,
    "day": "Day 59",
    "phase": "Phase 2: Trap-topic progression",
    "module": "Head & Neck",
    "cancer": "Head & Neck",
    "topic": "Nasopharyngeal carcinoma",
    "details": "Gemcitabine-cisplatin, toripalimab/camrelizumab, EBV DNA, CCRT",
    "goldenTrials": [
      "JUPITER-02"
    ],
    "focusTags": [
      "NPC",
      "ICI",
      "CCRT"
    ],
    "highYieldWeight": 3,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Head & Neck Boss",
    "priority": "High",
    "legacyId": 59
  },
  {
    "key": "head-and-neck-head-and-neck-boss-prep",
    "id": 60,
    "day": "Day 60",
    "phase": "Phase 2: Trap-topic progression",
    "module": "Head & Neck",
    "cancer": "Head & Neck",
    "topic": "Head & Neck boss prep",
    "details": "HPV/HNSCC/NPC/CCRT mixed mock and correction",
    "goldenTrials": [
      "Head & Neck Boss"
    ],
    "focusTags": [
      "boss",
      "mixed mock",
      "weakness repair"
    ],
    "highYieldWeight": 3,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Head & Neck Boss",
    "priority": "High",
    "legacyId": 60
  },
  {
    "key": "heme-hodgkin-lymphoma",
    "id": 61,
    "day": "Day 61",
    "phase": "Phase 2: Trap-topic progression",
    "module": "Heme",
    "cancer": "Heme",
    "topic": "Hodgkin lymphoma",
    "details": "ABVD vs A+AVD, PET-adapted therapy, brentuximab toxicity, checkpoint inhibitors",
    "goldenTrials": [
      "ECHELON-1",
      "RATHL"
    ],
    "focusTags": [
      "HL",
      "toxicity",
      "trial"
    ],
    "highYieldWeight": 3,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Heme Readiness",
    "priority": "High",
    "legacyId": 61
  },
  {
    "key": "heme-dlbcl-and-car-t",
    "id": 62,
    "day": "Day 62",
    "phase": "Phase 2: Trap-topic progression",
    "module": "Heme",
    "cancer": "Heme",
    "topic": "DLBCL and CAR-T",
    "details": "R-CHOP, pola-R-CHP, second-line CAR-T, bridging, CRS/ICANS",
    "goldenTrials": [
      "POLARIX",
      "ZUMA-7",
      "TRANSFORM"
    ],
    "focusTags": [
      "DLBCL",
      "CAR-T",
      "toxicity"
    ],
    "highYieldWeight": 3,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Heme Readiness",
    "priority": "High",
    "legacyId": 62
  },
  {
    "key": "heme-indolent-lymphoma",
    "id": 63,
    "day": "Day 63",
    "phase": "Phase 2: Trap-topic progression",
    "module": "Heme",
    "cancer": "Heme",
    "topic": "Indolent lymphoma",
    "details": "FL/MCL/CLL treatment triggers, BTK inhibitors, venetoclax, anti-CD20",
    "goldenTrials": [
      "CLL Review"
    ],
    "focusTags": [
      "CLL",
      "BTK",
      "sequencing"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Heme Readiness",
    "priority": "High",
    "legacyId": 63
  },
  {
    "key": "heme-multiple-myeloma-frontline",
    "id": 64,
    "day": "Day 64",
    "phase": "Phase 2: Trap-topic progression",
    "module": "Heme",
    "cancer": "Heme",
    "topic": "Multiple myeloma frontline",
    "details": "Transplant eligibility, quadruplets, maintenance, high-risk cytogenetics",
    "goldenTrials": [
      "GRIFFIN",
      "PERSEUS"
    ],
    "focusTags": [
      "MM",
      "transplant",
      "maintenance"
    ],
    "highYieldWeight": 3,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Heme Readiness",
    "priority": "High",
    "legacyId": 64
  },
  {
    "key": "heme-multiple-myeloma-relapse",
    "id": 65,
    "day": "Day 65",
    "phase": "Phase 2: Trap-topic progression",
    "module": "Heme",
    "cancer": "Heme",
    "topic": "Multiple myeloma relapse",
    "details": "BCMA, bispecifics, CAR-T, sequencing and infection risk",
    "goldenTrials": [
      "CARTITUDE",
      "KarMMa"
    ],
    "focusTags": [
      "MM",
      "BCMA",
      "CAR-T"
    ],
    "highYieldWeight": 3,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Heme Readiness",
    "priority": "High",
    "legacyId": 65
  },
  {
    "key": "rare-skin-sarcoma-cup-other-melanoma-non-melanoma-skin-cancer",
    "id": 66,
    "day": "Day 66",
    "phase": "Phase 3: Rare + Supportive/Stats required block",
    "module": "Rare/Skin/Sarcoma/CUP/Other",
    "cancer": "Other",
    "topic": "Melanoma / non-melanoma skin cancer",
    "details": "BRAF/MEK, PD-1, CTLA-4, relatlimab, CSCC, BCC, Merkel cell",
    "goldenTrials": [
      "COMBI-AD",
      "CheckMate-238",
      "KEYNOTE-629"
    ],
    "focusTags": [
      "melanoma",
      "skin",
      "rare"
    ],
    "highYieldWeight": 4,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Rare/Supportive Readiness",
    "priority": "High",
    "legacyId": 66
  },
  {
    "key": "rare-skin-sarcoma-cup-other-sarcoma-gist",
    "id": 67,
    "day": "Day 67",
    "phase": "Phase 3: Rare + Supportive/Stats required block",
    "module": "Rare/Skin/Sarcoma/CUP/Other",
    "cancer": "Other",
    "topic": "Sarcoma / GIST",
    "details": "Separate GIST from sarcoma; KIT/PDGFRA, imatinib dose, avapritinib, pazopanib",
    "goldenTrials": [
      "GIST Review",
      "PALETTE"
    ],
    "focusTags": [
      "sarcoma",
      "GIST",
      "rare"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Rare/Supportive Readiness",
    "priority": "High",
    "legacyId": 67
  },
  {
    "key": "rare-skin-sarcoma-cup-other-cup-ihc",
    "id": 68,
    "day": "Day 68",
    "phase": "Phase 3: Rare + Supportive/Stats required block",
    "module": "Rare/Skin/Sarcoma/CUP/Other",
    "cancer": "Other",
    "topic": "CUP / IHC",
    "details": "CK7/CK20, TTF-1, PAX8, GATA3, CDX2, p40, thyroglobulin, NGS role",
    "goldenTrials": [
      "CUP Review"
    ],
    "focusTags": [
      "CUP",
      "IHC",
      "biomarker"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Rare/Supportive Readiness",
    "priority": "High",
    "legacyId": 68
  },
  {
    "key": "rare-skin-sarcoma-cup-other-net-thyroid-men-vhl-tumor-agnostic",
    "id": 69,
    "day": "Day 69",
    "phase": "Phase 3: Rare + Supportive/Stats required block",
    "module": "Rare/Skin/Sarcoma/CUP/Other",
    "cancer": "Other",
    "topic": "NET / thyroid / MEN / VHL / tumor-agnostic",
    "details": "NET grading, somatostatin analog, PRRT, NTRK/RET/MSI/TMB/BRAF",
    "goldenTrials": [
      "NETTER-1",
      "Tumor-agnostic Review"
    ],
    "focusTags": [
      "NET",
      "MEN",
      "VHL",
      "rare"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Rare/Supportive Readiness",
    "priority": "High",
    "legacyId": 69
  },
  {
    "key": "supportive-emergency-stats-oncologic-emergencies",
    "id": 70,
    "day": "Day 70",
    "phase": "Phase 3: Rare + Supportive/Stats required block",
    "module": "Supportive/Emergency/Stats",
    "cancer": "Supportive/Stats",
    "topic": "Oncologic emergencies",
    "details": "TLS, MSCC, SIADH, IICP, hypercalcemia, neutropenic fever",
    "goldenTrials": [
      "Emergency Review"
    ],
    "focusTags": [
      "emergency",
      "supportive",
      "algorithm"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Rare/Supportive Readiness",
    "priority": "High",
    "legacyId": 70
  },
  {
    "key": "supportive-emergency-stats-toxicity-mega-review",
    "id": 71,
    "day": "Day 71",
    "phase": "Phase 3: Rare + Supportive/Stats required block",
    "module": "Supportive/Emergency/Stats",
    "cancer": "Supportive/Stats",
    "topic": "Toxicity mega-review",
    "details": "ICI pneumonitis/colitis/hepatitis/endocrine/myocarditis; ADC ILD; PARPi cytopenia/MDS; TKI HTN/QTc",
    "goldenTrials": [
      "Toxicity Review"
    ],
    "focusTags": [
      "ICI",
      "ADC",
      "toxicity"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Rare/Supportive Readiness",
    "priority": "High",
    "legacyId": 71
  },
  {
    "key": "supportive-emergency-stats-statistics-endpoint-design",
    "id": 72,
    "day": "Day 72",
    "phase": "Phase 3: Rare + Supportive/Stats required block",
    "module": "Supportive/Emergency/Stats",
    "cancer": "Supportive/Stats",
    "topic": "Statistics / endpoint design",
    "details": "HR/CI/KM, ITT, non-inferiority, crossover, subgroup forest plot, OS/PFS/EFS/DFS/iDFS/pCR/MRD",
    "goldenTrials": [
      "Stats Review",
      "Endpoint Review"
    ],
    "focusTags": [
      "statistics",
      "endpoint",
      "trial interpretation"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Rare/Supportive Readiness",
    "priority": "High",
    "legacyId": 72
  },
  {
    "key": "mock-correction-112-first-full-mock",
    "id": 73,
    "day": "Day 73",
    "phase": "Phase 3: First full mock cycle",
    "module": "Mock + correction",
    "cancer": "Mock",
    "topic": "112 first full mock",
    "details": "Complete 112 full exam under timed conditions; no explanations until finished",
    "goldenTrials": [
      "112 Exam"
    ],
    "focusTags": [
      "mock",
      "112",
      "timed"
    ],
    "highYieldWeight": 3,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 73
  },
  {
    "key": "mock-correction-112-correction",
    "id": 74,
    "day": "Day 74",
    "phase": "Phase 3: First full mock cycle",
    "module": "Mock + correction",
    "cancer": "Mock",
    "topic": "112 correction",
    "details": "Classify every 112 wrong answer by error type and create cards for trial/biomarker/toxicity misses",
    "goldenTrials": [
      "112 Correction"
    ],
    "focusTags": [
      "correction",
      "error type",
      "flashcard"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 74
  },
  {
    "key": "mock-correction-113-first-full-mock",
    "id": 75,
    "day": "Day 75",
    "phase": "Phase 3: First full mock cycle",
    "module": "Mock + correction",
    "cancer": "Mock",
    "topic": "113 first full mock",
    "details": "Complete 113 full exam under timed conditions; no explanations until finished",
    "goldenTrials": [
      "113 Exam"
    ],
    "focusTags": [
      "mock",
      "113",
      "timed"
    ],
    "highYieldWeight": 3,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 75
  },
  {
    "key": "mock-correction-113-correction",
    "id": 76,
    "day": "Day 76",
    "phase": "Phase 3: First full mock cycle",
    "module": "Mock + correction",
    "cancer": "Mock",
    "topic": "113 correction",
    "details": "Classify every 113 wrong answer and add high-confidence wrong to Critical Error Queue",
    "goldenTrials": [
      "113 Correction"
    ],
    "focusTags": [
      "correction",
      "critical error",
      "flashcard"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 76
  },
  {
    "key": "mock-correction-114-first-full-mock",
    "id": 77,
    "day": "Day 77",
    "phase": "Phase 3: First full mock cycle",
    "module": "Mock + correction",
    "cancer": "Mock",
    "topic": "114 first full mock",
    "details": "Complete 114 full exam under timed conditions; no explanations until finished",
    "goldenTrials": [
      "114 Exam"
    ],
    "focusTags": [
      "mock",
      "114",
      "timed"
    ],
    "highYieldWeight": 3,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 77
  },
  {
    "key": "mock-correction-114-correction",
    "id": 78,
    "day": "Day 78",
    "phase": "Phase 3: First full mock cycle",
    "module": "Mock + correction",
    "cancer": "Mock",
    "topic": "114 correction",
    "details": "Classify every 114 wrong answer and tag score draggers by cancer/topic",
    "goldenTrials": [
      "114 Correction"
    ],
    "focusTags": [
      "correction",
      "score dragger",
      "flashcard"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 78
  },
  {
    "key": "mock-correction-mixed-correction-a",
    "id": 79,
    "day": "Day 79",
    "phase": "Phase 3: First full mock cycle",
    "module": "Mock + correction",
    "cancer": "Mock",
    "topic": "Mixed correction A",
    "details": "Repair top Lung/Breast/GI score draggers from first mock cycle",
    "goldenTrials": [
      "Weakness Review"
    ],
    "focusTags": [
      "weakness repair",
      "Lung",
      "Breast",
      "GI"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 79
  },
  {
    "key": "mock-correction-mixed-correction-b",
    "id": 80,
    "day": "Day 80",
    "phase": "Phase 3: First full mock cycle",
    "module": "Mock + correction",
    "cancer": "Mock",
    "topic": "Mixed correction B",
    "details": "Repair Heme/GU/GYN/Head & Neck score draggers from first mock cycle",
    "goldenTrials": [
      "Weakness Review"
    ],
    "focusTags": [
      "weakness repair",
      "Heme",
      "GU",
      "GYN",
      "Head & Neck"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 80
  },
  {
    "key": "mock-correction-trial-card-checkpoint",
    "id": 81,
    "day": "Day 81",
    "phase": "Phase 3: First full mock cycle",
    "module": "Mock + correction",
    "cancer": "Mock",
    "topic": "Trial card checkpoint",
    "details": "Generate or review at least 50 pivotal trial cards; endpoint recall target 85%",
    "goldenTrials": [
      "Trial Boss"
    ],
    "focusTags": [
      "trial",
      "flashcard",
      "endpoint"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Trial Boss",
    "priority": "High",
    "legacyId": 81
  },
  {
    "key": "mock-correction-first-cycle-readiness-audit",
    "id": 82,
    "day": "Day 82",
    "phase": "Phase 3: First full mock cycle",
    "module": "Mock + correction",
    "cancer": "Mock",
    "topic": "First cycle readiness audit",
    "details": "Review predicted score, volatility, red topics, and plan the weakness-only block",
    "goldenTrials": [
      "Readiness Audit"
    ],
    "focusTags": [
      "readiness",
      "volatility",
      "red topic"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 82
  },
  {
    "key": "weakness-repair-high-confidence-wrong-repair",
    "id": 83,
    "day": "Day 83",
    "phase": "Phase 4: Weakness repair only",
    "module": "Weakness Repair",
    "cancer": "Weakness Repair",
    "topic": "High-confidence wrong repair",
    "details": "Redo every high-confidence wrong; write why the wrong choice felt attractive.",
    "goldenTrials": [
      "Weakness Review"
    ],
    "focusTags": [
      "wrongRate >=50",
      "mastery <=2",
      "high-confidence wrong",
      "repeated wrong"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 83
  },
  {
    "key": "weakness-repair-wrong-rate-50-lung-breast-gi",
    "id": 84,
    "day": "Day 84",
    "phase": "Phase 4: Weakness repair only",
    "module": "Weakness Repair",
    "cancer": "Weakness Repair",
    "topic": "Wrong-rate >=50% Lung/Breast/GI",
    "details": "Only Lung/Breast/GI score draggers with wrong-rate >=50%.",
    "goldenTrials": [
      "Weakness Review"
    ],
    "focusTags": [
      "wrongRate >=50",
      "mastery <=2",
      "high-confidence wrong",
      "repeated wrong"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 84
  },
  {
    "key": "weakness-repair-wrong-rate-50-gu-gyn-heme-head-and-neck",
    "id": 85,
    "day": "Day 85",
    "phase": "Phase 4: Weakness repair only",
    "module": "Weakness Repair",
    "cancer": "Weakness Repair",
    "topic": "Wrong-rate >=50% GU/GYN/Heme/Head & Neck",
    "details": "Repair second-tier score draggers from GU, GYN, Heme, and Head & Neck.",
    "goldenTrials": [
      "Weakness Review"
    ],
    "focusTags": [
      "wrongRate >=50",
      "mastery <=2",
      "high-confidence wrong",
      "repeated wrong"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 85
  },
  {
    "key": "weakness-repair-trial-endpoint-repair",
    "id": 86,
    "day": "Day 86",
    "phase": "Phase 4: Weakness repair only",
    "module": "Weakness Repair",
    "cancer": "Weakness Repair",
    "topic": "Trial endpoint repair",
    "details": "Turn every Trial confusion miss into a Trial Card.",
    "goldenTrials": [
      "Weakness Review"
    ],
    "focusTags": [
      "wrongRate >=50",
      "mastery <=2",
      "high-confidence wrong",
      "repeated wrong"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 86
  },
  {
    "key": "weakness-repair-biomarker-cutoff-repair",
    "id": 87,
    "day": "Day 87",
    "phase": "Phase 4: Weakness repair only",
    "module": "Weakness Repair",
    "cancer": "Weakness Repair",
    "topic": "Biomarker cutoff repair",
    "details": "Repair PD-L1 CPS/TPS, HER2, MSI/dMMR, BRCA/HRD, RAS/BRAF, FGFR, and FRalpha cutoffs.",
    "goldenTrials": [
      "Weakness Review"
    ],
    "focusTags": [
      "wrongRate >=50",
      "mastery <=2",
      "high-confidence wrong",
      "repeated wrong"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 87
  },
  {
    "key": "weakness-repair-toxicity-repair",
    "id": 88,
    "day": "Day 88",
    "phase": "Phase 4: Weakness repair only",
    "module": "Weakness Repair",
    "cancer": "Weakness Repair",
    "topic": "Toxicity repair",
    "details": "Repair ICI, ADC, PARPi, TKI, CDK4/6, and EV toxicity traps.",
    "goldenTrials": [
      "Weakness Review"
    ],
    "focusTags": [
      "wrongRate >=50",
      "mastery <=2",
      "high-confidence wrong",
      "repeated wrong"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 88
  },
  {
    "key": "weakness-repair-statistics-and-trial-interpretation-repair",
    "id": 89,
    "day": "Day 89",
    "phase": "Phase 4: Weakness repair only",
    "module": "Weakness Repair",
    "cancer": "Weakness Repair",
    "topic": "Statistics and trial interpretation repair",
    "details": "Repair HR/CI, non-inferiority, subgroup, crossover, and endpoint definition misses.",
    "goldenTrials": [
      "Weakness Review"
    ],
    "focusTags": [
      "wrongRate >=50",
      "mastery <=2",
      "high-confidence wrong",
      "repeated wrong"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 89
  },
  {
    "key": "weakness-repair-algorithm-blank-recall-boss-rematch",
    "id": 90,
    "day": "Day 90",
    "phase": "Phase 4: Weakness repair only",
    "module": "Weakness Repair",
    "cancer": "Weakness Repair",
    "topic": "Algorithm blank recall + Boss rematch",
    "details": "Retry all failed Boss prompts and fill missing algorithm cards.",
    "goldenTrials": [
      "Weakness Review"
    ],
    "focusTags": [
      "wrongRate >=50",
      "mastery <=2",
      "high-confidence wrong",
      "repeated wrong"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 90
  },
  {
    "key": "mock-correction-112-full-mock-retest",
    "id": 91,
    "day": "Day 91",
    "phase": "Phase 5: Second full mock cycle",
    "module": "Mock + correction",
    "cancer": "Mock",
    "topic": "112 full mock retest",
    "details": "Retest 112; require wrong-retest conversion trend toward 90%",
    "goldenTrials": [
      "112 Retest"
    ],
    "focusTags": [
      "mock",
      "retest",
      "112"
    ],
    "highYieldWeight": 3,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 91
  },
  {
    "key": "mock-correction-113-full-mock-retest",
    "id": 92,
    "day": "Day 92",
    "phase": "Phase 5: Second full mock cycle",
    "module": "Mock + correction",
    "cancer": "Mock",
    "topic": "113 full mock retest",
    "details": "Retest 113 and compare score volatility with first cycle",
    "goldenTrials": [
      "113 Retest"
    ],
    "focusTags": [
      "mock",
      "retest",
      "113"
    ],
    "highYieldWeight": 3,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 92
  },
  {
    "key": "mock-correction-114-full-mock-retest",
    "id": 93,
    "day": "Day 93",
    "phase": "Phase 5: Second full mock cycle",
    "module": "Mock + correction",
    "cancer": "Mock",
    "topic": "114 full mock retest",
    "details": "Retest 114; all high-confidence wrong must become cards or review tasks",
    "goldenTrials": [
      "114 Retest"
    ],
    "focusTags": [
      "mock",
      "retest",
      "114"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 93
  },
  {
    "key": "mock-correction-wrong-retest-90-checkpoint",
    "id": 94,
    "day": "Day 94",
    "phase": "Phase 5: Second full mock cycle",
    "module": "Mock + correction",
    "cancer": "Mock",
    "topic": "Wrong-retest 90 checkpoint",
    "details": "Only previously wrong questions; target wrong-retest conversion >=90%",
    "goldenTrials": [
      "Wrong Retest"
    ],
    "focusTags": [
      "wrong retest",
      "critical error",
      "mastery"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 94
  },
  {
    "key": "mock-correction-mixed-retest-correction",
    "id": 95,
    "day": "Day 95",
    "phase": "Phase 5: Second full mock cycle",
    "module": "Mock + correction",
    "cancer": "Mock",
    "topic": "Mixed retest correction",
    "details": "Repair any remaining red topics after 112-114 retest and regenerate cards for persistent misses",
    "goldenTrials": [
      "Mixed Correction"
    ],
    "focusTags": [
      "correction",
      "red topic",
      "flashcard"
    ],
    "highYieldWeight": 3,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 95
  },
  {
    "key": "mock-correction-final-readiness-lock",
    "id": 96,
    "day": "Day 96",
    "phase": "Phase 5: Second full mock cycle",
    "module": "Mock + correction",
    "cancer": "Mock",
    "topic": "Final readiness lock",
    "details": "Confirm latest score trend, high-confidence wrong rate, and wrong-retest conversion before final rapid recall",
    "goldenTrials": [
      "Readiness Audit"
    ],
    "focusTags": [
      "readiness",
      "wrong retest",
      "volatility"
    ],
    "highYieldWeight": 3,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 96
  },
  {
    "key": "mock-correction-final-board-boss",
    "id": 97,
    "day": "Day 97",
    "phase": "Phase 5: Second full mock cycle",
    "module": "Mock + correction",
    "cancer": "Mock",
    "topic": "Final Board Boss",
    "details": "Mixed board boss: latest full mock >=75% and wrong-retest >=90%",
    "goldenTrials": [
      "Final Board Boss"
    ],
    "focusTags": [
      "boss",
      "mock",
      "readiness"
    ],
    "highYieldWeight": 3,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 97
  },
  {
    "key": "final-review-golden-trial-rapid-recall",
    "id": 98,
    "day": "Day 98",
    "phase": "Phase 6: Final rapid recall",
    "module": "Final Review",
    "cancer": "Final Review",
    "topic": "Golden trial rapid recall",
    "details": "Blank recall population/intervention/endpoint/result for all golden trials",
    "goldenTrials": [
      "Golden Trial Recall"
    ],
    "focusTags": [
      "trial",
      "endpoint",
      "rapid recall"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 98
  },
  {
    "key": "final-review-biomarker-and-toxicity-rapid-recall",
    "id": 99,
    "day": "Day 99",
    "phase": "Phase 6: Final rapid recall",
    "module": "Final Review",
    "cancer": "Final Review",
    "topic": "Biomarker and toxicity rapid recall",
    "details": "MSI/dMMR, PD-L1 CPS/TPS, HER2, BRCA/HRD, NTRK/RET, ADC/ICI/PARPi/TKI toxicity",
    "goldenTrials": [
      "Biomarker Review",
      "Toxicity Review"
    ],
    "focusTags": [
      "biomarker",
      "toxicity",
      "rapid recall"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 99
  },
  {
    "key": "final-review-algorithm-final-sprint",
    "id": 100,
    "day": "Day 100",
    "phase": "Phase 6: Final rapid recall",
    "module": "Final Review",
    "cancer": "Final Review",
    "topic": "Algorithm final sprint",
    "details": "NSCLC, Breast, GI, GU, GYN, Heme sequencing flowcharts from memory",
    "goldenTrials": [
      "Algorithm Recall"
    ],
    "focusTags": [
      "algorithm",
      "rapid recall",
      "final review"
    ],
    "highYieldWeight": 5,
    "completionCriteria": [
      "Daily Practice completed",
      "Boss 1-3 at least 2 pass",
      "Create 3-5 high-value cards",
      "Wrong answers classified by errorType"
    ],
    "requiredQuestionIds": [],
    "bossUnlockContribution": "Final Board Boss",
    "priority": "High",
    "legacyId": 100
  }
];

export function buildStudyPlan100() {
  return STUDY_PLAN_100_BASE.map((task) => ({
    ...task,
    legacyId: task.legacyId || task.id,
  }));
}

export const studyPlan100 = buildStudyPlan100();

export function getStudyPlanTaskKey(task = {}) {
  return task.key || (task.id == null ? null : `day-${task.id}`);
}

export function getStudyPlanTaskById(taskId, fallback = null) {
  if (taskId == null) return fallback;
  const idText = String(taskId);
  return studyPlan100.find((task) => task.key === idText)
    || studyPlan100.find((task) => String(task.id) === idText)
    || studyPlan100.find((task) => String(task.legacyId) === idText)
    || fallback;
}

export function isPlanTaskComplete(planProgress = {}, task) {
  if (!task) return false;
  return Boolean(planProgress?.[task.key] || planProgress?.[task.id] || planProgress?.[task.legacyId]);
}

export function normalizePlanProgress(planProgress = {}) {
  if (!planProgress || typeof planProgress !== 'object' || Array.isArray(planProgress)) return {};
  return studyPlan100.reduce((acc, task) => {
    if (planProgress[task.key] || planProgress[task.id] || planProgress[task.legacyId]) {
      acc[task.key] = true;
      acc[task.id] = true;
      acc[task.legacyId] = true;
    }
    return acc;
  }, {});
}
