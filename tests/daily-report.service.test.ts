import { describe, expect, it, vi } from 'vitest';

import { CONFIG_KEYS } from '../src/config/keys';
import { runDailyReport } from '../src/reports/daily-report';
import type { SendHtmlMailInput } from '../src/shared/gmail';
import type { SheetRange } from '../src/shared/sheets';
import type { SheetTable } from '../src/shared/types';

describe('runDailyReport', () => {
  it('reads from the configured sheet and sends an HTML report', () => {
    const sentMail = {
      current: null as SendHtmlMailInput | null,
    };
    const logger = vi.fn();

    const report = runDailyReport({
      config: {
        [CONFIG_KEYS.reportRecipient]: 'ops@example.com',
        [CONFIG_KEYS.reportSheetName]: 'Daily Summary',
        [CONFIG_KEYS.reportRange]: 'A1:B2',
      },
      readValues: (_input: SheetRange): SheetTable => [
        ['Metric', 'Value'],
        ['Open Tickets', 12],
      ],
      sendReport: (input: SendHtmlMailInput): void => {
        sentMail.current = input;
      },
      info: logger,
    });

    expect(report.sourceSheet).toBe('Daily Summary');
    expect(report.rows).toHaveLength(2);
    expect(sentMail.current).toMatchObject({
      to: 'ops@example.com',
      subject: 'Daily report: Daily Summary',
    });
    expect(logger).toHaveBeenCalled();
  });
});
