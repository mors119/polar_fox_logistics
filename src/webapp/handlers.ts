import { CONFIG_KEYS } from '../config/keys';
import { getConfig, getConfigOrDefault, type ConfigValues } from '../shared/config';
import { createDriveFile, ensureDriveFolder, type DriveFileInput } from '../shared/drive';
import { logInfo } from '../shared/logger';

interface WebAppResponse {
  readonly ok: boolean;
  readonly message: string;
  readonly timestamp: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface WebAppDependencies {
  readonly config?: ConfigValues;
  readonly now?: () => Date;
  readonly ensureFolder?: typeof ensureDriveFolder;
  readonly createFile?: (input: DriveFileInput) => string;
  readonly info?: typeof logInfo;
}

export function handleWebAppGet(dependencies: WebAppDependencies = {}): WebAppResponse {
  const now = dependencies.now ?? getCurrentDate;

  return {
    ok: true,
    message: 'Google Apps Script TypeScript Starter is running.',
    timestamp: now().toISOString(),
    data: {
      reportDriveFolder:
        getConfig(CONFIG_KEYS.reportDriveFolder, dependencies.config) ?? 'not-configured',
    },
  };
}

export function handleWebAppPost(
  payload: string,
  dependencies: WebAppDependencies = {},
): WebAppResponse {
  const folderName = getConfigOrDefault(
    CONFIG_KEYS.reportDriveFolder,
    'Webhook Payloads',
    dependencies.config,
  );
  const folderId = (dependencies.ensureFolder ?? ensureDriveFolder)(folderName);
  const currentDate = (dependencies.now ?? getCurrentDate)();
  const fileId = (dependencies.createFile ?? createDriveFile)({
    folderId,
    fileName: `payload-${currentDate.getTime()}.json`,
    content: payload,
    mimeType: 'application/json',
  });

  (dependencies.info ?? logInfo)('Webhook payload persisted', {
    folderName,
    fileId,
  });

  return {
    ok: true,
    message: 'Payload stored successfully.',
    timestamp: currentDate.toISOString(),
    data: {
      fileId,
      folderId,
    },
  };
}

function getCurrentDate(): Date {
  return new Date();
}
