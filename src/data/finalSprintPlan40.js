// 2026 oncology board final sprint (8/22-9/30).
// Keep `key` stable after a task has shipped; checklist and Quest history use it as identity.
// `id` deliberately starts at 101 so completion from the retired 100-day plan cannot be
// mistaken for completion in this new 40-day sprint.

export const FINAL_SPRINT_START_DATE = '2026-08-22';
export const FINAL_SPRINT_END_DATE = '2026-09-30';

export const FINAL_SPRINT_PROFILE = [
  { tier: '維持區', domains: 'Breast、Lung' },
  { tier: '鞏固區', domains: 'Head & Neck' },
  { tier: '補強區', domains: 'GI、Heme' },
  { tier: '優先補洞區', domains: 'GU、GYN、Supportive care、Statistics' },
];

export const FINAL_SPRINT_GUIDANCE = {
  daily: '20 分鐘到期錯題 → 90 分鐘 decision algorithms／ESMO → 60–90 分鐘作答 → 60–90 分鐘訂正 → 20 分鐘製作最多 3–5 張卡片。',
  lowEnergy: '最低線：10 題全部訂正、10–20 張 due cards、閉卷重建 1 個 algorithm；隔天不懲罰性補雙倍。',
  adaptive: [
    '≥80% 且 reasoning 完整：維持，不再重讀',
    '70–79%：安排一次錯題重測',
    '60–69%：安排一個半日 rescue block',
    '<60%：安排完整一天，取代已 ≥80% 的複習日',
    'High-confidence wrong：無論總分，列為最高優先',
  ],
  buffer: [
    '10/1：核心 algorithms＋biomarker sequencing，最多 2 小時',
    '10/2：Golden Trials＋toxicity triggers，最多 90 分鐘',
    '10/3：只看熟悉卡片 45–60 分鐘；不做完整模考、不讀新 guideline',
    '10/4：考試日只做短暖身',
  ],
};

const STANDARD_DAY_CRITERIA = [
  '48–72 小時到期錯題已處理',
  '當日 decision algorithm 與 ESMO 重點已完成',
  '目標題數已作答並完整訂正',
  '最多製作 3–5 張 high-value cards',
];

const CORRECTION_CRITERIA = [
  '逐題標出 decisive condition',
  '寫出正確 rule',
  '解釋其他選項為何不成立',
  '完成 error type 分類；猜對也列為未掌握',
];

const ERROR_DRIVEN_CRITERIA = [
  '只做題與錯題重測，不重讀完整章節',
  '每題找出 decisive condition',
  '只補一個最小知識缺口',
  '用變形題驗證已轉正',
];

const PHASES = {
  foundation: 'Phase 1｜補齊未系統化領域',
  mocks: 'Phase 2｜三輪正式模考',
  conversion: 'Phase 3｜錯題轉正',
  final: 'Phase 4｜Final readiness',
};

function sprintTask(day, date, config) {
  return {
    key: `final-sprint-2026-d${String(day).padStart(2, '0')}`,
    id: 100 + day,
    day: `Day ${day}｜${date}`,
    phase: PHASES[config.phase],
    module: config.module,
    cancer: config.cancer,
    topic: config.topic,
    details: config.details,
    goldenTrials: config.goldenTrials || [],
    focusTags: config.focusTags || [],
    highYieldWeight: config.weight || 5,
    completionCriteria: config.criteria || (config.phase === 'mocks' && config.correction
      ? CORRECTION_CRITERIA
      : config.phase === 'conversion'
        ? ERROR_DRIVEN_CRITERIA
        : STANDARD_DAY_CRITERIA),
    requiredQuestionIds: [],
    bossUnlockContribution: config.boss || 'Final Board Boss',
    priority: config.priority || 'High',
    legacyId: 100 + day,
  };
}

export const FINAL_SPRINT_PLAN = [
  sprintTask(1, '8/22', {
    phase: 'foundation', module: 'Diagnostic + Maintenance', cancer: 'Mixed', topic: 'Mixed diagnostic＋Breast 結案',
    details: '40 題跨癌別診斷；完成 Breast trial endpoint matrix；依實際表現確認弱點排序。',
    goldenTrials: ['TAILORx', 'RxPONDER', 'KATHERINE', 'KEYNOTE-522', 'OlympiA', 'monarchE'],
    focusTags: ['mixed diagnostic', 'Breast endpoint matrix', 'weakness ranking'],
    criteria: ['完成 40 題跨癌別 diagnostic', '完成 Breast trial endpoint matrix', '依作答紀錄排出真正弱點順序', '所有錯題完成 error type 分類'],
  }),
  sprintTask(2, '8/23', {
    phase: 'foundation', module: 'GI', cancer: 'GI', topic: 'Esophageal／Gastric cancer',
    details: 'Staging、perioperative／adjuvant、HER2、PD-L1、MSI、CLDN18.2。',
    goldenTrials: ['CROSS', 'CheckMate 649', 'KEYNOTE-811', 'KEYNOTE-590', 'CheckMate 648'],
    focusTags: ['staging', 'perioperative', 'HER2', 'PD-L1', 'MSI', 'CLDN18.2'], boss: 'GI Boss',
  }),
  sprintTask(3, '8/24', {
    phase: 'foundation', module: 'GI', cancer: 'GI', topic: 'Localized colon cancer',
    details: 'Adjuvant indication、MOSAIC／IDEA、stage II risk、dMMR。',
    goldenTrials: ['IDEA'], focusTags: ['adjuvant', 'stage II risk', 'dMMR', 'MOSAIC'], boss: 'GI Boss',
  }),
  sprintTask(4, '8/25', {
    phase: 'foundation', module: 'GI', cancer: 'GI', topic: 'Metastatic CRC',
    details: 'RAS／BRAF／HER2／MSI、sidedness 與治療 sequencing。',
    goldenTrials: ['KEYNOTE-177', 'BEACON CRC', 'BREAKWATER'],
    focusTags: ['RAS', 'BRAF', 'HER2', 'MSI', 'sidedness', 'sequencing'], boss: 'GI Boss',
  }),
  sprintTask(5, '8/26', {
    phase: 'foundation', module: 'GI', cancer: 'GI', topic: 'Rectal／Anal cancer',
    details: 'TNT、watch-and-wait、adjuvant traps、anal SCC。',
    goldenTrials: ['PRODIGE 23'], focusTags: ['TNT', 'watch-and-wait', 'adjuvant trap', 'anal SCC'], boss: 'GI Boss',
  }),
  sprintTask(6, '8/27', {
    phase: 'foundation', module: 'GI', cancer: 'GI', topic: 'Pancreatic／Biliary cancer',
    details: 'Resectability、adjuvant、BRCA／PALB2、FGFR2、IDH1。',
    goldenTrials: ['PRODIGE 24', 'TOPAZ-1'],
    focusTags: ['resectability', 'BRCA/PALB2', 'FGFR2', 'IDH1'], boss: 'GI Boss',
  }),
  sprintTask(7, '8/28', {
    phase: 'foundation', module: 'GI', cancer: 'GI', topic: 'HCC＋GI Boss',
    details: 'BCLC、first-line／later-line；完成 GI mixed 50 題。',
    goldenTrials: ['IMbrave150', 'CheckMate 9DW'], focusTags: ['BCLC', 'first-line', 'later-line', 'GI mixed 50'], boss: 'GI Boss',
    criteria: ['閉卷重建 BCLC 治療路徑', '完成 GI mixed 50 題', '所有錯題完整訂正與分類', '通過或記錄 GI Boss 缺口'],
  }),
  sprintTask(8, '8/29', {
    phase: 'foundation', module: 'GU', cancer: 'GU', topic: 'Localized RCC',
    details: 'Risk、surgery、adjuvant pembrolizumab、KEYNOTE-564。',
    goldenTrials: ['KEYNOTE-564'], focusTags: ['risk', 'surgery', 'adjuvant pembrolizumab'],
  }),
  sprintTask(9, '8/30', {
    phase: 'foundation', module: 'GU', cancer: 'GU', topic: 'Metastatic RCC',
    details: 'IMDC、IO/TKI、IO/IO、sequencing 與 toxicity。',
    goldenTrials: ['CheckMate 214', 'CheckMate 9ER'], focusTags: ['IMDC', 'IO/TKI', 'IO/IO', 'sequencing', 'toxicity'],
  }),
  sprintTask(10, '8/31', {
    phase: 'foundation', module: 'GU', cancer: 'GU', topic: 'Urothelial cancer',
    details: 'Cisplatin eligibility、EV＋pembrolizumab、maintenance、FGFR。',
    goldenTrials: ['EV-302/KEYNOTE-A39', 'JAVELIN Bladder 100', 'THOR'],
    focusTags: ['cisplatin eligibility', 'EV+pembrolizumab', 'maintenance', 'FGFR'],
  }),
  sprintTask(11, '9/1', {
    phase: 'foundation', module: 'GU', cancer: 'GU', topic: 'Prostate＋Germ-cell tumor',
    details: 'mHSPC／mCRPC、triplet、PARPi；germ-cell risk group 與 salvage。',
    goldenTrials: ['ARASENS', 'PEACE-1', 'PROfound', 'VISION'],
    focusTags: ['mHSPC', 'mCRPC', 'triplet', 'PARPi', 'risk group', 'salvage'],
  }),
  sprintTask(12, '9/2', {
    phase: 'foundation', module: 'GYN', cancer: 'GYN', topic: 'Ovarian cancer',
    details: 'Histology、surgery、PARPi、HRD、platinum sensitivity。',
    goldenTrials: ['SOLO-1', 'MIRASOL'], focusTags: ['histology', 'surgery', 'PARPi', 'HRD', 'platinum sensitivity'],
  }),
  sprintTask(13, '9/3', {
    phase: 'foundation', module: 'GYN', cancer: 'GYN', topic: 'Endometrial cancer',
    details: 'Molecular classification、dMMR、POLE、p53、advanced therapy。',
    goldenTrials: ['NRG-GY018', 'RUBY', 'KEYNOTE-775'],
    focusTags: ['molecular classification', 'dMMR', 'POLE', 'p53', 'advanced therapy'],
  }),
  sprintTask(14, '9/4', {
    phase: 'foundation', module: 'GYN', cancer: 'GYN', topic: 'Cervical／Vulvar＋GYN Boss',
    details: 'Definitive CCRT、KEYNOTE-826、adjuvant principles；完成 40 題。',
    goldenTrials: ['KEYNOTE-826', 'INTERLACE'], focusTags: ['definitive CCRT', 'adjuvant principles', 'GYN mixed 40'],
    criteria: ['閉卷重建 cervical definitive CCRT 路徑', '完成 GYN mixed 40 題', '所有錯題完整訂正與分類', '通過或記錄 GYN Boss 缺口'],
  }),
  sprintTask(15, '9/5', {
    phase: 'foundation', module: 'Heme', cancer: 'Heme', topic: 'Aggressive lymphoma',
    details: 'DLBCL、PMBCL、Burkitt、POLARIX、CNS prophylaxis。',
    goldenTrials: ['POLARIX', 'ZUMA-7'], focusTags: ['DLBCL', 'PMBCL', 'Burkitt', 'CNS prophylaxis'],
  }),
  sprintTask(16, '9/6', {
    phase: 'foundation', module: 'Heme', cancer: 'Heme', topic: 'Indolent lymphoma／MCL／CLL',
    details: 'Treatment indication、TP53／del17p、BTKi／BCL2 sequencing。',
    goldenTrials: ['GALLIUM'], focusTags: ['treatment indication', 'TP53/del17p', 'BTKi', 'BCL2 sequencing'],
  }),
  sprintTask(17, '9/7', {
    phase: 'foundation', module: 'Heme', cancer: 'Heme', topic: 'Multiple myeloma',
    details: 'SLiM-CRAB、risk、transplant eligibility、induction／maintenance。',
    goldenTrials: ['MAIA', 'PERSEUS'], focusTags: ['SLiM-CRAB', 'risk', 'transplant eligibility', 'induction', 'maintenance'],
  }),
  sprintTask(18, '9/8', {
    phase: 'foundation', module: 'Heme', cancer: 'Heme', topic: 'AML／APL／MDS／MPN',
    details: 'WHO／ICC／ELN、fitness、targeted therapy、response／MRD。',
    goldenTrials: ['VIALE-A', 'QUAZAR AML-001', 'RATIFY', 'ADMIRAL'],
    focusTags: ['WHO/ICC/ELN', 'fitness', 'targeted therapy', 'response', 'MRD'],
  }),
  sprintTask(19, '9/9', {
    phase: 'foundation', module: 'Heme', cancer: 'Heme', topic: 'ALL／CML／Transplant＋Heme Boss',
    details: 'Ph+ ALL、TKI milestones、HSCT indication、GVHD；完成 Heme Boss。',
    focusTags: ['Ph+ ALL', 'TKI milestones', 'HSCT indication', 'GVHD', 'Heme Boss'],
    criteria: ['閉卷重建 Ph+ ALL 與 CML milestones', '完成 HSCT/GVHD 核心題', '所有錯題完整訂正與分類', '通過或記錄 Heme Boss 缺口'],
  }),
  sprintTask(20, '9/10', {
    phase: 'foundation', module: 'Supportive Care', cancer: 'Supportive/Stats', topic: 'Supportive care／Emergency',
    details: 'FN、TLS、hypercalcemia、SVC、cord compression、antiemesis、pain／secretions。',
    focusTags: ['FN', 'TLS', 'hypercalcemia', 'SVC', 'cord compression', 'antiemesis', 'pain', 'secretions'],
  }),
  sprintTask(21, '9/11', {
    phase: 'foundation', module: 'Statistics + Rare', cancer: 'Other', topic: 'Statistics＋Rare tumors',
    details: 'Endpoint、HR／CI、subgroup、noninferiority；melanoma／sarcoma／NET rapid review。',
    goldenTrials: ['CheckMate 067', 'NETTER-1'],
    focusTags: ['endpoint', 'HR/CI', 'subgroup', 'noninferiority', 'melanoma', 'sarcoma', 'NET'],
  }),
  sprintTask(22, '9/12', {
    phase: 'foundation', module: 'Head & Neck', cancer: 'Head & Neck', topic: 'Head & Neck＋RT',
    details: 'HPV、NPC、definitive／postoperative CCRT、R/M sequencing、RT traps。',
    goldenTrials: ['KEYNOTE-048', 'RTOG 1016', 'JUPITER-02'],
    focusTags: ['HPV', 'NPC', 'definitive CCRT', 'postoperative CCRT', 'R/M sequencing', 'RT traps'], boss: 'Head & Neck Boss',
  }),
  sprintTask(23, '9/13', {
    phase: 'foundation', module: 'Maintenance', cancer: 'Mixed', topic: 'Lung＋Breast maintenance',
    details: 'Lung、Breast 各 20–25 題；只修復錯題，不重讀完整章節。',
    goldenTrials: ['CheckMate 816', 'KEYNOTE-671', 'ADAURA', 'KATHERINE', 'KEYNOTE-522', 'DESTINY-Breast04'],
    focusTags: ['Lung 20–25 questions', 'Breast 20–25 questions', 'error repair only'],
    criteria: ['Lung 完成 20–25 題', 'Breast 完成 20–25 題', '只修復錯題，不重讀完整章節', '所有錯題完成 error type 分類'],
  }),
  sprintTask(24, '9/14', {
    phase: 'mocks', module: 'Mock', cancer: 'Mock', topic: '112 年或最早一份完整考古',
    details: '完全計時完成最早一份可用完整考古；自本日起停止章節式推進。',
    focusTags: ['full mock', 'timed', '112', 'no chapter progression'],
    criteria: ['完全計時完成整份考古', '不中途查資料', '記錄總分與各領域正確率', '標記 high-confidence wrong'],
  }),
  sprintTask(25, '9/15', {
    phase: 'mocks', module: 'Mock Correction', cancer: 'Mock', topic: '全卷訂正與錯誤分類', correction: true,
    details: '依癌別、decisive condition、error type 分類；完成第一輪弱點圖。',
    focusTags: ['decisive condition', 'error type', 'weakness ranking'],
  }),
  sprintTask(26, '9/16', {
    phase: 'mocks', module: 'Mock', cancer: 'Mock', topic: '113 年完整考古',
    details: '完全計時完成 113 年完整考古。', focusTags: ['full mock', 'timed', '113'],
    criteria: ['完全計時完成 113 年考古', '不中途查資料', '記錄總分與各領域正確率', '標記 high-confidence wrong'],
  }),
  sprintTask(27, '9/17', {
    phase: 'mocks', module: 'Mock Correction', cancer: 'Mock', topic: '全卷訂正＋第一次錯題反向重測', correction: true,
    details: '完成 113 年全卷訂正，並把前輪錯題反向重測。', focusTags: ['full correction', 'reverse retest'],
  }),
  sprintTask(28, '9/18', {
    phase: 'mocks', module: 'Mock', cancer: 'Mock', topic: '114 年或最新完整考古',
    details: '完全計時完成最新一份完整考古。', focusTags: ['full mock', 'timed', '114', 'latest'],
    criteria: ['完全計時完成最新完整考古', '不中途查資料', '記錄總分與各領域正確率', '標記 high-confidence wrong'],
  }),
  sprintTask(29, '9/19', {
    phase: 'mocks', module: 'Mock Correction', cancer: 'Mock', topic: '全卷訂正＋最終弱點排行榜', correction: true,
    details: '完整訂正最新考古，建立最終弱點排行榜供 Day 30–37 動態分配。', focusTags: ['full correction', 'final weakness ranking'],
  }),
  sprintTask(30, '9/20', {
    phase: 'mocks', module: 'Adaptive Rescue', cancer: 'Weakness Repair', topic: 'Weakest-domain rescue 1',
    details: '依模考領域正確率動態替換：<60% 完整一天；60–69% 半日；70–79% 錯題重測；≥80% 維持。',
    focusTags: ['adaptive rescue', 'high-confidence wrong', '<60% full day'],
    criteria: ['鎖定當下最低分領域', '依正確率門檻決定 rescue 劑量', '完成對應錯題與最小缺口修補', '用變形題確認轉正'],
  }),
  sprintTask(31, '9/21', {
    phase: 'mocks', module: 'Adaptive Rescue', cancer: 'Weakness Repair', topic: 'Weakest-domain rescue 2＋Trial／Biomarker 測驗',
    details: '完成第二弱領域 rescue，並做跨癌別 trial／biomarker 測驗。',
    focusTags: ['adaptive rescue', 'trial topology', 'biomarker sequencing'],
    criteria: ['完成第二弱領域 rescue', '完成跨癌別 trial 測驗', '完成 biomarker sequencing 測驗', 'high-confidence wrong 全部排入重測'],
  }),
  sprintTask(32, '9/22', {
    phase: 'conversion', module: 'Error Conversion', cancer: 'Mixed', topic: 'GI＋GU 錯題重測',
    details: '只針對 GI、GU 錯題與最小缺口進行轉正。', focusTags: ['GI', 'GU', 'wrong retest'],
  }),
  sprintTask(33, '9/23', {
    phase: 'conversion', module: 'Error Conversion', cancer: 'Mixed', topic: 'GYN＋Heme 錯題重測',
    details: '只針對 GYN、Heme 錯題與最小缺口進行轉正。', focusTags: ['GYN', 'Heme', 'wrong retest'],
  }),
  sprintTask(34, '9/24', {
    phase: 'conversion', module: 'Interleaving', cancer: 'Mixed', topic: 'Lung＋Breast＋Head & Neck interleaving',
    details: '維持區與鞏固區交錯作答，只修復表現暴露的缺口。', focusTags: ['Lung', 'Breast', 'Head & Neck', 'interleaving'],
  }),
  sprintTask(35, '9/25', {
    phase: 'conversion', module: 'Supportive + Statistics', cancer: 'Supportive/Stats', topic: 'Supportive care＋toxicity＋statistics',
    details: '以題目整合 emergency、major toxicity 與 trial interpretation。', focusTags: ['supportive care', 'toxicity', 'statistics'],
  }),
  sprintTask(36, '9/26', {
    phase: 'conversion', module: 'Trial Cards', cancer: 'Trial Cards', topic: 'Trial topology',
    details: '閉卷重建 setting／population／comparator／endpoint。', focusTags: ['setting', 'population', 'comparator', 'endpoint'], boss: 'Trial Boss',
  }),
  sprintTask(37, '9/27', {
    phase: 'conversion', module: 'Biomarker + Critical Errors', cancer: 'Mixed', topic: 'Biomarker sequencing＋high-confidence wrong',
    details: '完成 biomarker sequencing，並重測所有 high-confidence wrong。',
    focusTags: ['biomarker sequencing', 'high-confidence wrong', 'critical error'],
  }),
  sprintTask(38, '9/28', {
    phase: 'final', module: 'Final Mock', cancer: 'Mock', topic: '最後一次完整計時模考',
    details: '最後一份完整模考；以正式考試條件完成。', focusTags: ['final mock', 'timed', 'exam conditions'],
    criteria: ['完全計時完成最後模考', '不中途查資料', '記錄總分與各領域正確率', '只標記仍需轉正的錯題'],
  }),
  sprintTask(39, '9/29', {
    phase: 'final', module: 'Final Correction', cancer: 'Mock', topic: '最後模考完整訂正',
    details: '完整訂正；清單只保留尚未轉正的錯題。', focusTags: ['final correction', 'unconverted errors only'],
    criteria: CORRECTION_CRITERIA,
  }),
  sprintTask(40, '9/30', {
    phase: 'final', module: 'Knowledge Lock', cancer: 'Final Review', topic: 'Knowledge lock',
    details: '鎖定 algorithms、biomarkers、Golden Trials、major toxicity；停止新增內容。',
    focusTags: ['algorithms', 'biomarkers', 'Golden Trials', 'major toxicity', 'no new content'],
    criteria: ['閉卷重建核心 algorithms', '完成 biomarker sequencing rapid recall', '完成 Golden Trials 與 major toxicity rapid recall', '停止新增卡片、章節與 guideline'],
  }),
];
