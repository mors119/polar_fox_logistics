import { safeStringify } from './json';

export function createJsonOutput(value: unknown): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(safeStringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
