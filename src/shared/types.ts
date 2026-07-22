export type SheetCellValue = string | number | boolean | Date | null;
export type SheetRow = ReadonlyArray<SheetCellValue>;
export type SheetTable = ReadonlyArray<SheetRow>;
