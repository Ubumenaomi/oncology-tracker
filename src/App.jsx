import React, { useEffect, useMemo, useState } from 'react';
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
const TODAY = new Date().toISOString().slice(0, 10);

const defaultState = {
  sessions: {},
  stats: {},
  settings: {
    dailyCount: 12,
    preferredYears: [112, 113, 114],
    preferredCancers: [],
  },
  planProgress: {},
  cloudMeta: {
    updatedAt: null,
    device: null,
  },
};

const studyPlan100 = [
  {
    "id": 1,
    "day": "Day 1",
    "cancer": "Lung",
    "topic": "NSCLC 基礎架構",
    "details": "TNM staging、resectability、molecular testing、PD-L1 interpretation",
    "goldenTrials": [
      "NCCN Algorithm"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 2,
    "day": "Day 2",
    "cancer": "Lung",
    "topic": "EGFR early NSCLC",
    "details": "adjuvant osimertinib、EGFR exon 19 deletion / L858R、post-op chemo 角色",
    "goldenTrials": [
      "ADAURA"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 3,
    "day": "Day 3",
    "cancer": "Lung",
    "topic": "Unresectable stage III NSCLC",
    "details": "CCRT 後 consolidation、durvalumab eligibility、PFS/OS endpoint",
    "goldenTrials": [
      "PACIFIC"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 4,
    "day": "Day 4",
    "cancer": "Lung",
    "topic": "Neoadjuvant IO",
    "details": "resectable NSCLC neoadjuvant chemo-IO、pCR/MPR/EFS 定義",
    "goldenTrials": [
      "CheckMate 816"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 5,
    "day": "Day 5",
    "cancer": "Lung",
    "topic": "Perioperative IO",
    "details": "neoadjuvant + adjuvant pembrolizumab、stage II–IIIB、EFS/OS",
    "goldenTrials": [
      "KEYNOTE-671"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 6,
    "day": "Day 6",
    "cancer": "Lung",
    "topic": "Adjuvant IO",
    "details": "postoperative atezolizumab / pembrolizumab、PD-L1 cutoff、EGFR/ALK exclusion",
    "goldenTrials": [
      "IMpower010",
      "KEYNOTE-091"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 7,
    "day": "Day 7",
    "cancer": "Lung",
    "topic": "Metastatic nonsquamous NSCLC",
    "details": "IO + platinum/pemetrexed、bevacizumab-containing regimen、PD-L1 高低",
    "goldenTrials": [
      "KEYNOTE-189",
      "IMpower150"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 8,
    "day": "Day 8",
    "cancer": "Lung",
    "topic": "Metastatic squamous NSCLC",
    "details": "IO + platinum/taxane、PD-L1 ≥50% monotherapy、contraindications",
    "goldenTrials": [
      "KEYNOTE-407"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 9,
    "day": "Day 9",
    "cancer": "Lung",
    "topic": "Dual IO / short-course chemo",
    "details": "nivolumab + ipilimumab + 2-cycle chemo、toxicity",
    "goldenTrials": [
      "CheckMate 9LA"
    ],
    "priority": "Medium",
    "completed": false
  },
  {
    "id": 10,
    "day": "Day 10",
    "cancer": "Lung",
    "topic": "EGFR advanced first-line",
    "details": "osimertinib ± chemotherapy、amivantamab/lazertinib、PFS/OS",
    "goldenTrials": [
      "FLAURA",
      "FLAURA2",
      "MARIPOSA"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 11,
    "day": "Day 11",
    "cancer": "Lung",
    "topic": "EGFR post-osimertinib",
    "details": "resistance biopsy、small cell transformation、amivantamab + chemo",
    "goldenTrials": [
      "MARIPOSA-2",
      "KEYNOTE-789"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 12,
    "day": "Day 12",
    "cancer": "Lung",
    "topic": "ALK rearranged NSCLC",
    "details": "alectinib/brigatinib/lorlatinib、CNS efficacy、lorlatinib toxicity",
    "goldenTrials": [
      "ALEX",
      "CROWN"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 13,
    "day": "Day 13",
    "cancer": "Lung",
    "topic": "Other actionable mutations",
    "details": "KRAS G12C、MET exon14、RET、NTRK、HER2 mutation treatment",
    "goldenTrials": [
      "CodeBreaK",
      "LIBRETTO-001",
      "DESTINY-Lung"
    ],
    "priority": "Medium",
    "completed": false
  },
  {
    "id": 14,
    "day": "Day 14",
    "cancer": "Lung",
    "topic": "SCLC first-line",
    "details": "extensive-stage SCLC chemo-IO、maintenance IO",
    "goldenTrials": [
      "IMpower133",
      "CASPIAN"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 15,
    "day": "Day 15",
    "cancer": "Lung",
    "topic": "CNS / leptomeningeal disease",
    "details": "EGFR CNS penetration、osimertinib、radiation sequencing",
    "goldenTrials": [
      "BLOOM",
      "FLAURA CNS"
    ],
    "priority": "Medium",
    "completed": false
  },
  {
    "id": 16,
    "day": "Day 16",
    "cancer": "Lung",
    "topic": "Lung pathology / IHC",
    "details": "TTF-1、p40、Napsin A、CDX2、INSM1、mesothelioma markers",
    "goldenTrials": [
      "IHC Review"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 17,
    "day": "Day 17",
    "cancer": "Lung",
    "topic": "Lung toxicity management",
    "details": "ILD/pneumonitis、EGFR-TKI、ICI、T-DXd、radiation pneumonitis",
    "goldenTrials": [
      "Toxicity Review"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 18,
    "day": "Day 18",
    "cancer": "Lung",
    "topic": "112–114 Lung questions",
    "details": "完成 lung 題庫與錯題標記",
    "goldenTrials": [
      "Question Bank"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 19,
    "day": "Day 19",
    "cancer": "Lung",
    "topic": "Lung rapid recall",
    "details": "演練 treatment sequencing 與 trial endpoint blank recall",
    "goldenTrials": [
      "Golden Trial Recall"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 20,
    "day": "Day 20",
    "cancer": "Lung",
    "topic": "Lung mock exam",
    "details": "Lung full mock + 錯題匯入 Review Queue",
    "goldenTrials": [
      "Mock Exam"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 21,
    "day": "Day 21",
    "cancer": "Breast",
    "topic": "Early HR+/HER2−",
    "details": "Oncotype DX、MammaPrint、PAM50、EndoPredict、adjuvant chemo decision",
    "goldenTrials": [
      "TAILORx",
      "RxPONDER"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 22,
    "day": "Day 22",
    "cancer": "Breast",
    "topic": "Adjuvant CDK4/6",
    "details": "high-risk definition、abemaciclib/ribociclib、duration/toxicity",
    "goldenTrials": [
      "monarchE",
      "NATALEE"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 23,
    "day": "Day 23",
    "cancer": "Breast",
    "topic": "gBRCA early breast cancer",
    "details": "OlympiA eligibility、TNBC vs HR+ high-risk criteria、EFS/OS",
    "goldenTrials": [
      "OlympiA"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 24,
    "day": "Day 24",
    "cancer": "Breast",
    "topic": "Metastatic HR+/HER2− first-line",
    "details": "OFS、AI/fulvestrant + CDK4/6、visceral crisis distinction",
    "goldenTrials": [
      "PALOMA",
      "MONALEESA",
      "MONARCH"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 25,
    "day": "Day 25",
    "cancer": "Breast",
    "topic": "Post-CDK4/6 sequencing",
    "details": "ESR1、PIK3CA、AKT/PTEN、SERD、PI3K/AKT inhibitor",
    "goldenTrials": [
      "SOLAR-1",
      "CAPItello-291",
      "EMERALD"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 26,
    "day": "Day 26",
    "cancer": "Breast",
    "topic": "HER2+ early adjuvant",
    "details": "trastuzumab、pertuzumab、node-positive benefit",
    "goldenTrials": [
      "APHINITY"
    ],
    "priority": "Medium",
    "completed": false
  },
  {
    "id": 27,
    "day": "Day 27",
    "cancer": "Breast",
    "topic": "HER2+ residual disease",
    "details": "non-pCR after neoadjuvant therapy、adjuvant T-DM1",
    "goldenTrials": [
      "KATHERINE"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 28,
    "day": "Day 28",
    "cancer": "Breast",
    "topic": "HER2+ metastatic first-line",
    "details": "taxane + trastuzumab + pertuzumab、OS benefit",
    "goldenTrials": [
      "CLEOPATRA"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 29,
    "day": "Day 29",
    "cancer": "Breast",
    "topic": "HER2+ metastatic second-line",
    "details": "T-DXd vs T-DM1、ILD/pneumonitis risk",
    "goldenTrials": [
      "DESTINY-Breast03"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 30,
    "day": "Day 30",
    "cancer": "Breast",
    "topic": "HER2-low / HER2-ultralow",
    "details": "definition、ADC sequencing、ER+ and TNBC application",
    "goldenTrials": [
      "DESTINY-Breast04",
      "DESTINY-Breast06"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 31,
    "day": "Day 31",
    "cancer": "Breast",
    "topic": "TNBC neoadjuvant IO",
    "details": "KEYNOTE-522 schema、pCR/EFS/OS、adjuvant pembrolizumab",
    "goldenTrials": [
      "KEYNOTE-522"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 32,
    "day": "Day 32",
    "cancer": "Breast",
    "topic": "TNBC metastatic ADC",
    "details": "sacituzumab govitecan、TROP2 ADC、toxicity",
    "goldenTrials": [
      "ASCENT",
      "TROPION-Breast01"
    ],
    "priority": "Medium",
    "completed": false
  },
  {
    "id": 33,
    "day": "Day 33",
    "cancer": "Breast",
    "topic": "Breast CNS metastasis",
    "details": "HER2+ CNS regimen、tucatinib、T-DXd CNS data、LMD",
    "goldenTrials": [
      "HER2CLIMB"
    ],
    "priority": "Medium",
    "completed": false
  },
  {
    "id": 34,
    "day": "Day 34",
    "cancer": "Breast",
    "topic": "Endocrine resistance",
    "details": "primary vs secondary resistance、mTOR、SERD、sequencing",
    "goldenTrials": [
      "BOLERO-2",
      "EMERALD"
    ],
    "priority": "Medium",
    "completed": false
  },
  {
    "id": 35,
    "day": "Day 35",
    "cancer": "Breast",
    "topic": "Breast biomarkers",
    "details": "ER/PR/HER2 interpretation、FISH、germline BRCA、PIK3CA、ESR1",
    "goldenTrials": [
      "Biomarker Review"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 36,
    "day": "Day 36",
    "cancer": "Breast",
    "topic": "Breast toxicity",
    "details": "CDK4/6 neutropenia/diarrhea、PI3K hyperglycemia、ADC ILD",
    "goldenTrials": [
      "Toxicity Review"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 37,
    "day": "Day 37",
    "cancer": "Breast",
    "topic": "Breast local therapy",
    "details": "RT omission criteria、AMAROS、hypofractionation、boost",
    "goldenTrials": [
      "CALGB 9343",
      "AMAROS"
    ],
    "priority": "Medium",
    "completed": false
  },
  {
    "id": 38,
    "day": "Day 38",
    "cancer": "Breast",
    "topic": "112–114 Breast questions",
    "details": "完成 breast 題庫與錯題標記",
    "goldenTrials": [
      "Question Bank"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 39,
    "day": "Day 39",
    "cancer": "Breast",
    "topic": "Breast rapid recall",
    "details": "HER2/TNBC/HR+ treatment map blank recall",
    "goldenTrials": [
      "Golden Trial Recall"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 40,
    "day": "Day 40",
    "cancer": "Breast",
    "topic": "Breast mock exam",
    "details": "Breast full mock + 錯題匯入 Review Queue",
    "goldenTrials": [
      "Mock Exam"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 41,
    "day": "Day 41",
    "cancer": "GU",
    "topic": "mHSPC treatment intensification",
    "details": "ADT + ARPI ± docetaxel、high-volume/high-risk",
    "goldenTrials": [
      "LATITUDE",
      "STAMPEDE",
      "ARASENS"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 42,
    "day": "Day 42",
    "cancer": "GU",
    "topic": "mCRPC sequencing",
    "details": "post-ARPI、taxane、PARPi、radioligand、cross-resistance",
    "goldenTrials": [
      "CARD",
      "PROfound"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 43,
    "day": "Day 43",
    "cancer": "GU",
    "topic": "PARPi + ARPI",
    "details": "mCRPC first-line combination、HRR/BRCA subgroup、toxicity",
    "goldenTrials": [
      "PROpel",
      "TALAPRO-2",
      "MAGNITUDE"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 44,
    "day": "Day 44",
    "cancer": "GU",
    "topic": "PSMA radioligand therapy",
    "details": "Lu177-PSMA indication、PSMA PET、OS/PFS、marrow toxicity",
    "goldenTrials": [
      "VISION"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 45,
    "day": "Day 45",
    "cancer": "GU",
    "topic": "RCC metastatic IO combinations",
    "details": "IO-IO vs IO-TKI、risk group、toxicity",
    "goldenTrials": [
      "CheckMate-214",
      "KEYNOTE-426",
      "CLEAR"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 46,
    "day": "Day 46",
    "cancer": "GU",
    "topic": "RCC adjuvant therapy",
    "details": "clear cell RCC risk、adjuvant pembrolizumab OS",
    "goldenTrials": [
      "KEYNOTE-564"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 47,
    "day": "Day 47",
    "cancer": "GU",
    "topic": "Urothelial carcinoma",
    "details": "maintenance avelumab、EV、FGFR inhibitor、Nectin-4",
    "goldenTrials": [
      "JAVELIN Bladder 100",
      "EV-301",
      "THOR"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 48,
    "day": "Day 48",
    "cancer": "GU",
    "topic": "Testicular cancer",
    "details": "seminoma stage I surveillance、carboplatin AUC7、RT",
    "goldenTrials": [
      "Seminoma Review"
    ],
    "priority": "Medium",
    "completed": false
  },
  {
    "id": 49,
    "day": "Day 49",
    "cancer": "GU",
    "topic": "GU question bank",
    "details": "完成 GU 題庫與錯題標記",
    "goldenTrials": [
      "Question Bank"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 50,
    "day": "Day 50",
    "cancer": "GU",
    "topic": "GU mock exam",
    "details": "GU full mock + 錯題匯入 Review Queue",
    "goldenTrials": [
      "Mock Exam"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 51,
    "day": "Day 51",
    "cancer": "GYN",
    "topic": "Endometrial cancer basics",
    "details": "MMR/MSI、histology、advanced/recurrent treatment backbone",
    "goldenTrials": [
      "GYN Algorithm"
    ],
    "priority": "Medium",
    "completed": false
  },
  {
    "id": 52,
    "day": "Day 52",
    "cancer": "GYN",
    "topic": "Endometrial first-line IO",
    "details": "dostarlimab + carbo/paclitaxel、dMMR vs overall population",
    "goldenTrials": [
      "RUBY"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 53,
    "day": "Day 53",
    "cancer": "GYN",
    "topic": "Pembrolizumab in endometrial cancer",
    "details": "pMMR/dMMR cohorts、maintenance design",
    "goldenTrials": [
      "NRG-GY018"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 54,
    "day": "Day 54",
    "cancer": "GYN",
    "topic": "Durvalumab in endometrial cancer",
    "details": "DUO-E design、durvalumab ± olaparib maintenance",
    "goldenTrials": [
      "DUO-E"
    ],
    "priority": "Medium",
    "completed": false
  },
  {
    "id": 55,
    "day": "Day 55",
    "cancer": "GYN",
    "topic": "Cervical cancer metastatic",
    "details": "pembrolizumab + chemo ± bevacizumab、PD-L1 CPS",
    "goldenTrials": [
      "KEYNOTE-826"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 56,
    "day": "Day 56",
    "cancer": "GYN",
    "topic": "Cervical cancer locally advanced",
    "details": "pembrolizumab + CCRT、PFS/OS、CALLA contrast",
    "goldenTrials": [
      "KEYNOTE-A18",
      "CALLA"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 57,
    "day": "Day 57",
    "cancer": "GYN",
    "topic": "Ovarian maintenance",
    "details": "BRCA/HRD、olaparib、niraparib、bevacizumab combination",
    "goldenTrials": [
      "SOLO-1",
      "PAOLA-1",
      "PRIMA"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 58,
    "day": "Day 58",
    "cancer": "GYN",
    "topic": "PARPi toxicity / resistance",
    "details": "anemia、MDS/AML risk、maintenance duration、HRD interpretation",
    "goldenTrials": [
      "PARPi Review"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 59,
    "day": "Day 59",
    "cancer": "GYN",
    "topic": "GYN question bank",
    "details": "完成 GYN 題庫與錯題標記",
    "goldenTrials": [
      "Question Bank"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 60,
    "day": "Day 60",
    "cancer": "GYN",
    "topic": "GYN mock exam",
    "details": "GYN full mock + 錯題匯入 Review Queue",
    "goldenTrials": [
      "Mock Exam"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 61,
    "day": "Day 61",
    "cancer": "Head & Neck",
    "topic": "HPV OPSCC",
    "details": "AJCC staging、cisplatin vs cetuximab、de-escalation pitfalls",
    "goldenTrials": [
      "RTOG 1016",
      "De-ESCALaTE"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 62,
    "day": "Day 62",
    "cancer": "Head & Neck",
    "topic": "Definitive / adjuvant CCRT",
    "details": "cisplatin schedule、high-risk features、ENE/positive margin",
    "goldenTrials": [
      "JCOG1008",
      "RTOG 9501"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 63,
    "day": "Day 63",
    "cancer": "Head & Neck",
    "topic": "R/M HNSCC first-line",
    "details": "PD-L1 CPS、pembrolizumab mono vs chemo-IO",
    "goldenTrials": [
      "KEYNOTE-048"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 64,
    "day": "Day 64",
    "cancer": "Head & Neck",
    "topic": "EXTREME and second-line",
    "details": "cetuximab + platinum/5FU、nivolumab、afatinib、methotrexate",
    "goldenTrials": [
      "EXTREME",
      "CheckMate 141",
      "KEYNOTE-040"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 65,
    "day": "Day 65",
    "cancer": "Head & Neck",
    "topic": "NPC systemic therapy",
    "details": "induction GP、R/M NPC chemo-IO、EBV",
    "goldenTrials": [
      "JUPITER-02",
      "CAPTAIN-1st",
      "GEM20110714"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 66,
    "day": "Day 66",
    "cancer": "Head & Neck",
    "topic": "Salivary / thyroid / skin cancer",
    "details": "NGS/druggable mutation、lenvatinib、cemiplimab",
    "goldenTrials": [
      "SELECT",
      "LIBRETTO"
    ],
    "priority": "Medium",
    "completed": false
  },
  {
    "id": 67,
    "day": "Day 67",
    "cancer": "Head & Neck",
    "topic": "H&N mock exam",
    "details": "H&N full mock + 錯題匯入 Review Queue",
    "goldenTrials": [
      "Mock Exam"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 68,
    "day": "Day 68",
    "cancer": "GI",
    "topic": "Esophageal/gastric basics",
    "details": "histology、HER2、PD-L1 CPS、MSI/dMMR、CLDN18.2",
    "goldenTrials": [
      "GI Biomarker Review"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 69,
    "day": "Day 69",
    "cancer": "GI",
    "topic": "Gastric first-line IO",
    "details": "HER2-negative advanced gastric/GEJ、nivolumab + chemo",
    "goldenTrials": [
      "CheckMate-649",
      "KEYNOTE-859"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 70,
    "day": "Day 70",
    "cancer": "GI",
    "topic": "Esophageal IO",
    "details": "ESCC chemo-IO vs dual IO、TPS/CPS、PFS/OS interpretation",
    "goldenTrials": [
      "KEYNOTE-590",
      "CheckMate-648"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 71,
    "day": "Day 71",
    "cancer": "GI",
    "topic": "HER2+ gastric cancer",
    "details": "trastuzumab first-line、pembrolizumab add-on、T-DXd後線",
    "goldenTrials": [
      "ToGA",
      "KEYNOTE-811",
      "DESTINY-Gastric"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 72,
    "day": "Day 72",
    "cancer": "GI",
    "topic": "BRAF V600E CRC",
    "details": "encorafenib + cetuximab ± chemo、first-line BREAKWATER",
    "goldenTrials": [
      "BEACON",
      "BREAKWATER"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 73,
    "day": "Day 73",
    "cancer": "GI",
    "topic": "Rectal cancer",
    "details": "TNT、PROSPECT、dMMR dostarlimab、watch-and-wait",
    "goldenTrials": [
      "PROSPECT",
      "OPRA",
      "Dostarlimab dMMR rectal"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 74,
    "day": "Day 74",
    "cancer": "GI",
    "topic": "HCC systemic therapy",
    "details": "atezo/bev、durva/treme、durvalumab mono、TACE combination",
    "goldenTrials": [
      "IMbrave150",
      "HIMALAYA",
      "EMERALD-1"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 75,
    "day": "Day 75",
    "cancer": "GI",
    "topic": "GI mock exam",
    "details": "GI full mock + 錯題匯入 Review Queue",
    "goldenTrials": [
      "Mock Exam"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 76,
    "day": "Day 76",
    "cancer": "Heme",
    "topic": "AML/MDS essentials",
    "details": "response criteria、blast cutoff、MRD、venetoclax/HMA",
    "goldenTrials": [
      "AML Review"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 77,
    "day": "Day 77",
    "cancer": "Heme",
    "topic": "Hodgkin lymphoma",
    "details": "ABVD、A+AVD、interim PET、BV consolidation",
    "goldenTrials": [
      "ECHELON-1",
      "AETHERA"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 78,
    "day": "Day 78",
    "cancer": "Heme",
    "topic": "CAR-T / DLBCL",
    "details": "CD19 CAR-T、CRS、ICANS、tocilizumab vs steroid",
    "goldenTrials": [
      "ZUMA-1",
      "JULIET",
      "TRANSFORM"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 79,
    "day": "Day 79",
    "cancer": "Heme",
    "topic": "Multiple myeloma",
    "details": "SLiM-CRAB、risk cytogenetics、VRd/DRd/D-VTd",
    "goldenTrials": [
      "MAIA",
      "GRIFFIN",
      "PERSEUS"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 80,
    "day": "Day 80",
    "cancer": "Heme",
    "topic": "ALL/CML essentials",
    "details": "Ph+ ALL、TKI、CML milestones、T315I",
    "goldenTrials": [
      "CML Review"
    ],
    "priority": "Medium",
    "completed": false
  },
  {
    "id": 81,
    "day": "Day 81",
    "cancer": "Melanoma/Sarcoma",
    "topic": "Melanoma adjuvant/metastatic IO",
    "details": "PD-1、ipi/nivo、relatlimab、BRAF/MEK",
    "goldenTrials": [
      "KEYNOTE-054",
      "CheckMate 238",
      "RELATIVITY-047"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 82,
    "day": "Day 82",
    "cancer": "Melanoma/Sarcoma",
    "topic": "Uveal melanoma",
    "details": "HLA-A*02:01、gp100 bispecific、liver metastasis",
    "goldenTrials": [
      "Tebentafusp Phase III"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 83,
    "day": "Day 83",
    "cancer": "Melanoma/Sarcoma",
    "topic": "Sarcoma / GIST",
    "details": "pazopanib、imatinib-sensitive GIST、subtype caveat",
    "goldenTrials": [
      "PALETTE"
    ],
    "priority": "Medium",
    "completed": false
  },
  {
    "id": 84,
    "day": "Day 84",
    "cancer": "Supportive/Stats",
    "topic": "Supportive care",
    "details": "febrile neutropenia、MASCC、bone agents、terminal secretion",
    "goldenTrials": [
      "IDSA/NCCN Supportive"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 85,
    "day": "Day 85",
    "cancer": "Supportive/Stats",
    "topic": "Mini mock",
    "details": "Heme/Melanoma/Supportive mixed mock",
    "goldenTrials": [
      "Mock Exam"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 86,
    "day": "Day 86",
    "cancer": "Supportive/Stats",
    "topic": "ICI toxicity",
    "details": "pneumonitis、colitis、hepatitis、endocrinopathy、myocarditis",
    "goldenTrials": [
      "irAE Review"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 87,
    "day": "Day 87",
    "cancer": "Supportive/Stats",
    "topic": "Biomarker mega-review",
    "details": "MSI/dMMR、PD-L1 CPS/TPS、HER2、BRCA/HRD、NTRK/RET",
    "goldenTrials": [
      "Biomarker Review"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 88,
    "day": "Day 88",
    "cancer": "Supportive/Stats",
    "topic": "Targeted therapy toxicity",
    "details": "ADC、TKI、PARPi、CDK4/6、PI3K/AKT toxicity",
    "goldenTrials": [
      "Toxicity Review"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 89,
    "day": "Day 89",
    "cancer": "Supportive/Stats",
    "topic": "Pathology/IHC rapid review",
    "details": "CUP、lung vs GI vs H&N、lymphoma markers",
    "goldenTrials": [
      "IHC Review"
    ],
    "priority": "Medium",
    "completed": false
  },
  {
    "id": 90,
    "day": "Day 90",
    "cancer": "Supportive/Stats",
    "topic": "Statistics/trial interpretation",
    "details": "KM curve、HR、CI、non-inferiority、ITT、subgroup forest plot",
    "goldenTrials": [
      "Stats Review"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 91,
    "day": "Day 91",
    "cancer": "Mock",
    "topic": "112 full mock",
    "details": "完整作答 112 年考題 120 題",
    "goldenTrials": [
      "112 Exam"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 92,
    "day": "Day 92",
    "cancer": "Mock",
    "topic": "112 correction",
    "details": "112 錯題詳解、錯因分類、加入 Review Queue",
    "goldenTrials": [
      "112 Correction"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 93,
    "day": "Day 93",
    "cancer": "Mock",
    "topic": "113 full mock",
    "details": "完整作答 113 年考題 120 題",
    "goldenTrials": [
      "113 Exam"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 94,
    "day": "Day 94",
    "cancer": "Mock",
    "topic": "113 correction",
    "details": "113 錯題詳解、錯因分類、加入 Review Queue",
    "goldenTrials": [
      "113 Correction"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 95,
    "day": "Day 95",
    "cancer": "Mock",
    "topic": "114 full mock",
    "details": "完整作答 114 年考題 120 題",
    "goldenTrials": [
      "114 Exam"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 96,
    "day": "Day 96",
    "cancer": "Mock",
    "topic": "114 correction",
    "details": "114 錯題詳解、錯因分類、加入 Review Queue",
    "goldenTrials": [
      "114 Correction"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 97,
    "day": "Day 97",
    "cancer": "Final Review",
    "topic": "Golden trial recall",
    "details": "所有癌別 golden trial endpoint / population / HR blank recall",
    "goldenTrials": [
      "Golden Trial Recall"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 98,
    "day": "Day 98",
    "cancer": "Final Review",
    "topic": "Algorithm recall",
    "details": "NSCLC/Breast/GU/GYN/GI treatment sequencing flowchart",
    "goldenTrials": [
      "Algorithm Recall"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 99,
    "day": "Day 99",
    "cancer": "Final Review",
    "topic": "Weakness-only day",
    "details": "只讀 wrong rate ≥50% 或 mastery ≤2 的題目",
    "goldenTrials": [
      "Weakness Review"
    ],
    "priority": "High",
    "completed": false
  },
  {
    "id": 100,
    "day": "Day 100",
    "cancer": "Final Review",
    "topic": "Ultra rapid review",
    "details": "biomarker、toxicity、trial endpoint、NCCN sequencing 最後總複習",
    "goldenTrials": [
      "Final Review"
    ],
    "priority": "High",
    "completed": false
  }
];


function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultState, ...JSON.parse(raw) } : defaultState;
  } catch {
    return defaultState;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function mergeCloudState(localState, cloudState) {
  if (!cloudState) return { ...defaultState, ...localState };

  return {
    ...defaultState,
    ...localState,
    ...cloudState,
    sessions: {
      ...(localState.sessions || {}),
      ...(cloudState.sessions || {}),
    },
    stats: {
      ...(localState.stats || {}),
      ...(cloudState.stats || {}),
    },
    settings: {
      ...defaultState.settings,
      ...(localState.settings || {}),
      ...(cloudState.settings || {}),
    },
    planProgress: {
      ...(localState.planProgress || {}),
      ...(cloudState.planProgress || {}),
    },
    cloudMeta: {
      ...(localState.cloudMeta || {}),
      ...(cloudState.cloudMeta || {}),
    },
  };
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

function getQuestion(id) {
  return questionBank.find((q) => q.id === id);
}

function emptyStat() {
  return {
    attempts: 0,
    correct: 0,
    wrong: 0,
    lastResult: null,
    lastAttemptAt: null,
    nextReviewDate: null,
    mastery: 0,
    userAnswer: null,
    correctAnswer: null,
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

function nextInterval(result, mastery, rate) {
  if (result === 'wrong') return mastery <= 1 ? 1 : 2;
  if (rate >= 50) return 3;
  if (mastery <= 1) return 3;
  if (mastery === 2) return 7;
  if (mastery === 3) return 14;
  return 30;
}

function classifyPriority(q, stat, today = TODAY) {
  const due = stat.nextReviewDate && stat.nextReviewDate <= today;
  if (due && stat.wrong > 0) return 0;
  if (stat.wrong > 0 && wrongRate(stat) >= 50) return 1;
  if (stat.bookmarked) return 2;
  if (stat.attempts === 0) return 3;
  return 4;
}

function shuffleStable(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function generateDailyQuestionIds(state) {
  const { dailyCount, preferredYears, preferredCancers } = state.settings;
  const pool = questionBank.filter((q) => {
    const yearOk = preferredYears.length === 0 || preferredYears.includes(q.year);
    const cancerOk = preferredCancers.length === 0 || preferredCancers.includes(q.cancer);
    return yearOk && cancerOk;
  });

  const ranked = pool
    .map((q) => ({ q, stat: getStat(state, q.id), priority: classifyPriority(q, getStat(state, q.id)) }))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const ar = wrongRate(a.stat);
      const br = wrongRate(b.stat);
      if (ar !== br) return br - ar;
      return a.stat.attempts - b.stat.attempts;
    });

  const weakOrDue = ranked.filter((x) => x.priority <= 2).slice(0, Math.ceil(dailyCount * 0.6));
  const newItems = shuffleStable(ranked.filter((x) => x.priority === 3)).slice(0, dailyCount - weakOrDue.length);
  const fallback = shuffleStable(ranked.filter((x) => x.priority === 4)).slice(0, dailyCount - weakOrDue.length - newItems.length);
  return [...weakOrDue, ...newItems, ...fallback].slice(0, dailyCount).map((x) => x.q.id);
}

function getCancerSummary(state) {
  return cancerCategories.map((cancer) => {
    const ids = questionBank.filter((q) => q.cancer === cancer).map((q) => q.id);
    const attempts = ids.reduce((sum, id) => sum + getStat(state, id).attempts, 0);
    const wrong = ids.reduce((sum, id) => sum + getStat(state, id).wrong, 0);
    const correct = ids.reduce((sum, id) => sum + getStat(state, id).correct, 0);
    const attemptedQuestions = ids.filter((id) => getStat(state, id).attempts > 0).length;
    return {
      cancer,
      total: ids.length,
      attemptedQuestions,
      attempts,
      correct,
      wrong,
      wrongRate: attempts ? Math.round((wrong / attempts) * 100) : 0,
    };
  }).sort((a, b) => b.wrongRate - a.wrongRate || b.attempts - a.attempts);
}

function buildAiPrompt(state) {
  const weak = questionBank
    .map((q) => ({ q, stat: getStat(state, q.id) }))
    .filter(({ stat }) => stat.wrong > 0 || stat.bookmarked)
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


function QuestionCard({ question, stat, onUpdateStat, compact = false, hideAnswerUntilSubmit = false }) {
  const initialAnswer = stat.correctAnswer || question.answer || '';
  const [selected, setSelected] = useState(stat.userAnswer || '');
  const [correctAnswer, setCorrectAnswer] = useState(initialAnswer);
  const [explanation, setExplanation] = useState(stat.explanation || question.explanation || '');
  const [wrongNotes, setWrongNotes] = useState(stat.wrongNotes || '');
  const [open, setOpen] = useState(!compact);
  const [revealed, setRevealed] = useState(!hideAnswerUntilSubmit || Boolean(stat.lastAttemptAt));
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const nextAnswer = stat.correctAnswer || question.answer || '';
    setSelected(stat.userAnswer || '');
    setCorrectAnswer(nextAnswer);
    setExplanation(stat.explanation || question.explanation || '');
    setWrongNotes(stat.wrongNotes || '');
    setRevealed(!hideAnswerUntilSubmit || Boolean(stat.lastAttemptAt));
    setFeedback('');
  }, [question.id, hideAnswerUntilSubmit]);

  const answerIsSingleChoice = /^[A-E]$/.test(String(correctAnswer || '').trim().toUpperCase());
  const isCorrectSelection = selected && answerIsSingleChoice && selected === String(correctAnswer).trim().toUpperCase();

  const record = (result) => {
    const previous = stat;
    const newCorrect = result === 'correct' ? previous.correct + 1 : previous.correct;
    const newWrong = result === 'wrong' ? previous.wrong + 1 : previous.wrong;
    const newAttempts = previous.attempts + 1;
    const newRate = Math.round((newWrong / newAttempts) * 100);
    const nextMastery = result === 'correct'
      ? Math.min(5, Math.max(previous.mastery || 0, previous.mastery + 1 || 1))
      : Math.max(0, (previous.mastery || 0) - 1);
    const interval = nextInterval(result, nextMastery, newRate);

    onUpdateStat(question.id, {
      ...previous,
      attempts: newAttempts,
      correct: newCorrect,
      wrong: newWrong,
      lastResult: result,
      lastAttemptAt: TODAY,
      nextReviewDate: addDays(TODAY, interval),
      mastery: nextMastery,
      userAnswer: selected || previous.userAnswer || null,
      correctAnswer: correctAnswer || previous.correctAnswer || question.answer || null,
      explanation,
      wrongNotes,
    });
  };

  const submitAnswer = () => {
    if (!selected) {
      setFeedback('請先選擇一個答案。');
      return;
    }
    setRevealed(true);

    if (answerIsSingleChoice) {
      const result = isCorrectSelection ? 'correct' : 'wrong';
      record(result);
      setFeedback(isCorrectSelection ? '答對。' : '答錯，請看正解與詳解。');
    } else {
      onUpdateStat(question.id, {
        ...stat,
        userAnswer: selected,
        correctAnswer: correctAnswer || stat.correctAnswer || question.answer || null,
        explanation,
        wrongNotes,
      });
      setFeedback('此題尚無單一正解或正解格式不明，請手動標記答對/答錯。');
    }
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
          <span className="pill">{question.cancer}</span>
          <span className="pill soft">{question.topic}</span>
          {question.trials?.map((trial) => <span key={trial} className="pill trial">{trial}</span>)}
        </div>
        <button className={stat.bookmarked ? 'bookmark active' : 'bookmark'} onClick={toggleBookmark}>
          {stat.bookmarked ? '★ 已標記' : '☆ 標記'}
        </button>
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
                    onChange={() => setSelected(key)}
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
                  Mastery
                  <select value={stat.mastery || 0} onChange={(e) => onUpdateStat(question.id, { ...stat, mastery: Number(e.target.value) })}>
                    {[0, 1, 2, 3, 4, 5].map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
                {!answerIsSingleChoice && (
                  <>
                    <button className="good" onClick={() => record('correct')}>手動標記答對</button>
                    <button className="bad" onClick={() => record('wrong')}>手動標記答錯</button>
                  </>
                )}
                {!hideAnswerUntilSubmit && (
                  <>
                    <button className="good" onClick={() => record('correct')}>答對</button>
                    <button className="bad" onClick={() => record('wrong')}>答錯</button>
                  </>
                )}
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
        attempts {stat.attempts} · correct {stat.correct} · wrong {stat.wrong} · wrong rate {wrongRate(stat)}% · next review {stat.nextReviewDate || 'not scheduled'}
      </div>
    </article>
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
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" autoComplete="email" />
          </label>
          <label>
            Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 個字元" type="password" autoComplete="current-password" />
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
        const q = getQuestion(id);
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
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="112">112</option>
            <option value="113">113</option>
            <option value="114">114</option>
          </select>
        </label>

        <label>
          題號
          <input
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
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="建議格式：答案、考點、為什麼其他選項錯、相關 trial/guideline、記憶點。"
              />
            </label>
            <label>
              錯誤原因 / 弱點標籤
              <textarea
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

export default function App() {
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState('today');
  const [search, setSearch] = useState('');
  const [bankCancer, setBankCancer] = useState('All');
  const [bankYear, setBankYear] = useState('All');
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

  const updateState = (updater) => setState((prev) => typeof updater === 'function' ? updater(prev) : updater);

  const updateStat = (id, nextStat) => {
    updateState((prev) => ({ ...prev, stats: { ...prev.stats, [id]: nextStat } }));
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
  const todayQuestions = todayIds.map(getQuestion).filter(Boolean);

  const createTodaySession = () => {
    const ids = generateDailyQuestionIds(state);
    updateState((prev) => ({
      ...prev,
      sessions: {
        ...prev.sessions,
        [TODAY]: { date: TODAY, questionIds: ids, createdAt: new Date().toISOString(), completed: false },
      },
    }));
    setTab('today');
  };

  const regenerateTodaySession = () => {
    if (!window.confirm('重新抽題會覆蓋今天的題目清單，但不會刪除作答紀錄。確定？')) return;
    createTodaySession();
  };

  const dueReview = useMemo(() => questionBank
    .map((q) => ({ q, stat: getStat(state, q.id) }))
    .filter(({ stat }) => stat.nextReviewDate && stat.nextReviewDate <= TODAY)
    .sort((a, b) => wrongRate(b.stat) - wrongRate(a.stat)), [state]);

  const weakQuestions = useMemo(() => questionBank
    .map((q) => ({ q, stat: getStat(state, q.id) }))
    .filter(({ stat }) => stat.wrong > 0 || stat.bookmarked)
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
    updateState((prev) => ({
      ...prev,
      planProgress: {
        ...(prev.planProgress || {}),
        [id]: !prev.planProgress?.[id],
      },
    }));
  };

  const setPlanCancerCompleted = (cancer, completed) => {
    updateState((prev) => {
      const next = { ...(prev.planProgress || {}) };
      studyPlan100.filter((task) => task.cancer === cancer).forEach((task) => {
        next[task.id] = completed;
      });
      return { ...prev, planProgress: next };
    });
  };

  const resetPlanProgress = () => {
    if (!window.confirm('確定要清除 100-Day Plan 的所有 checklist 完成狀態？')) return;
    updateState((prev) => ({ ...prev, planProgress: {} }));
  };


  const bankQuestions = useMemo(() => questionBank.filter((q) => {
    const text = `${q.id} ${q.stem} ${Object.values(q.options || {}).join(' ')} ${(q.trials || []).join(' ')}`.toLowerCase();
    const searchOk = !search || text.includes(search.toLowerCase());
    const cancerOk = bankCancer === 'All' || q.cancer === bankCancer;
    const yearOk = bankYear === 'All' || String(q.year) === String(bankYear);
    return searchOk && cancerOk && yearOk;
  }).slice(0, 80), [search, bankCancer, bankYear]);

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
          <h1>AI Review System</h1>
          <p>112–114 腫專考古題每日練習、錯題率追蹤、spaced repetition、詳解庫。</p>
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
        {[['today', 'Daily Practice'], ['review', 'Review Queue'], ['bank', 'Question Bank'], ['manual', 'Manual Add'], ['analytics', 'Analytics'], ['plan', '100-Day Plan'], ['sync', 'Cloud Sync'], ['settings', 'Settings']].map(([key, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>
        ))}
      </nav>

      {tab === 'today' && (
        <main className="panel">
          <div className="section-head">
            <div>
              <h2>今日練習：{TODAY}</h2>
              <p className="muted">每日建議 10–15 題。系統會優先抽「到期複習題 + 高錯誤率題 + 新題」。</p>
            </div>
            <div className="inline-actions">
              <button className="secondary" onClick={regenerateTodaySession}>重新抽題</button>
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
                <QuestionCard key={q.id} question={q} stat={getStat(state, q.id)} onUpdateStat={updateStat} hideAnswerUntilSubmit />
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

      {tab === 'bank' && (
        <main className="panel">
          <div className="section-head">
            <div>
              <h2>Question Bank</h2>
              <p className="muted">可搜尋 trial、癌別、年份、題幹文字；每題可補上答案與詳解。</p>
            </div>
          </div>
          <div className="filters">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜尋：KEYNOTE-671、EGFR、breast、PARP..." />
            <select value={bankYear} onChange={(e) => setBankYear(e.target.value)}>
              <option>All</option>
              <option>112</option>
              <option>113</option>
              <option>114</option>
            </select>
            <select value={bankCancer} onChange={(e) => setBankCancer(e.target.value)}>
              <option>All</option>
              {cancerCategories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <p className="muted">顯示前 80 題，共符合 {bankQuestions.length} 題。</p>
          <div className="question-list">
            {bankQuestions.map((q) => <QuestionCard key={q.id} question={q} stat={getStat(state, q.id)} onUpdateStat={updateStat} compact />)}
          </div>
        </main>
      )}


      {tab === 'manual' && (
        <ManualExplanationPanel state={state} onUpdateStat={updateStat} />
      )}

      {tab === 'analytics' && (
        <main className="panel">
          <h2>Analytics</h2>
          <div className="analytics-table">
            <div className="table-row header"><span>Cancer</span><span>Total</span><span>Attempted</span><span>Attempts</span><span>Wrong rate</span></div>
            {cancerSummary.map((row) => (
              <div className="table-row" key={row.cancer}>
                <span>{row.cancer}</span>
                <span>{row.total}</span>
                <span>{row.attemptedQuestions}</span>
                <span>{row.attempts}</span>
                <span><strong>{row.wrongRate}%</strong></span>
              </div>
            ))}
          </div>
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
          </section>

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
                        <span className="pill">{task.cancer}</span>
                        <span className={task.priority === 'High' ? 'priority high' : 'priority'}>{task.priority}</span>
                      </div>
                      <p>{task.details}</p>
                      <div className="trial-tags">
                        {(task.goldenTrials || []).map((trial) => <span key={trial}>{trial}</span>)}
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
              <input type="number" min="10" max="15" value={state.settings.dailyCount} onChange={(e) => updateSettings({ dailyCount: Math.max(10, Math.min(15, Number(e.target.value))) })} />
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
