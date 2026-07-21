import type { ConfigService } from '../../config/config.service';
import { CONFIG_KEYS } from '../../config/config-keys';
import type { DrivePort } from '../ports/drive.port';
import type { LoggerPort } from '../ports/logger.port';
import type { SheetPort } from '../ports/sheet.port';

export interface ReportSnapshotResult {
  readonly sourceSheet: string;
  readonly rangeA1Notation: string;
  readonly rowCount: number;
  readonly folderId: string;
  readonly fileId: string;
  readonly fileName: string;
}

export class ReportSnapshotService {
  public constructor(
    private readonly configService: ConfigService,
    private readonly sheetPort: SheetPort,
    private readonly drivePort: DrivePort,
    private readonly logger: LoggerPort,
  ) {}

  public run(): ReportSnapshotResult {
    const sourceSheet = this.configService.getOptionalWithDefault(
      CONFIG_KEYS.reportSheetName,
      'Report',
    );
    const rangeA1Notation = this.configService.getOptionalWithDefault(
      CONFIG_KEYS.reportRange,
      'A1:C10',
    );
    const snapshotFolderName = this.configService.getOptionalWithDefault(
      CONFIG_KEYS.reportSnapshotFolder,
      'Report Snapshots',
    );
    const rows = this.sheetPort.readValues({
      sheetName: sourceSheet,
      rangeA1Notation,
    });
    const folderId = this.drivePort.ensureFolder(snapshotFolderName);
    const fileName = this.createFileName(sourceSheet);
    const fileId = this.drivePort.createFile({
      folderId,
      fileName,
      content: JSON.stringify(
        {
          sourceSheet,
          rangeA1Notation,
          exportedAt: new Date().toISOString(),
          rows,
        },
        null,
        2,
      ),
      mimeType: 'application/json',
    });

    this.logger.info('Report snapshot exported', {
      sourceSheet,
      rangeA1Notation,
      rowCount: rows.length,
      folderId,
      fileId,
    });

    return {
      sourceSheet,
      rangeA1Notation,
      rowCount: rows.length,
      folderId,
      fileId,
      fileName,
    };
  }

  private createFileName(sourceSheet: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const normalizedSheetName = sourceSheet.trim().replace(/\s+/g, '-').toLowerCase();

    return `${normalizedSheetName || 'report'}-${timestamp}.json`;
  }
}
