import type { ConfigService } from '../../config/config.service';
import { CONFIG_KEYS } from '../../config/config-keys';
import type { LoggerPort } from '../ports/logger.port';
import type { SheetPort } from '../ports/sheet.port';

export class TriggerEventService {
  public constructor(
    private readonly configService: ConfigService,
    private readonly sheetPort: SheetPort,
    private readonly logger: LoggerPort,
  ) {}

  public recordEdit(event: GoogleAppsScript.Events.SheetsOnEdit): void {
    const auditSheetName = this.configService.getOptionalWithDefault(
      CONFIG_KEYS.reportSheetName,
      'Report',
    );
    const row = [
      new Date(),
      event.range.getA1Notation(),
      event.value ?? '',
      event.oldValue ?? '',
    ] as const;

    this.sheetPort.appendRow(auditSheetName, row);
    this.logger.info('Sheet edit recorded', {
      range: event.range.getA1Notation(),
      value: event.value ?? null,
    });
  }
}
