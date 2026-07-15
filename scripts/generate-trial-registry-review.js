import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { studyPlan100, trialRegistry, trialRegistryReview } from '../src/data/studyPlan100.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(root, 'docs', 'trial-registry-status.md');
const taskById = new Map(studyPlan100.map((task) => [task.id, task]));
const activityPattern = /(review|boss|exam|correction|retest|audit|recall|interpretation)$/i;
const pending = trialRegistry.filter((record) => record.reviewStatus === 'pending');
const conflicts = pending.filter((record) => record.conflict);
const registryOnly = pending.filter((record) => !record.conflict);
const aliases = trialRegistry.filter((record) => record.aliases.length > 0);
const planOnlyTrials = trialRegistryReview.unregisteredPlanItems.filter((item) => !activityPattern.test(item.name));
const planOnlyActivities = trialRegistryReview.unregisteredPlanItems.filter((item) => activityPattern.test(item.name));

function taskLabels(dayIds) {
  if (!dayIds.length) return '未找到合適的現有主題，維持 unassigned';
  return dayIds.map((id) => {
    const task = taskById.get(id);
    return task ? `${task.day}｜${task.topic}` : `Day ${id}`;
  }).join('；');
}

function reviewRows(records) {
  return records.map((record) => (
    `| [ ] | ${record.cancer} | ${record.canonicalName} | ${record.classification} | ${taskLabels(record.proposedDayIds)} | `
    + `${record.conflict ? '現有 Daily Plan 將此項放在 goldenTrials；需逐筆決定分類。' : '依癌別與臨床主題建議；核准前不進正式 Boss 名單。'} |`
  )).join('\n');
}

const counts = [...new Set(trialRegistry.map((record) => record.cancer))].map((cancer) => {
  const rows = trialRegistry.filter((record) => record.cancer === cancer);
  return `| ${cancer} | ${rows.filter((row) => row.classification === 'golden').length} | ${rows.filter((row) => row.classification === 'related').length} | ${rows.filter((row) => row.reviewStatus === 'approved').length} | ${rows.filter((row) => row.reviewStatus === 'pending').length} |`;
}).join('\n');

const report = `# Trial Registry 審核清單

產生日期：2026-07-15  
候選來源：\`Oncology_Trial_Registry_2026-07-15/docs/trial-registry/*.md\`  
規則：只有勾選並寫回為 \`approved\` 的項目，才可進入 Daily Plan 與 Boss Challenge。
核准方式：完成查核後，將決定寫入 \`src/data/trialRegistry.js\` 的 \`TRIAL_REVIEW_DECISIONS\`，再重新執行 \`npm run trials:review\`。

## 摘要

| 癌別 | Golden 候選 | Related 候選 | 已核准 | 待審核 |
| --- | ---: | ---: | ---: | ---: |
${counts}

## A. 明確分類衝突

| 確認 | 癌別 | Trial | Registry 分類 | 現有／建議主題 | 審核理由 |
| --- | --- | --- | --- | --- | --- |
${reviewRows(conflicts)}

審核時請將分類改成 \`golden\`、\`related\` 或 \`exclude\`，並保留一句理由。原始研究或 guideline 來源應一併補在該列下方。

## B. Registry 新增或尚未核准

| 確認 | 癌別 | Trial | 候選分類 | 建議主題 | 審核理由 |
| --- | --- | --- | --- | --- | --- |
${reviewRows(registryOnly)}

## C. Daily Plan 有、Registry 沒有的疑似 Trial

| 確認 | 癌別 | 名稱 | 現有主題 | 決定 |
| --- | --- | --- | --- | --- |
${planOnlyTrials.map((item) => `| [ ] | ${item.cancer} | ${item.name} | ${item.day}｜${item.topic} | golden / related / exclude |`).join('\n')}

## D. 非 Trial 活動（建議移出 trial 欄位）

| 確認 | 癌別 | 名稱 | 現有主題 | 建議 |
| --- | --- | --- | --- | --- |
${planOnlyActivities.map((item) => `| [ ] | ${item.cancer} | ${item.name} | ${item.day}｜${item.topic} | 保留為一般複習活動，不進 registry |`).join('\n')}

## E. 名稱與別名合併

| 確認 | Canonical name | Aliases |
| --- | --- | --- |
${aliases.map((record) => `| [ ] | ${record.canonicalName} | ${record.aliases.join('、')} |`).join('\n')}

## 審核完成條件

- 每個衝突都有分類、理由與來源。
- 每個新增 trial 都有核准的 Day，或明確標為 \`unassigned\`。
- Daily Plan 的 trial 引用均能解析到唯一 canonical name。
- 重新產生此報告後，待審核數量符合人工確認結果。
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, report);
console.log(`Wrote ${path.relative(root, outputPath)}`);
