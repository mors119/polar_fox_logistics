import type { AppContainer } from '../../config/service-container';
import { safeStringify } from '../../utils/json';

export const handleDoGet = (container: AppContainer): GoogleAppsScript.Content.TextOutput => {
  const response = container.webAppService.handleGet();

  return ContentService.createTextOutput(safeStringify(response)).setMimeType(
    ContentService.MimeType.JSON,
  );
};
