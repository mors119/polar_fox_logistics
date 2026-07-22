export const CONFIG_KEYS = {
  reportRecipient: 'REPORT_RECIPIENT',
  reportSheetName: 'REPORT_SHEET_NAME',
  reportRange: 'REPORT_RANGE',
  reportMenuTitle: 'REPORT_MENU_TITLE',
  reportDriveFolder: 'REPORT_DRIVE_FOLDER',
  reportSnapshotFolder: 'REPORT_SNAPSHOT_FOLDER',
} as const;

export type ConfigKey = (typeof CONFIG_KEYS)[keyof typeof CONFIG_KEYS];
