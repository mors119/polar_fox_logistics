import { describe, expect, it, vi } from 'vitest';

import type { DriveFileInput, DrivePort } from '../src/application/ports/drive.port';
import type { LoggerPort } from '../src/application/ports/logger.port';
import type {
  SheetPort,
  SheetRangeInput,
  SheetTable,
  SheetWriteInput,
} from '../src/application/ports/sheet.port';
import { ReportSnapshotService } from '../src/application/services/report-snapshot.service';
import { CONFIG_KEYS } from '../src/config/config-keys';
import { ConfigService, type ConfigurationProvider } from '../src/config/config.service';

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

class FakeDrivePort implements DrivePort {
  public lastCreatedFile: DriveFileInput | null = null;

  public ensureFolder(name: string, _parentFolderId?: string): string {
    return `folder:${name}`;
  }

  public createFile(input: DriveFileInput): string {
    this.lastCreatedFile = input;

    return 'file-123';
  }

  public uploadContent(_fileId: string, _content: string, _mimeType?: string): void {}
}

describe('ReportSnapshotService', () => {
  it('exports the configured report range to Drive as json', () => {
    const configService = new ConfigService([
      new InMemoryConfigurationProvider({
        [CONFIG_KEYS.reportSheetName]: 'Daily Summary',
        [CONFIG_KEYS.reportRange]: 'A1:B2',
        [CONFIG_KEYS.reportSnapshotFolder]: 'Team Snapshots',
      }),
    ]);
    const drivePort = new FakeDrivePort();
    const logger: LoggerPort = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const service = new ReportSnapshotService(
      configService,
      new FakeSheetPort([
        ['Metric', 'Value'],
        ['Open Tickets', 12],
      ]),
      drivePort,
      logger,
    );

    const result = service.run();

    expect(result).toMatchObject({
      sourceSheet: 'Daily Summary',
      rangeA1Notation: 'A1:B2',
      rowCount: 2,
      folderId: 'folder:Team Snapshots',
      fileId: 'file-123',
    });
    expect(drivePort.lastCreatedFile).toMatchObject({
      folderId: 'folder:Team Snapshots',
      mimeType: 'application/json',
    });
    expect(drivePort.lastCreatedFile?.content).toContain('"sourceSheet": "Daily Summary"');
  });
});
