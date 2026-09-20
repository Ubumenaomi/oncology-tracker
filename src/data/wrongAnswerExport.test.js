import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFrequentWrongWorkbookData,
  getFrequentWrongExportFileName,
  getFrequentWrongQuestionRows,
} from './wrongAnswerExport.js';

const questions = [
  { id: '114-Q001', year: 114, number: 1, cancer: 'Lung', topic: 'Metastatic', stem: 'Question 1', options: { A: 'A1', B: 'B1' }, answer: 'B', explanation: 'Bank explanation' },
  { id: '113-Q002', year: 113, number: 2, cancer: 'GI', topic: 'Adjuvant', stem: 'Question 2', options: { A: 'A2' }, answer: 'A' },
  { id: '112-Q003', year: 112, number: 3, cancer: 'Breast', topic: 'Biomarker', stem: 'Question 3', options: { A: 'A3' }, answer: 'A' },
];

const stats = {
  '114-Q001': { wrong: 3, correct: 2, attempts: 5, lastResult: 'correct', correctAnswer: 'C', wrongNotes: 'Review cutoff', explanation: 'Edited explanation', answerHistory: [{ isCorrect: false, submittedAt: '2026-09-18T10:00:00Z', errorType: 'Biomarker cutoff' }] },
  '113-Q002': { wrong: 2, correct: 1, attempts: 3, lastResult: 'wrong', lastAttemptAt: '2026-09-19' },
  '112-Q003': { wrong: 5, correct: 0, attempts: 5, lastResult: 'wrong', answerHistory: [{ isCorrect: false, submittedAt: '2026-09-20T10:00:00Z', errorType: 'Knowledge gap' }] },
};

test('exports every retained question with at least three actual wrong attempts', () => {
  const rows = getFrequentWrongQuestionRows(questions, stats);
  assert.deepEqual(rows.map((row) => row.question.id), ['112-Q003', '114-Q001']);
  assert.equal(rows[1].latestWrongDate, '2026-09-18T10:00:00Z');
});

test('workbook data contains typed counts, edited answers, notes, and explanations', () => {
  const rows = getFrequentWrongQuestionRows(questions, stats);
  const { sheetData, columns } = buildFrequentWrongWorkbookData(rows, { exportedAt: new Date('2026-09-20T12:00:00Z') });
  assert.equal(sheetData.length, 5);
  assert.equal(columns.length, 21);
  assert.equal(sheetData[2][0].value, '題號');
  const editedRow = sheetData.find((row) => row[0]?.value === '114-Q001');
  assert.equal(editedRow[11].value, 'C');
  assert.equal(editedRow[12].value, 3);
  assert.equal(editedRow[15].value, 0.4);
  assert.equal(editedRow[18].value, 'Biomarker cutoff');
  assert.equal(editedRow[19].value, 'Review cutoff');
  assert.equal(editedRow[20].value, 'Edited explanation');
});

test('uses a stable Traditional Chinese xlsx filename', () => {
  assert.equal(getFrequentWrongExportFileName(new Date(2026, 8, 20)), '錯題_答錯3次以上_2026-09-20.xlsx');
});

