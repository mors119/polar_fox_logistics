export type SheetCellValue = string | number | boolean | Date | null;
export type SheetRow = ReadonlyArray<SheetCellValue>;
export type SheetTable = ReadonlyArray<SheetRow>;

export interface SheetRangeInput {
  readonly sheetName: string;
  readonly rangeA1Notation: string;
}

export interface SheetWriteInput extends SheetRangeInput {
  readonly values: SheetTable;
}

export interface SheetPort {
  createSheet(sheetName: string): void;
  readValues(input: SheetRangeInput): SheetTable;
  writeValues(input: SheetWriteInput): void;
  appendRow(sheetName: string, row: SheetRow): void;
}
