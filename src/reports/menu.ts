import { CONFIG_KEYS } from '../config/keys';
import { getConfigOrDefault, type ConfigValues } from '../shared/config';
import { createMenu, showAlert, type MenuItem } from '../shared/ui';
import { runDailyReport } from './daily-report';
import { exportReportSnapshot } from './report-snapshot';

export const REPORT_MENU_ITEMS: ReadonlyArray<MenuItem> = [
  { label: 'Run Daily Report', functionName: 'runDailyReportMenuAction' },
  { label: 'Export Report Snapshot', functionName: 'exportReportSnapshotMenuAction' },
  { label: 'Show Starter Help', functionName: 'showStarterHelpMenuAction' },
];

export function installWorkspaceMenu(config: ConfigValues = {}): void {
  createMenu(getConfigOrDefault(CONFIG_KEYS.reportMenuTitle, 'Workspace Starter', config), [
    ...REPORT_MENU_ITEMS,
  ]);
}

export function runDailyReportMenuAction(): void {
  const report = runDailyReport();
  showAlert(
    'Daily Report Completed',
    `Generated ${report.rows.length} rows from ${report.sourceSheet}.`,
  );
}

export function exportReportSnapshotMenuAction(): void {
  const snapshot = exportReportSnapshot();
  showAlert(
    'Report Snapshot Exported',
    `Saved ${snapshot.rowCount} rows from ${snapshot.sourceSheet} to ${snapshot.fileName}.`,
  );
}

export function showStarterHelpMenuAction(): void {
  showAlert(
    'Starter Configuration',
    [
      `Set ${CONFIG_KEYS.reportRecipient} to the destination email address.`,
      `Set ${CONFIG_KEYS.reportSheetName} and ${CONFIG_KEYS.reportRange} for report data.`,
      `Optionally set ${CONFIG_KEYS.reportDriveFolder} for web app payload storage.`,
      `Optionally set ${CONFIG_KEYS.reportSnapshotFolder} for Drive snapshot exports.`,
    ].join('\n'),
  );
}
