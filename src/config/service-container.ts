import { DailyReportService } from '../application/services/daily-report.service';
import { ReportSnapshotService } from '../application/services/report-snapshot.service';
import { TriggerEventService } from '../application/services/trigger-event.service';
import { WebAppService } from '../application/services/web-app.service';
import { WorkspaceMenuService } from '../application/services/workspace-menu.service';
import { ConfigService, type ConfigurationProvider } from './config.service';
import { ScriptPropertiesConfigurationProvider } from './providers/script-properties.provider';
import { StaticConfigurationProvider } from './providers/static.provider';
import { CalendarAdapter } from '../infrastructure/adapters/calendar/calendar.adapter';
import { DriveAdapter } from '../infrastructure/adapters/drive/drive.adapter';
import { GmailAdapter } from '../infrastructure/adapters/gmail/gmail.adapter';
import { SheetsAdapter } from '../infrastructure/adapters/sheets/sheets.adapter';
import { AppsScriptUiAdapter } from '../infrastructure/adapters/ui/apps-script-ui.adapter';
import { AppsScriptHttpAdapter } from '../infrastructure/http/apps-script-http.adapter';
import { AppsScriptLogger } from '../infrastructure/logging/apps-script-logger';
import type { CalendarPort } from '../application/ports/calendar.port';
import type { DrivePort } from '../application/ports/drive.port';
import type { HttpPort } from '../application/ports/http.port';
import type { LoggerPort } from '../application/ports/logger.port';
import type { MailPort } from '../application/ports/mail.port';
import type { SheetPort } from '../application/ports/sheet.port';
import type { UiPort } from '../application/ports/ui.port';
import type { ConfigKey } from './config-keys';

export interface AppContainer {
  readonly configService: ConfigService;
  readonly logger: LoggerPort;
  readonly httpPort: HttpPort;
  readonly sheetPort: SheetPort;
  readonly mailPort: MailPort;
  readonly calendarPort: CalendarPort;
  readonly drivePort: DrivePort;
  readonly uiPort: UiPort;
  readonly dailyReportService: DailyReportService;
  readonly reportSnapshotService: ReportSnapshotService;
  readonly triggerEventService: TriggerEventService;
  readonly webAppService: WebAppService;
  readonly workspaceMenuService: WorkspaceMenuService;
}

export interface CreateAppContainerOptions {
  readonly environment?: Partial<Record<ConfigKey, string>>;
  readonly providers?: ReadonlyArray<ConfigurationProvider>;
}

export const createAppContainer = (options: CreateAppContainerOptions = {}): AppContainer => {
  const providers = options.providers ?? [
    new StaticConfigurationProvider(options.environment ?? {}),
    new ScriptPropertiesConfigurationProvider(PropertiesService.getScriptProperties()),
  ];
  const configService = new ConfigService(providers);
  const logger = new AppsScriptLogger();
  const httpPort = new AppsScriptHttpAdapter();
  const sheetPort = new SheetsAdapter();
  const mailPort = new GmailAdapter();
  const calendarPort = new CalendarAdapter();
  const drivePort = new DriveAdapter();
  const uiPort = new AppsScriptUiAdapter();
  const dailyReportService = new DailyReportService(configService, sheetPort, mailPort, logger);
  const reportSnapshotService = new ReportSnapshotService(
    configService,
    sheetPort,
    drivePort,
    logger,
  );
  const triggerEventService = new TriggerEventService(configService, sheetPort, logger);
  const webAppService = new WebAppService(configService, drivePort, logger);
  const workspaceMenuService = new WorkspaceMenuService(configService, uiPort);

  return {
    configService,
    logger,
    httpPort,
    sheetPort,
    mailPort,
    calendarPort,
    drivePort,
    uiPort,
    dailyReportService,
    reportSnapshotService,
    triggerEventService,
    webAppService,
    workspaceMenuService,
  };
};
