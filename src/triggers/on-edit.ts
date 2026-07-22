import { CONFIG_KEYS } from '../config/keys';
import { getConfigOrDefault, type ConfigValues } from '../shared/config';
import { logInfo } from '../shared/logger';
import { appendSheetRow } from '../shared/sheets';
import type { SheetRow } from '../shared/types';

export interface RecordEditDependencies {
  readonly config?: ConfigValues;
  readonly now?: () => Date;
  readonly appendRow?: (sheetName: string, row: SheetRow) => void;
  readonly info?: typeof logInfo;
}

export function recordEdit(
  event: GoogleAppsScript.Events.SheetsOnEdit,
  dependencies: RecordEditDependencies = {},
): void {
  const auditSheetName = getConfigOrDefault(
    CONFIG_KEYS.reportSheetName,
    'Report',
    dependencies.config,
  );
  const now = dependencies.now ?? getCurrentDate;
  const row = [
    now(),
    event.range.getA1Notation(),
    event.value ?? '',
    event.oldValue ?? '',
  ] as const;

  (dependencies.appendRow ?? appendSheetRow)(auditSheetName, row);
  (dependencies.info ?? logInfo)('Sheet edit recorded', {
    range: event.range.getA1Notation(),
    value: event.value ?? null,
  });
}

function getCurrentDate(): Date {
  return new Date();
}
