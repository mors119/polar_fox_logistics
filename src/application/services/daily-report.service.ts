import type { ConfigService } from '../../config/config.service';
import { CONFIG_KEYS } from '../../config/config-keys';
import type { DailyReportEntity } from '../../domain/entities/daily-report.entity';
import type { LoggerPort } from '../ports/logger.port';
import type { MailPort } from '../ports/mail.port';
import type { SheetTable, SheetPort } from '../ports/sheet.port';

export class DailyReportService {
  public constructor(
    private readonly configService: ConfigService,
    private readonly sheetPort: SheetPort,
    private readonly mailPort: MailPort,
    private readonly logger: LoggerPort,
  ) {}

  public run(): DailyReportEntity {
    const reportRecipient = this.configService.getRequired(CONFIG_KEYS.reportRecipient);
    const sourceSheet = this.configService.getOptionalWithDefault(
      CONFIG_KEYS.reportSheetName,
      'Report',
    );
    const reportRange = this.configService.getOptionalWithDefault(
      CONFIG_KEYS.reportRange,
      'A1:C10',
    );
    const rows = this.sheetPort.readValues({
      sheetName: sourceSheet,
      rangeA1Notation: reportRange,
    });
    const report = {
      generatedAt: new Date(),
      sourceSheet,
      rows,
    } satisfies DailyReportEntity;

    const subject = `Daily report: ${sourceSheet}`;
    const body = this.renderPlainTextReport(report);
    const htmlBody = this.renderHtmlReport(report);

    this.mailPort.sendHtml({
      to: reportRecipient,
      subject,
      body,
      htmlBody,
    });

    this.logger.info('Daily report sent', {
      reportRecipient,
      sourceSheet,
      rowCount: rows.length,
    });

    return report;
  }

  private renderPlainTextReport(report: DailyReportEntity): string {
    return [
      `Generated at: ${report.generatedAt.toISOString()}`,
      `Source sheet: ${report.sourceSheet}`,
      '',
      ...report.rows.map((row) => row.map((cell) => this.normalizeCell(cell)).join(' | ')),
    ].join('\n');
  }

  private renderHtmlReport(report: DailyReportEntity): string {
    const rowsHtml = report.rows
      .map(
        (row) =>
          `<tr>${row
            .map((cell) => `<td>${this.escapeHtml(this.normalizeCell(cell))}</td>`)
            .join('')}</tr>`,
      )
      .join('');

    return [
      `<h2>Daily Report: ${this.escapeHtml(report.sourceSheet)}</h2>`,
      `<p>Generated at ${this.escapeHtml(report.generatedAt.toISOString())}</p>`,
      '<table border="1" cellpadding="6" cellspacing="0">',
      rowsHtml,
      '</table>',
    ].join('');
  }

  private normalizeCell(value: SheetTable[number][number]): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value === null) {
      return '';
    }

    return String(value);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
