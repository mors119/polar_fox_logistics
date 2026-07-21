import { describe, expect, it, vi } from 'vitest';

import { CONFIG_KEYS } from '../src/config/config-keys';
import { ConfigService, type ConfigurationProvider } from '../src/config/config.service';
import { DailyReportService } from '../src/application/services/daily-report.service';
import type { LoggerPort } from '../src/application/ports/logger.port';
import type {
  MailPort,
  SendHtmlMailInput,
  SendMailInput,
} from '../src/application/ports/mail.port';
import type {
  SheetPort,
  SheetRangeInput,
  SheetTable,
  SheetWriteInput,
} from '../src/application/ports/sheet.port';

class InMemoryConfigurationProvider implements ConfigurationProvider {
  public constructor(private readonly values: Partial<Record<string, string>>) {}

  public get(key: string): string | null {
    return this.values[key] ?? null;
  }
}

class FakeSheetPort implements SheetPort {
  public constructor(private readonly values: SheetTable) {}

  public createSheet(_sheetName: string): void {}

  public readValues(_input: SheetRangeInput): SheetTable {
    return this.values;
  }

  public writeValues(_input: SheetWriteInput): void {}

  public appendRow(_sheetName: string, _row: ReadonlyArray<unknown>): void {}
}

class FakeMailPort implements MailPort {
  public sentMail: SendMailInput | SendHtmlMailInput | null = null;

  public send(input: SendMailInput): void {
    this.sentMail = input;
  }

  public sendHtml(input: SendHtmlMailInput): void {
    this.sentMail = input;
  }
}

describe('DailyReportService', () => {
  it('reads from the configured sheet and sends an HTML report', () => {
    const configService = new ConfigService([
      new InMemoryConfigurationProvider({
        [CONFIG_KEYS.reportRecipient]: 'ops@example.com',
        [CONFIG_KEYS.reportSheetName]: 'Daily Summary',
        [CONFIG_KEYS.reportRange]: 'A1:B2',
      }),
    ]);
    const sheetPort = new FakeSheetPort([
      ['Metric', 'Value'],
      ['Open Tickets', 12],
    ]);
    const mailPort = new FakeMailPort();
    const logger: LoggerPort = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const service = new DailyReportService(configService, sheetPort, mailPort, logger);

    const report = service.run();

    expect(report.sourceSheet).toBe('Daily Summary');
    expect(report.rows).toHaveLength(2);
    expect(mailPort.sentMail).toMatchObject({
      to: 'ops@example.com',
      subject: 'Daily report: Daily Summary',
    });
  });
});
