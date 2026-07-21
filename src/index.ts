import { createAppContainer } from './config/service-container';
import { createWorkspaceActionHandlers } from './config/workspace-actions';
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

const runTimeTrigger = (): void => {
  handleTimeTrigger(container);
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
  runTimeTrigger,
  doGet,
  doPost,
  ...createWorkspaceActionHandlers(container),
});
