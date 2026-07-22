import { CONFIG_KEYS } from '../config/keys';
import { getConfigOrDefault, getRequiredConfig, type ConfigValues } from '../shared/config';
import { sendHtmlMail, type SendHtmlMailInput } from '../shared/gmail';
import { logInfo } from '../shared/logger';
import { readSheetValues } from '../shared/sheets';
import type { SheetCellValue, SheetTable } from '../shared/types';

interface DailyReport {
  readonly generatedAt: Date;
  readonly sourceSheet: string;
  readonly rows: SheetTable;
}

export interface RunDailyReportDependencies {
  readonly config?: ConfigValues;
  readonly now?: () => Date;
  readonly readValues?: typeof readSheetValues;
  readonly sendReport?: (input: SendHtmlMailInput) => void;
  readonly info?: typeof logInfo;
}

export function runDailyReport(dependencies: RunDailyReportDependencies = {}): DailyReport {
  const reportRecipient = getRequiredConfig(CONFIG_KEYS.reportRecipient, dependencies.config);
  const sourceSheet = getConfigOrDefault(
    CONFIG_KEYS.reportSheetName,
    'Report',
    dependencies.config,
  );
  const reportRange = getConfigOrDefault(CONFIG_KEYS.reportRange, 'A1:C10', dependencies.config);
  const rows = (dependencies.readValues ?? readSheetValues)({
    sheetName: sourceSheet,
    rangeA1Notation: reportRange,
  });
  const now = dependencies.now ?? getCurrentDate;
  const report = {
    generatedAt: now(),
    sourceSheet,
    rows,
  } satisfies DailyReport;

  (dependencies.sendReport ?? sendHtmlMail)({
    to: reportRecipient,
    subject: `Daily report: ${sourceSheet}`,
    body: renderPlainTextReport(report),
    htmlBody: renderHtmlReport(report),
  });

  (dependencies.info ?? logInfo)('Daily report sent', {
    reportRecipient,
    sourceSheet,
    rowCount: rows.length,
  });

  return report;
}

function getCurrentDate(): Date {
  return new Date();
}

function renderPlainTextReport(report: DailyReport): string {
  return [
    `Generated at: ${report.generatedAt.toISOString()}`,
    `Source sheet: ${report.sourceSheet}`,
    '',
    ...report.rows.map((row) => row.map((cell) => normalizeCell(cell)).join(' | ')),
  ].join('\n');
}

function renderHtmlReport(report: DailyReport): string {
  const rowsHtml = report.rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(normalizeCell(cell))}</td>`).join('')}</tr>`,
    )
    .join('');

  return [
    `<h2>Daily Report: ${escapeHtml(report.sourceSheet)}</h2>`,
    `<p>Generated at ${escapeHtml(report.generatedAt.toISOString())}</p>`,
    '<table border="1" cellpadding="6" cellspacing="0">',
    rowsHtml,
    '</table>',
  ].join('');
}

function normalizeCell(value: SheetCellValue): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value === null) {
    return '';
  }

  return String(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
