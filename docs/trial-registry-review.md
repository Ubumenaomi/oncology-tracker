# Trial Registry 審核清單

產生日期：2026-07-15  
候選來源：`Oncology_Trial_Registry_2026-07-15/docs/trial-registry/*.md`  
規則：只有勾選並寫回為 `approved` 的項目，才可進入 Daily Plan 與 Boss Challenge。
核准方式：完成查核後，將決定寫入 `src/data/trialRegistry.js` 的 `TRIAL_REVIEW_DECISIONS`，再重新執行 `npm run trials:review`。

## 摘要

| 癌別 | Golden 候選 | Related 候選 | 已核准 | 待審核 |
| --- | ---: | ---: | ---: | ---: |
| Breast | 13 | 4 | 10 | 7 |
| GI | 15 | 9 | 6 | 18 |
| GU | 14 | 6 | 10 | 10 |
| GYN | 7 | 3 | 5 | 5 |
| Head & Neck | 4 | 3 | 3 | 4 |
| Heme | 10 | 3 | 4 | 9 |
| Lung | 17 | 7 | 10 | 14 |
| Other | 3 | 4 | 1 | 6 |

## A. 明確分類衝突

| 確認 | 癌別 | Trial | Registry 分類 | 現有／建議主題 | 審核理由 |
| --- | --- | --- | --- | --- | --- |
| [v] | Breast | MINDACT | related | Day 15｜Gene expression profile | keep related |
| [v ] | GI | KEYNOTE-966 | golden | Day 35｜Biliary tract cancer |  |
| [v] | GI | RAPIDO | related | Day 29｜Rectal TNT | 現有 Daily Plan 將此項放在 goldenTrials；需逐筆決定分類。 |
| [v] | GI | OPRA | related | Day 29｜Rectal TNT | 現有 Daily Plan 將此項放在 goldenTrials；需逐筆決定分類。 |
| [v] | GI | IDEA | golden | Day 30｜Adjuvant colon cancer | 現有 Daily Plan 將此項放在 goldenTrials；需逐筆決定分類。 |
| [v ] | GI | HIMALAYA |golden | Day 33｜HCC systemic therapy | 現有 Daily Plan 將此項放在 goldenTrials；需逐筆決定分類。 |
| [v ] | GU | PROpel | related | Day 43｜mCRPC sequencing | 現有 Daily Plan 將此項放在 goldenTrials；需逐筆決定分類。 |
| [v ] | GYN | PAOLA-1 | golden | Day 50｜Ovarian first-line maintenance | 現有 Daily Plan 將此項放在 goldenTrials；需逐筆決定分類。 |
| [v ] | GYN | PRIMA | related | Day 50｜Ovarian first-line maintenance | 現有 Daily Plan 將此項放在 goldenTrials；需逐筆決定分類。 |
| [v ] | Heme | TRANSFORM | golden | Day 62｜DLBCL and CAR-T | 現有 Daily Plan 將此項放在 goldenTrials；需逐筆決定分類。 |
| [v ] | Lung | CONVERT | golden | Day 9｜SCLC limited stage | 現有 Daily Plan 將此項放在 goldenTrials；需逐筆決定分類。 |
| [v ] | Lung | CALGB 30610/RTOG 0538 | related | Day 9｜SCLC limited stage | 現有 Daily Plan 將此項放在 goldenTrials；需逐筆決定分類。 |

審核時請將分類改成 `golden`、`related` 或 `exclude`，並保留一句理由。原始研究或 guideline 來源應一併補在該列下方。

## B. Registry 新增或尚未核准

| 確認 | 癌別 | Trial | 候選分類 | 建議主題 | 審核理由 |
| --- | --- | --- | --- | --- | --- |
| [v ] | Breast | DESTINY-Breast06 | golden | Day 22｜HER2-low and ADC | 依癌別與臨床主題建議。 |
| [v ] | Breast | INAVO120 | golden | Day 20｜Metastatic HR+/HER2- | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Breast | PATINA | golden | Day 21｜HER2+ metastatic | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Breast | DESTINY-Breast05 | golden | Day 17｜HER2+ early disease | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Breast | TROPiCS-02 | related | Day 20｜Metastatic HR+/HER2- | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Breast | EMBRACA | related | Day 19｜gBRCA and PARPi | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GI | KEYNOTE-811 | golden | Day 31｜Gastric/GEJ first-line | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GI | MATTERHORN | golden | Day 31｜Gastric/GEJ first-line | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GI | DESTINY-Gastric04 | golden | Day 31｜Gastric/GEJ first-line | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GI | KEYNOTE-590 | golden | Day 32｜Esophageal cancer | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GI | CheckMate 648 | golden | Day 32｜Esophageal cancer | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GI | KEYNOTE-177 | golden | Day 27｜CRC biomarkers | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GI | BEACON CRC | golden | Day 27｜CRC biomarkers | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GI | BREAKWATER | golden | Day 27｜CRC biomarkers | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GI | CheckMate 9DW | golden | Day 33｜HCC systemic therapy | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GI | ESPAC-4 | golden | Day 34｜Pancreas cancer | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GI | APACT | related | Day 34｜Pancreas cancer | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GI | PREOPANC | related | Day 34｜Pancreas cancer | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GI | PROSPECT | related | Day 29｜Rectal TNT | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GU | CheckMate 901 | golden | Day 41｜Urothelial metastatic | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GU | EV-301 | golden | Day 41｜Urothelial metastatic | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GU | CheckMate 214 | golden | Day 39｜RCC adjuvant and metastatic | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GU | PROfound | golden | Day 43｜mCRPC sequencing | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GU | KEYNOTE-052 | related | Day 41｜Urothelial metastatic | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GU | KEYNOTE-045 | related | Day 41｜Urothelial metastatic | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GU | AMBASSADOR | related | Day 40｜Urothelial perioperative | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GU | COSMIC-313 | related | Day 39｜RCC adjuvant and metastatic | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GU | MAGNITUDE | related | Day 43｜mCRPC sequencing | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GYN | NRG-GY018 | golden | Day 48｜Endometrial IO | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GYN | INTERLACE | golden | Day 49｜Cervical CCRT and IO | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | GYN | DUO-E | related | Day 48｜Endometrial IO | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Head & Neck | KEYNOTE-689 | golden | Day 57｜Definitive and induction CCRT | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Head & Neck | EXTREME | golden | Day 58｜Recurrent/metastatic HNSCC | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Head & Neck | CAPTAIN-1st | related | Day 59｜Nasopharyngeal carcinoma | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Head & Neck | NPC induction GP versus PF | related | Day 59｜Nasopharyngeal carcinoma | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Heme | VIALE-A | golden | 未找到合適的現有主題，維持 unassigned | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Heme | QUAZAR AML-001 | golden | 未找到合適的現有主題，維持 unassigned | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Heme | RATIFY | golden | 未找到合適的現有主題，維持 unassigned | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Heme | ADMIRAL | golden | 未找到合適的現有主題，維持 unassigned | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Heme | GALLIUM | golden | Day 63｜Indolent lymphoma | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Heme | MAIA | golden | Day 64｜Multiple myeloma frontline | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Heme | TRIANGLE | related | Day 63｜Indolent lymphoma | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Heme | DETERMINATION | related | Day 64｜Multiple myeloma frontline | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Lung | AEGEAN | golden | Day 4｜Neoadjuvant chemo-IO | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Lung | IMpower010 | golden | Day 2｜EGFR early NSCLC | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Lung | KEYNOTE-091 | golden | Day 2｜EGFR early NSCLC | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Lung | LAURA | golden | Day 3｜Unresectable stage III NSCLC | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Lung | KEYNOTE-407 | golden | Day 8｜Metastatic ICI algorithms | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Lung | FLAURA2 | golden | Day 6｜ALK/ROS1/RET/MET/NTRK | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Lung | ADRIATIC | golden | Day 9｜SCLC limited stage | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Lung | IMpower150 | golden | Day 8｜Metastatic ICI algorithms | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Lung | CheckMate 9LA | related | Day 8｜Metastatic ICI algorithms | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Lung | DeLLphi-301 | related | Day 10｜SCLC extensive stage | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Lung | KEYNOTE-604 | golden | Day 10｜SCLC extensive stage | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Lung | MAPS | related | Day 11｜Mesothelioma | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Other | CheckMate 067 | golden | Day 66｜Melanoma / non-melanoma skin cancer | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Other | Stupp | related | 未找到合適的現有主題，維持 unassigned | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Other | DREAMseq | related | Day 66｜Melanoma / non-melanoma skin cancer | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Other | RELATIVITY-047 | related | Day 66｜Melanoma / non-melanoma skin cancer | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Other | CheckMate 548 | related | 未找到合適的現有主題，維持 unassigned | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |
| [v ] | Other | SARC028 | related | Day 67｜Sarcoma / GIST | 依癌別與臨床主題建議；核准前不進正式 Boss 名單。 |

## C. Daily Plan 有、Registry 沒有的疑似 Trial

| 確認 | 癌別 | 名稱 | 現有主題 | 決定 |
| --- | --- | --- | --- | --- |
| [v ] | Lung | NCCN Algorithm | Day 1｜NSCLC foundation | exclude |
| [v ] | Lung | PROFILE | Day 6｜ALK/ROS1/RET/MET/NTRK | related |
| [v] | Lung | LIBRETTO | Day 6｜ALK/ROS1/RET/MET/NTRK |  golden  |
| [v ] | Lung | CodeBreaK | Day 7｜KRAS/HER2/BRAF/MET exon 14 | golden |
| [v ] | Lung | DESTINY-Lung | Day 7｜KRAS/HER2/BRAF/MET exon 14 | golden |
| [v ] | Lung | CheckMate-227 | Day 8｜Metastatic ICI algorithms | golden |
| [v] | Breast | NATALEE | Day 16｜Adjuvant CDK4/6 | golden  |
| [v ] | Breast | APHINITY | Day 17｜HER2+ early disease | golden  |
| [v ] | Breast | PALOMA | Day 20｜Metastatic HR+/HER2- |  related |
| [v ] | Breast | MONALEESA | Day 20｜Metastatic HR+/HER2- | golden  |
| [v] | Breast | SOLAR-1 | Day 20｜Metastatic HR+/HER2- | golden |
| [ v] | Breast | HER2CLIMB | Day 21｜HER2+ metastatic | related |
| [v ] | Breast | KEYNOTE-355 | Day 23｜TNBC metastatic | golden |
| [v ] | GI | FIRE-3 | Day 27｜CRC biomarkers | golden  |
| [v ] | GI | PARADIGM | Day 27｜CRC biomarkers | golden  |
| [v ] | GI | VELOUR | Day 28｜Metastatic CRC sequencing | related  |
| [v ] | GI | RAISE | Day 28｜Metastatic CRC sequencing | related  |
| [v] | GI | SUNLIGHT | Day 28｜Metastatic CRC sequencing | related  |
| [v ] | GI | KEYNOTE-859 | Day 31｜Gastric/GEJ first-line | golden  |
| [v ] | GI | SPOTLIGHT | Day 31｜Gastric/GEJ first-line |  related |
| [v ] | GI | CheckMate-577 | Day 32｜Esophageal cancer | golden|
| [v ] | GI | POLO | Day 34｜Pancreas cancer | golden |
| [v ] | GU | CLEAR | Day 39｜RCC adjuvant and metastatic | related  |
| [v ] | GYN | KEYNOTE-A18 | Day 49｜Cervical CCRT and IO | golden |
| [v ] | Head & Neck | DeCIDE | Day 57｜Definitive and induction CCRT | golden  |
| [v ] | Head & Neck | CheckMate-141 | Day 58｜Recurrent/metastatic HNSCC | golden  |
| [v ] | Heme | RATHL | Day 61｜Hodgkin lymphoma | related |
| [v ] | Heme | GRIFFIN | Day 64｜Multiple myeloma frontline | related  |
| [v ] | Heme | CARTITUDE | Day 65｜Multiple myeloma relapse | related |
| [v ] | Heme | KarMMa | Day 65｜Multiple myeloma relapse | golden e |
| [v ] | Other | COMBI-AD | Day 66｜Melanoma / non-melanoma skin cancer | golden |
| [v ] | Other | CheckMate-238 | Day 66｜Melanoma / non-melanoma skin cancer | golden  |
| [v ] | Other | KEYNOTE-629 | Day 66｜Melanoma / non-melanoma skin cancer | golden  |
| [v ] | Other | PALETTE | Day 67｜Sarcoma / GIST | golden |

## D. 非 Trial 活動（建議移出 trial 欄位）

| 確認 | 癌別 | 名稱 | 現有主題 | 建議 |
| --- | --- | --- | --- | --- |
| [v ] | Lung | Toxicity Review | Day 12｜Lung toxicity drill | 保留為一般複習活動，不進 registry |
| [v ] | Lung | Lung Boss | Day 13｜Lung boss prep | 保留為一般複習活動，不進 registry |
| [v ] | Breast | Toxicity Review | Day 24｜Breast toxicity drill | 保留為一般複習活動，不進 registry |
| [v ] | Breast | Golden Trial Recall | Day 25｜Breast trial endpoint recall | 保留為一般複習活動，不進 registry |
| [v ] | Breast | Breast Boss | Day 26｜Breast boss prep | 保留為一般複習活動，不進 registry |
| [v ] | GI | GIST Review | Day 36｜GIST and NET | 保留為一般複習活動，不進 registry |
| [v ] | GI | Toxicity Review | Day 37｜GI toxicity and supportive traps | 保留為一般複習活動，不進 registry |
| [v ] | GI | GI Boss | Day 38｜GI boss prep | 保留為一般複習活動，不進 registry |
| [v ] | GU | Seminoma Review | Day 44｜Seminoma and germ cell | 保留為一般複習活動，不進 registry |
| [v ] | GU | Biomarker Review | Day 45｜GU biomarkers | 保留為一般複習活動，不進 registry |
| [v ] | GU | Toxicity Review | Day 46｜GU toxicity drill | 保留為一般複習活動，不進 registry |
| [v ] | GU | Weakness Review | Day 47｜GU mixed correction | 保留為一般複習活動，不進 registry |
| [v ] | GYN | Trial Interpretation | Day 52｜GYN trial interpretation | 保留為一般複習活動，不進 registry |
| [v ] | GYN | Toxicity Review | Day 53｜GYN toxicity drill | 保留為一般複習活動，不進 registry |
| [v ] | GYN | Algorithm Recall | Day 54｜GYN rapid algorithm | 保留為一般複習活動，不進 registry |
| [ v] | GYN | Weakness Review | Day 55｜GYN mixed correction | 保留為一般複習活動，不進 registry |
| [v ] | Head & Neck | HPV HNSCC Review | Day 56｜HPV oropharynx and staging | 保留為一般複習活動，不進 registry |
| [v ] | Head & Neck | Head & Neck Boss | Day 60｜Head & Neck boss prep | 保留為一般複習活動，不進 registry |
| [v ] | Heme | CLL Review | Day 63｜Indolent lymphoma | 保留為一般複習活動，不進 registry |
| [v ] | Other | GIST Review | Day 67｜Sarcoma / GIST | 保留為一般複習活動，不進 registry |
| [v ] | Other | CUP Review | Day 68｜CUP / IHC | 保留為一般複習活動，不進 registry |
| [v ] | Other | Tumor-agnostic Review | Day 69｜NET / thyroid / MEN / VHL / tumor-agnostic | 保留為一般複習活動，不進 registry |
| [v ] | Supportive/Stats | Emergency Review | Day 70｜Oncologic emergencies | 保留為一般複習活動，不進 registry |
| [v ] | Supportive/Stats | Toxicity Review | Day 71｜Toxicity mega-review | 保留為一般複習活動，不進 registry |
| [v ] | Supportive/Stats | Stats Review | Day 72｜Statistics / endpoint design | 保留為一般複習活動，不進 registry |
| [v ] | Supportive/Stats | Endpoint Review | Day 72｜Statistics / endpoint design | 保留為一般複習活動，不進 registry |
| [v ] | Mock | 112 Exam | Day 73｜112 first full mock | 保留為一般複習活動，不進 registry |
| [v ] | Mock | 112 Correction | Day 74｜112 correction | 保留為一般複習活動，不進 registry |
| [v ] | Mock | 113 Exam | Day 75｜113 first full mock | 保留為一般複習活動，不進 registry |
| [v ] | Mock | 113 Correction | Day 76｜113 correction | 保留為一般複習活動，不進 registry |
| [v ] | Mock | 114 Exam | Day 77｜114 first full mock | 保留為一般複習活動，不進 registry |
| [v ] | Mock | 114 Correction | Day 78｜114 correction | 保留為一般複習活動，不進 registry |
| [v ] | Mock | Weakness Review | Day 79｜Mixed correction A | 保留為一般複習活動，不進 registry |
| [v ] | Mock | Weakness Review | Day 80｜Mixed correction B | 保留為一般複習活動，不進 registry |
| [v ] | Mock | Trial Boss | Day 81｜Trial card checkpoint | 保留為一般複習活動，不進 registry |
| [ v] | Mock | Readiness Audit | Day 82｜First cycle readiness audit | 保留為一般複習活動，不進 registry |
| [v ] | Weakness Repair | Weakness Review | Day 83｜High-confidence wrong repair | 保留為一般複習活動，不進 registry |
| [v ] | Weakness Repair | Weakness Review | Day 84｜Wrong-rate >=50% Lung/Breast/GI | 保留為一般複習活動，不進 registry |
| [v ] | Weakness Repair | Weakness Review | Day 85｜Wrong-rate >=50% GU/GYN/Heme/Head & Neck | 保留為一般複習活動，不進 registry |
| [v ] | Weakness Repair | Weakness Review | Day 86｜Trial endpoint repair | 保留為一般複習活動，不進 registry |
| [v ] | Weakness Repair | Weakness Review | Day 87｜Biomarker cutoff repair | 保留為一般複習活動，不進 registry |
| [v ] | Weakness Repair | Weakness Review | Day 88｜Toxicity repair | 保留為一般複習活動，不進 registry |
| [v ] | Weakness Repair | Weakness Review | Day 89｜Statistics and trial interpretation repair | 保留為一般複習活動，不進 registry |
| [v ] | Weakness Repair | Weakness Review | Day 90｜Algorithm blank recall + Boss rematch | 保留為一般複習活動，不進 registry |
| [v ] | Mock | 112 Retest | Day 91｜112 full mock retest | 保留為一般複習活動，不進 registry |
| [v ] | Mock | 113 Retest | Day 92｜113 full mock retest | 保留為一般複習活動，不進 registry |
| [v ] | Mock | 114 Retest | Day 93｜114 full mock retest | 保留為一般複習活動，不進 registry |
| [v ] | Mock | Wrong Retest | Day 94｜Wrong-retest 90 checkpoint | 保留為一般複習活動，不進 registry |
| [v ] | Mock | Mixed Correction | Day 95｜Mixed retest correction | 保留為一般複習活動，不進 registry |
| [v ] | Mock | Readiness Audit | Day 96｜Final readiness lock | 保留為一般複習活動，不進 registry |
| [v ] | Mock | Final Board Boss | Day 97｜Final Board Boss | 保留為一般複習活動，不進 registry |
| [v ] | Final Review | Golden Trial Recall | Day 98｜Golden trial rapid recall | 保留為一般複習活動，不進 registry |
| [v ] | Final Review | Biomarker Review | Day 99｜Biomarker and toxicity rapid recall | 保留為一般複習活動，不進 registry |
| [v ] | Final Review | Toxicity Review | Day 99｜Biomarker and toxicity rapid recall | 保留為一般複習活動，不進 registry |
| [v ] | Final Review | Algorithm Recall | Day 100｜Algorithm final sprint | 保留為一般複習活動，不進 registry |

## E. 名稱與別名合併

| 確認 | Canonical name | Aliases |
| --- | --- | --- |
| [ v] | PRODIGE 24 | PRODIGE-24 |
| [v ] | PRODIGE 23 | PRODIGE-23 |
| [v ] | JAVELIN Bladder 100 | JAVELIN-Bladder-100 |
| [v ] | EV-302/KEYNOTE-A39 | EV-302、KEYNOTE-A39 |
| [v ] | CALGB 30610/RTOG 0538 | CALGB 30610、RTOG 0538 |

## 審核完成條件

- 每個衝突都有分類、理由與來源。
- 每個新增 trial 都有核准的 Day，或明確標為 `unassigned`。
- Daily Plan 的 trial 引用均能解析到唯一 canonical name。
- 重新產生此報告後，待審核數量符合人工確認結果。
