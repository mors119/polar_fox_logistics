import type {
  SheetPort,
  SheetRangeInput,
  SheetTable,
  SheetWriteInput,
} from '../../../application/ports/sheet.port';

export class SheetsAdapter implements SheetPort {
  public createSheet(sheetName: string): void {
    const spreadsheet = this.getSpreadsheet();

    if (!spreadsheet.getSheetByName(sheetName)) {
      spreadsheet.insertSheet(sheetName);
    }
  }

  public readValues(input: SheetRangeInput): SheetTable {
    return this.getSheet(input.sheetName).getRange(input.rangeA1Notation).getValues();
  }

  public writeValues(input: SheetWriteInput): void {
    const range = this.getSheet(input.sheetName).getRange(input.rangeA1Notation);
    range.setValues(input.values.map((row) => [...row]));
  }

  public appendRow(sheetName: string, row: ReadonlyArray<unknown>): void {
    const sheet = this.getSheet(sheetName);
    sheet.appendRow([...row]);
  }

  private getSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    if (!spreadsheet) {
      throw new Error('No active spreadsheet is available for SheetsAdapter.');
    }

    return spreadsheet;
  }

  private getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet {
    const sheet = this.getSpreadsheet().getSheetByName(sheetName);

    if (!sheet) {
      throw new Error(`Sheet not found: ${sheetName}`);
    }

    return sheet;
  }
}
