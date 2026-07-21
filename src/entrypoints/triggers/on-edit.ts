import type { AppContainer } from '../../config/service-container';

export const handleOnEdit = (
  container: AppContainer,
  event: GoogleAppsScript.Events.SheetsOnEdit,
): void => {
  container.triggerEventService.recordEdit(event);
};
