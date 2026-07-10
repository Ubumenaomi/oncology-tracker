import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const backupPath = process.argv[2];
if (!backupPath) {
  console.error('Usage: npm run questions:promote -- /path/to/oncology-backup.json');
  process.exit(1);
}

const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
const years = [111, 112, 113, 114];
const validAnswer = (value) => /^[A-E]$/.test(String(value || '').trim().toUpperCase());
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const changedQuestionIds = [];
const fieldCounts = {};

function recordChange(id, field) {
  changedQuestionIds.push(id);
  fieldCounts[field] = (fieldCounts[field] || 0) + 1;
}

for (const year of years) {
  const sourcePath = path.resolve(`src/data/questions/year${year}.js`);
  const moduleUrl = `${pathToFileURL(sourcePath).href}?promote=${Date.now()}`;
  const module = await import(moduleUrl);
  const exportName = `questions${year}`;
  const questions = module[exportName];

  for (const question of questions) {
    const override = backup.questionOverrides?.[question.id] || {};
    const stat = backup.stats?.[question.id] || {};

    for (const field of ['stem', 'cancer', 'topic', 'notionUrl']) {
      if (hasText(override[field]) && override[field] !== question[field]) {
        question[field] = override[field].trim();
        recordChange(question.id, field);
      }
    }

    if (override.options && typeof override.options === 'object'
      && Object.values(override.options).some(hasText)
      && JSON.stringify(override.options) !== JSON.stringify(question.options)) {
      question.options = { ...question.options, ...override.options };
      recordChange(question.id, 'options');
    }

    if (Array.isArray(override.trials)
      && JSON.stringify(override.trials) !== JSON.stringify(question.trials || [])) {
      question.trials = override.trials;
      recordChange(question.id, 'trials');
    }

    const promotedAnswer = validAnswer(override.answer)
      ? String(override.answer).trim().toUpperCase()
      : validAnswer(stat.correctAnswer)
        ? String(stat.correctAnswer).trim().toUpperCase()
        : null;
    if (promotedAnswer && promotedAnswer !== question.answer) {
      question.answer = promotedAnswer;
      recordChange(question.id, 'answer');
    }

    const promotedExplanation = hasText(override.explanation)
      ? override.explanation.trim()
      : hasText(stat.explanation)
        ? stat.explanation.trim()
        : '';
    if (promotedExplanation && promotedExplanation !== question.explanation) {
      question.explanation = promotedExplanation;
      recordChange(question.id, 'explanation');
    }
  }

  fs.writeFileSync(sourcePath, `export const ${exportName} = ${JSON.stringify(questions, null, 2)};\n`);
}

const uniqueQuestionIds = [...new Set(changedQuestionIds)];
console.log(JSON.stringify({
  backup: path.resolve(backupPath),
  changedQuestions: uniqueQuestionIds.length,
  fieldCounts,
  skippedBlankCustomQuestions: Object.values(backup.customQuestions || {}).filter((q) => !hasText(q.stem)).length,
}, null, 2));
