import type { AppContainer } from '../../config/service-container';
import { installWorkspaceMenu } from '../sheets/menu';

export const handleOnOpen = (container: AppContainer): void => {
  installWorkspaceMenu(container);
};
