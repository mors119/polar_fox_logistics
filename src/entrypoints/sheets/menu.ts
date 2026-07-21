import type { AppContainer } from '../../config/service-container';

export const installWorkspaceMenu = (container: AppContainer): void => {
  container.workspaceMenuService.install();
};
