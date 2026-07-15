# Trial Registry 審核清單

產生日期：2026-07-15  
候選來源：`Oncology_Trial_Registry_2026-07-15/docs/trial-registry/*.md`  
規則：只有勾選並寫回為 `approved` 的項目，才可進入 Daily Plan 與 Boss Challenge。
核准方式：完成查核後，將決定寫入 `src/data/trialRegistry.js` 的 `TRIAL_REVIEW_DECISIONS`，再重新執行 `npm run trials:review`。

## 摘要

| 癌別 | Golden 候選 | Related 候選 | 已核准 | 待審核 |
| --- | ---: | ---: | ---: | ---: |
| Breast | 19 | 5 | 24 | 0 |
| GI | 24 | 9 | 33 | 0 |
| GU | 14 | 7 | 21 | 0 |
| GYN | 9 | 2 | 11 | 0 |
| Head & Neck | 7 | 2 | 9 | 0 |
| Heme | 12 | 5 | 17 | 0 |
| Lung | 24 | 5 | 29 | 0 |
| Other | 6 | 5 | 11 | 0 |

## A. 明確分類衝突

| 確認 | 癌別 | Trial | Registry 分類 | 現有／建議主題 | 審核理由 |
| --- | --- | --- | --- | --- | --- |


審核時請將分類改成 `golden`、`related` 或 `exclude`，並保留一句理由。原始研究或 guideline 來源應一併補在該列下方。

## B. Registry 新增或尚未核准

| 確認 | 癌別 | Trial | 候選分類 | 建議主題 | 審核理由 |
| --- | --- | --- | --- | --- | --- |


## C. Daily Plan 有、Registry 沒有的疑似 Trial

| 確認 | 癌別 | 名稱 | 現有主題 | 決定 |
| --- | --- | --- | --- | --- |


## D. 非 Trial 活動（建議移出 trial 欄位）

| 確認 | 癌別 | 名稱 | 現有主題 | 建議 |
| --- | --- | --- | --- | --- |
| [ ] | Lung | Toxicity Review | Day 12｜Lung toxicity drill | 保留為一般複習活動，不進 registry |
| [ ] | Lung | Lung Boss | Day 13｜Lung boss prep | 保留為一般複習活動，不進 registry |
| [ ] | Breast | Toxicity Review | Day 24｜Breast toxicity drill | 保留為一般複習活動，不進 registry |
| [ ] | Breast | Golden Trial Recall | Day 25｜Breast trial endpoint recall | 保留為一般複習活動，不進 registry |
| [ ] | Breast | Breast Boss | Day 26｜Breast boss prep | 保留為一般複習活動，不進 registry |
| [ ] | GI | GIST Review | Day 36｜GIST and NET | 保留為一般複習活動，不進 registry |
| [ ] | GI | Toxicity Review | Day 37｜GI toxicity and supportive traps | 保留為一般複習活動，不進 registry |
| [ ] | GI | GI Boss | Day 38｜GI boss prep | 保留為一般複習活動，不進 registry |
| [ ] | GU | Seminoma Review | Day 44｜Seminoma and germ cell | 保留為一般複習活動，不進 registry |
| [ ] | GU | Biomarker Review | Day 45｜GU biomarkers | 保留為一般複習活動，不進 registry |
| [ ] | GU | Toxicity Review | Day 46｜GU toxicity drill | 保留為一般複習活動，不進 registry |
| [ ] | GU | Weakness Review | Day 47｜GU mixed correction | 保留為一般複習活動，不進 registry |
| [ ] | GYN | Trial Interpretation | Day 52｜GYN trial interpretation | 保留為一般複習活動，不進 registry |
| [ ] | GYN | Toxicity Review | Day 53｜GYN toxicity drill | 保留為一般複習活動，不進 registry |
| [ ] | GYN | Algorithm Recall | Day 54｜GYN rapid algorithm | 保留為一般複習活動，不進 registry |
| [ ] | GYN | Weakness Review | Day 55｜GYN mixed correction | 保留為一般複習活動，不進 registry |
| [ ] | Head & Neck | HPV HNSCC Review | Day 56｜HPV oropharynx and staging | 保留為一般複習活動，不進 registry |
| [ ] | Head & Neck | Head & Neck Boss | Day 60｜Head & Neck boss prep | 保留為一般複習活動，不進 registry |
| [ ] | Heme | CLL Review | Day 63｜Indolent lymphoma | 保留為一般複習活動，不進 registry |
| [ ] | Other | GIST Review | Day 67｜Sarcoma / GIST | 保留為一般複習活動，不進 registry |
| [ ] | Other | CUP Review | Day 68｜CUP / IHC | 保留為一般複習活動，不進 registry |
| [ ] | Other | Tumor-agnostic Review | Day 69｜NET / thyroid / MEN / VHL / tumor-agnostic | 保留為一般複習活動，不進 registry |
| [ ] | Supportive/Stats | Emergency Review | Day 70｜Oncologic emergencies | 保留為一般複習活動，不進 registry |
| [ ] | Supportive/Stats | Toxicity Review | Day 71｜Toxicity mega-review | 保留為一般複習活動，不進 registry |
| [ ] | Supportive/Stats | Stats Review | Day 72｜Statistics / endpoint design | 保留為一般複習活動，不進 registry |
| [ ] | Supportive/Stats | Endpoint Review | Day 72｜Statistics / endpoint design | 保留為一般複習活動，不進 registry |
| [ ] | Mock | 112 Exam | Day 73｜112 first full mock | 保留為一般複習活動，不進 registry |
| [ ] | Mock | 112 Correction | Day 74｜112 correction | 保留為一般複習活動，不進 registry |
| [ ] | Mock | 113 Exam | Day 75｜113 first full mock | 保留為一般複習活動，不進 registry |
| [ ] | Mock | 113 Correction | Day 76｜113 correction | 保留為一般複習活動，不進 registry |
| [ ] | Mock | 114 Exam | Day 77｜114 first full mock | 保留為一般複習活動，不進 registry |
| [ ] | Mock | 114 Correction | Day 78｜114 correction | 保留為一般複習活動，不進 registry |
| [ ] | Mock | Weakness Review | Day 79｜Mixed correction A | 保留為一般複習活動，不進 registry |
| [ ] | Mock | Weakness Review | Day 80｜Mixed correction B | 保留為一般複習活動，不進 registry |
| [ ] | Mock | Trial Boss | Day 81｜Trial card checkpoint | 保留為一般複習活動，不進 registry |
| [ ] | Mock | Readiness Audit | Day 82｜First cycle readiness audit | 保留為一般複習活動，不進 registry |
| [ ] | Weakness Repair | Weakness Review | Day 83｜High-confidence wrong repair | 保留為一般複習活動，不進 registry |
| [ ] | Weakness Repair | Weakness Review | Day 84｜Wrong-rate >=50% Lung/Breast/GI | 保留為一般複習活動，不進 registry |
| [ ] | Weakness Repair | Weakness Review | Day 85｜Wrong-rate >=50% GU/GYN/Heme/Head & Neck | 保留為一般複習活動，不進 registry |
| [ ] | Weakness Repair | Weakness Review | Day 86｜Trial endpoint repair | 保留為一般複習活動，不進 registry |
| [ ] | Weakness Repair | Weakness Review | Day 87｜Biomarker cutoff repair | 保留為一般複習活動，不進 registry |
| [ ] | Weakness Repair | Weakness Review | Day 88｜Toxicity repair | 保留為一般複習活動，不進 registry |
| [ ] | Weakness Repair | Weakness Review | Day 89｜Statistics and trial interpretation repair | 保留為一般複習活動，不進 registry |
| [ ] | Weakness Repair | Weakness Review | Day 90｜Algorithm blank recall + Boss rematch | 保留為一般複習活動，不進 registry |
| [ ] | Mock | 112 Retest | Day 91｜112 full mock retest | 保留為一般複習活動，不進 registry |
| [ ] | Mock | 113 Retest | Day 92｜113 full mock retest | 保留為一般複習活動，不進 registry |
| [ ] | Mock | 114 Retest | Day 93｜114 full mock retest | 保留為一般複習活動，不進 registry |
| [ ] | Mock | Wrong Retest | Day 94｜Wrong-retest 90 checkpoint | 保留為一般複習活動，不進 registry |
| [ ] | Mock | Mixed Correction | Day 95｜Mixed retest correction | 保留為一般複習活動，不進 registry |
| [ ] | Mock | Readiness Audit | Day 96｜Final readiness lock | 保留為一般複習活動，不進 registry |
| [ ] | Mock | Final Board Boss | Day 97｜Final Board Boss | 保留為一般複習活動，不進 registry |
| [ ] | Final Review | Golden Trial Recall | Day 98｜Golden trial rapid recall | 保留為一般複習活動，不進 registry |
| [ ] | Final Review | Biomarker Review | Day 99｜Biomarker and toxicity rapid recall | 保留為一般複習活動，不進 registry |
| [ ] | Final Review | Toxicity Review | Day 99｜Biomarker and toxicity rapid recall | 保留為一般複習活動，不進 registry |
| [ ] | Final Review | Algorithm Recall | Day 100｜Algorithm final sprint | 保留為一般複習活動，不進 registry |

## E. 名稱與別名合併

| 確認 | Canonical name | Aliases |
| --- | --- | --- |
| [ ] | PRODIGE 24 | PRODIGE-24 |
| [ ] | PRODIGE 23 | PRODIGE-23 |
| [ ] | JAVELIN Bladder 100 | JAVELIN-Bladder-100 |
| [ ] | EV-302/KEYNOTE-A39 | EV-302、KEYNOTE-A39 |
| [ ] | CALGB 30610/RTOG 0538 | CALGB 30610、RTOG 0538 |

## 審核完成條件

- 每個衝突都有分類、理由與來源。
- 每個新增 trial 都有核准的 Day，或明確標為 `unassigned`。
- Daily Plan 的 trial 引用均能解析到唯一 canonical name。
- 重新產生此報告後，待審核數量符合人工確認結果。
