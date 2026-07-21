import type { AppContainer } from '../../config/service-container';

export const handleTimeTrigger = (container: AppContainer): void => {
  container.dailyReportService.run();
};
