import { CONFIG_KEYS } from '../config/keys';
import { getConfigOrDefault, type ConfigValues } from '../shared/config';
import { createDriveFile, ensureDriveFolder, type DriveFileInput } from '../shared/drive';
import { logInfo } from '../shared/logger';
import { readSheetValues } from '../shared/sheets';

interface ReportSnapshotResult {
  readonly sourceSheet: string;
  readonly rangeA1Notation: string;
  readonly rowCount: number;
  readonly folderId: string;
  readonly fileId: string;
  readonly fileName: string;
}

export interface ExportReportSnapshotDependencies {
  readonly config?: ConfigValues;
  readonly now?: () => Date;
  readonly readValues?: typeof readSheetValues;
  readonly ensureFolder?: typeof ensureDriveFolder;
  readonly createFile?: (input: DriveFileInput) => string;
  readonly info?: typeof logInfo;
}

export function exportReportSnapshot(
  dependencies: ExportReportSnapshotDependencies = {},
): ReportSnapshotResult {
  const sourceSheet = getConfigOrDefault(
    CONFIG_KEYS.reportSheetName,
    'Report',
    dependencies.config,
  );
  const rangeA1Notation = getConfigOrDefault(
    CONFIG_KEYS.reportRange,
    'A1:C10',
    dependencies.config,
  );
  const snapshotFolderName = getConfigOrDefault(
    CONFIG_KEYS.reportSnapshotFolder,
    'Report Snapshots',
    dependencies.config,
  );
  const rows = (dependencies.readValues ?? readSheetValues)({
    sheetName: sourceSheet,
    rangeA1Notation,
  });
  const folderId = (dependencies.ensureFolder ?? ensureDriveFolder)(snapshotFolderName);
  const now = dependencies.now ?? getCurrentDate;
  const exportedAt = now();
  const fileName = createSnapshotFileName(sourceSheet, exportedAt);
  const fileId = (dependencies.createFile ?? createDriveFile)({
    folderId,
    fileName,
    content: JSON.stringify(
      {
        sourceSheet,
        rangeA1Notation,
        exportedAt: exportedAt.toISOString(),
        rows,
      },
      null,
      2,
    ),
    mimeType: 'application/json',
  });

  (dependencies.info ?? logInfo)('Report snapshot exported', {
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

function getCurrentDate(): Date {
  return new Date();
}

function createSnapshotFileName(sourceSheet: string, exportedAt: Date): string {
  const timestamp = exportedAt.toISOString().replace(/[:.]/g, '-');
  const normalizedSheetName = sourceSheet.trim().replace(/\s+/g, '-').toLowerCase();

  return `${normalizedSheetName || 'report'}-${timestamp}.json`;
}
