import { writeFile } from 'node:fs/promises';
import { questions111 } from '../src/data/questions/year111.js';
import { questions112 } from '../src/data/questions/year112.js';
import { questions113 } from '../src/data/questions/year113.js';
import { questions114 } from '../src/data/questions/year114.js';
import { buildQuestionTags } from '../src/data/taxonomy.js';

const DATASETS = [
  { exportName: 'questions111', path: 'src/data/questions/year111.js', questions: questions111 },
  { exportName: 'questions112', path: 'src/data/questions/year112.js', questions: questions112 },
  { exportName: 'questions113', path: 'src/data/questions/year113.js', questions: questions113 },
  { exportName: 'questions114', path: 'src/data/questions/year114.js', questions: questions114 },
];

function withTaxonomyTags(question) {
  return {
    ...question,
    tags: buildQuestionTags(question),
  };
}

function formatDataset(exportName, questions) {
  return `export const ${exportName} = ${JSON.stringify(questions, null, 2)};\n`;
}

let total = 0;
for (const dataset of DATASETS) {
  const taggedQuestions = dataset.questions.map(withTaxonomyTags);
  total += taggedQuestions.length;
  await writeFile(dataset.path, formatDataset(dataset.exportName, taggedQuestions));
  console.log(`${dataset.path}: tagged ${taggedQuestions.length} questions`);
}

console.log(`Tagged ${total} questions total.`);
