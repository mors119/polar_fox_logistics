import type { SheetTable } from '../../application/ports/sheet.port';

export interface DailyReportEntity {
  readonly generatedAt: Date;
  readonly sourceSheet: string;
  readonly rows: SheetTable;
}
