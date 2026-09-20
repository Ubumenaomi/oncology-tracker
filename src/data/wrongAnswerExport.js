const EXPORT_THRESHOLD = 3;
const MAX_EXCEL_TEXT_LENGTH = 32767;

const HEADER_STYLE = Object.freeze({
  backgroundColor: '#17365D',
  textColor: '#FFFFFF',
  fontWeight: 'bold',
  align: 'center',
  alignVertical: 'center',
  wrap: true,
  height: 34,
  bottomBorderColor: '#B8C7DA',
  bottomBorderStyle: 'thin',
});

const BODY_STYLE = Object.freeze({
  alignVertical: 'top',
  bottomBorderColor: '#D9E2F3',
  bottomBorderStyle: 'thin',
});

function toExcelText(value) {
  const text = String(value ?? '');
  if (text.length <= MAX_EXCEL_TEXT_LENGTH) return text;
  return `${text.slice(0, MAX_EXCEL_TEXT_LENGTH - 8)}\n[truncated]`;
}

function getEventTime(event) {
  return String(event?.submittedAt || event?.updatedAt || event?.date || '');
}

function getLatestWrongEvent(stat = {}) {
  return (Array.isArray(stat.answerHistory) ? stat.answerHistory : [])
    .filter((event) => event?.isCorrect === false)
    .sort((a, b) => getEventTime(a).localeCompare(getEventTime(b)))
    .at(-1) || null;
}

function getLatestWrongDate(stat = {}, latestWrongEvent = getLatestWrongEvent(stat)) {
  return getEventTime(latestWrongEvent)
    || (stat.lastResult === 'wrong' ? String(stat.lastAttemptAt || '') : '');
}

function getLastResultLabel(result) {
  if (result === 'correct') return '最近答對';
  if (result === 'wrong') return '最近答錯';
  return '無可判分紀錄';
}

export function getFrequentWrongQuestionRows(questions, stats = {}, minimumWrong = EXPORT_THRESHOLD) {
  const threshold = Math.max(1, Number(minimumWrong) || EXPORT_THRESHOLD);
  return (questions || []).flatMap((question) => {
    const stat = stats[question.id] || {};
    if ((Number(stat.wrong) || 0) < threshold) return [];
    const latestWrongEvent = getLatestWrongEvent(stat);
    return [{
      question,
      stat,
      latestWrongEvent,
      latestWrongDate: getLatestWrongDate(stat, latestWrongEvent),
    }];
  }).sort((a, b) => (
    (Number(b.stat.wrong) || 0) - (Number(a.stat.wrong) || 0)
    || b.latestWrongDate.localeCompare(a.latestWrongDate)
    || Number(b.question.year || 0) - Number(a.question.year || 0)
    || Number(a.question.number || 0) - Number(b.question.number || 0)
    || String(a.question.id).localeCompare(String(b.question.id))
  ));
}

function textCell(value, style = {}) {
  return { value: toExcelText(value), type: String, ...BODY_STYLE, ...style };
}

function numberCell(value, style = {}) {
  return { value: Number(value) || 0, type: Number, align: 'right', ...BODY_STYLE, ...style };
}

export function buildFrequentWrongWorkbookData(rows, { exportedAt = new Date(), minimumWrong = EXPORT_THRESHOLD } = {}) {
  const exportedDate = exportedAt instanceof Date && !Number.isNaN(exportedAt.getTime())
    ? exportedAt
    : new Date(exportedAt);
  const exportedDateText = Number.isNaN(exportedDate.getTime())
    ? ''
    : exportedDate.toLocaleString('zh-TW', { hour12: false });
  const columnCount = 21;
  const titleRow = [
    {
      value: `答錯 ${minimumWrong} 次以上題目`,
      type: String,
      columnSpan: columnCount,
      fontWeight: 'bold',
      fontSize: 15,
      textColor: '#17365D',
      alignVertical: 'center',
      height: 30,
    },
    ...Array(columnCount - 1).fill(null),
  ];
  const summaryRow = [
    {
      value: `共 ${rows.length} 題｜門檻：累計答錯次數 ≥ ${minimumWrong}｜匯出時間：${exportedDateText}`,
      type: String,
      columnSpan: columnCount,
      fontStyle: 'italic',
      textColor: '#53657D',
      alignVertical: 'center',
      height: 24,
    },
    ...Array(columnCount - 1).fill(null),
  ];
  const headers = [
    '題號', '年度', '題次', '癌別', '主題', '題幹',
    '選項 A', '選項 B', '選項 C', '選項 D', '選項 E', '正解',
    '答錯次數', '作答次數', '答對次數', '正確率',
    '最近答錯日期', '最近作答結果', '最近錯因', '錯題筆記', '詳解',
  ].map((value) => ({ value, type: String, ...HEADER_STYLE }));

  const dataRows = rows.map(({ question, stat, latestWrongEvent }, index) => {
    const attempts = Number(stat.attempts) || 0;
    const correct = Number(stat.correct) || 0;
    const accuracy = attempts > 0 ? correct / attempts : null;
    const fill = index % 2 ? '#F7F9FC' : '#FFFFFF';
    const base = { backgroundColor: fill };
    return [
      textCell(question.id, { ...base, fontWeight: 'bold' }),
      numberCell(question.year, base),
      numberCell(question.number, base),
      textCell(question.cancer, base),
      textCell(question.topic, base),
      textCell(question.stem, { ...base, wrap: true, height: 64 }),
      textCell(question.options?.A, { ...base, wrap: true }),
      textCell(question.options?.B, { ...base, wrap: true }),
      textCell(question.options?.C, { ...base, wrap: true }),
      textCell(question.options?.D, { ...base, wrap: true }),
      textCell(question.options?.E, { ...base, wrap: true }),
      textCell(stat.correctAnswer || question.answer || '', { ...base, align: 'center', fontWeight: 'bold' }),
      numberCell(stat.wrong, { ...base, fontWeight: 'bold', textColor: '#B91C1C' }),
      numberCell(attempts, base),
      numberCell(correct, base),
      accuracy == null
        ? textCell('', base)
        : { value: accuracy, type: Number, format: '0.0%', align: 'right', ...BODY_STYLE, ...base },
      textCell(getLatestWrongDate(stat, latestWrongEvent).slice(0, 10), base),
      textCell(getLastResultLabel(stat.lastResult), base),
      textCell(latestWrongEvent?.errorType || stat.lastErrorType || '', base),
      textCell(stat.wrongNotes || latestWrongEvent?.wrongNotes || '', { ...base, wrap: true }),
      textCell(stat.explanation || question.explanation || '', { ...base, wrap: true }),
    ];
  });

  return {
    sheetData: [titleRow, summaryRow, headers, ...dataRows],
    columns: [
      { width: 14 }, { width: 8 }, { width: 8 }, { width: 17 }, { width: 18 }, { width: 48 },
      { width: 28 }, { width: 28 }, { width: 28 }, { width: 28 }, { width: 28 }, { width: 9 },
      { width: 11 }, { width: 11 }, { width: 11 }, { width: 10 }, { width: 15 }, { width: 15 },
      { width: 18 }, { width: 34 }, { width: 60 },
    ],
  };
}

export function getFrequentWrongExportFileName(exportedAt = new Date()) {
  const date = exportedAt instanceof Date ? exportedAt : new Date(exportedAt);
  const datePart = Number.isNaN(date.getTime())
    ? 'export'
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `錯題_答錯3次以上_${datePart}.xlsx`;
}

export async function exportFrequentWrongQuestionsXlsx(rows, { exportedAt = new Date() } = {}) {
  if (!rows.length) throw new Error('目前沒有答錯 3 次以上的題目可匯出。');
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const { sheetData, columns } = buildFrequentWrongWorkbookData(rows, { exportedAt });
  const fileName = getFrequentWrongExportFileName(exportedAt);
  await writeExcelFile(sheetData, {
    sheet: '錯3次以上',
    columns,
    stickyRowsCount: 3,
    stickyColumnsCount: 2,
    showGridLines: false,
    orientation: 'landscape',
    zoomScale: 0.8,
  }, {
    fontFamily: 'Arial',
    fontSize: 10,
  }).toFile(fileName);
  return { fileName, count: rows.length };
}
