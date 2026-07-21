import type { AppContainer } from '../../config/service-container';
import { safeStringify } from '../../utils/json';

export const handleDoPost = (
  container: AppContainer,
  event: GoogleAppsScript.Events.DoPost,
): GoogleAppsScript.Content.TextOutput => {
  const payload = event.postData?.contents ?? '{}';
  const response = container.webAppService.handlePost(payload);

  return ContentService.createTextOutput(safeStringify(response)).setMimeType(
    ContentService.MimeType.JSON,
  );
};
