import { createAppContainer } from './config/service-container';
import { handleOnEdit } from './entrypoints/triggers/on-edit';
import { handleOnOpen } from './entrypoints/triggers/on-open';
import { handleTimeTrigger } from './entrypoints/triggers/time-trigger';
import { handleDoGet } from './entrypoints/webapp/do-get';
import { handleDoPost } from './entrypoints/webapp/do-post';

const container = createAppContainer();

const onOpen = (): void => {
  handleOnOpen(container);
};

const onEdit = (event: GoogleAppsScript.Events.SheetsOnEdit): void => {
  handleOnEdit(container, event);
};

const runDailyReport = (): void => {
  const report = container.dailyReportService.run();
  container.uiPort.alert(
    'Daily Report Completed',
    `Generated ${report.rows.length} rows from ${report.sourceSheet}.`,
  );
};

const runTimeTrigger = (): void => {
  handleTimeTrigger(container);
};

const showStarterHelp = (): void => {
  container.workspaceMenuService.showHelp();
};

const doGet = (): GoogleAppsScript.Content.TextOutput => {
  return handleDoGet(container);
};

const doPost = (event: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput => {
  return handleDoPost(container, event);
};

Object.assign(globalThis, {
  onOpen,
  onEdit,
  runDailyReport,
  runTimeTrigger,
  showStarterHelp,
  doGet,
  doPost,
});
