import {
  exportReportSnapshotMenuAction,
  runDailyReportMenuAction,
  showStarterHelpMenuAction,
} from './reports/menu';
import { handleOnOpen } from './triggers/on-open';
import { recordEdit } from './triggers/on-edit';
import { handleTimeTrigger } from './triggers/time-trigger';
import { createJsonOutput } from './shared/http';
import { handleWebAppGet, handleWebAppPost } from './webapp/handlers';

export function onOpen(): void {
  handleOnOpen();
}

export function onEdit(event: GoogleAppsScript.Events.SheetsOnEdit): void {
  recordEdit(event);
}

export function runTimeTrigger(): void {
  handleTimeTrigger();
}

export function doGet(): GoogleAppsScript.Content.TextOutput {
  return createJsonOutput(handleWebAppGet());
}

export function doPost(event: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  return createJsonOutput(handleWebAppPost(event.postData?.contents ?? '{}'));
}

Object.assign(globalThis, {
  onOpen,
  onEdit,
  runTimeTrigger,
  doGet,
  doPost,
  runDailyReportMenuAction,
  exportReportSnapshotMenuAction,
  showStarterHelpMenuAction,
});
