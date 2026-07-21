export const CONFIG_KEYS = {
  reportRecipient: 'REPORT_RECIPIENT',
  reportSheetName: 'REPORT_SHEET_NAME',
  reportRange: 'REPORT_RANGE',
  reportMenuTitle: 'REPORT_MENU_TITLE',
  reportDriveFolder: 'REPORT_DRIVE_FOLDER',
  reportSnapshotFolder: 'REPORT_SNAPSHOT_FOLDER',
  externalApiUrl: 'EXTERNAL_API_URL',
  externalApiToken: 'EXTERNAL_API_TOKEN',
  defaultCalendarId: 'DEFAULT_CALENDAR_ID',
} as const;

export type ConfigKey = (typeof CONFIG_KEYS)[keyof typeof CONFIG_KEYS];
