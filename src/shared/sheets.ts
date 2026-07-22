import type { SheetRow, SheetTable } from './types';

export interface SheetRange {
  readonly sheetName: string;
  readonly rangeA1Notation: string;
}

function getSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error('No active spreadsheet is available.');
  }

  return spreadsheet;
}

function getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet {
  const sheet = getSpreadsheet().getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }

  return sheet;
}

export function readSheetValues(input: SheetRange): SheetTable {
  return getSheet(input.sheetName).getRange(input.rangeA1Notation).getValues();
}

export function appendSheetRow(sheetName: string, row: SheetRow): void {
  getSheet(sheetName).appendRow([...row]);
}
