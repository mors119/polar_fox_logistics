import type { AppContainer } from '../../config/service-container';
import { getWorkspaceMenuItems } from '../../config/workspace-actions';

export const installWorkspaceMenu = (container: AppContainer): void => {
  container.workspaceMenuService.install(getWorkspaceMenuItems());
};
