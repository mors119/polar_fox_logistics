import type { MenuItem } from '../application/ports/ui.port';
import type { AppContainer } from './service-container';

export interface WorkspaceActionDefinition {
  readonly id: string;
  readonly label: string;
  readonly handler: (container: AppContainer) => void;
}

const workspaceActions: ReadonlyArray<WorkspaceActionDefinition> = [
  {
    id: 'runDailyReport',
    label: 'Run Daily Report',
    handler: (container): void => {
      const report = container.dailyReportService.run();
      container.uiPort.alert(
        'Daily Report Completed',
        `Generated ${report.rows.length} rows from ${report.sourceSheet}.`,
      );
    },
  },
  {
    id: 'exportReportSnapshot',
    label: 'Export Report Snapshot',
    handler: (container): void => {
      const snapshot = container.reportSnapshotService.run();
      container.uiPort.alert(
        'Report Snapshot Exported',
        `Saved ${snapshot.rowCount} rows from ${snapshot.sourceSheet} to ${snapshot.fileName}.`,
      );
    },
  },
  {
    id: 'showStarterHelp',
    label: 'Show Starter Help',
    handler: (container): void => {
      container.workspaceMenuService.showHelp();
    },
  },
];

export const getWorkspaceMenuItems = (): ReadonlyArray<MenuItem> => {
  return workspaceActions.map((action) => ({
    label: action.label,
    functionName: action.id,
  }));
};

export const createWorkspaceActionHandlers = (
  container: AppContainer,
): Record<string, () => void> => {
  return Object.fromEntries(
    workspaceActions.map((action) => [action.id, (): void => action.handler(container)]),
  );
};
