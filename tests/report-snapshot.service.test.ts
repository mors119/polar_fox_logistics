import { describe, expect, it, vi } from 'vitest';

import { CONFIG_KEYS } from '../src/config/keys';
import { exportReportSnapshot } from '../src/reports/report-snapshot';
import type { DriveFileInput } from '../src/shared/drive';
import type { SheetRange } from '../src/shared/sheets';
import type { SheetTable } from '../src/shared/types';

describe('exportReportSnapshot', () => {
  it('exports the configured report range to Drive as json', () => {
    const state: { lastCreatedFile: DriveFileInput | null } = {
      lastCreatedFile: null,
    };
    const result = exportReportSnapshot({
      config: {
        [CONFIG_KEYS.reportSheetName]: 'Daily Summary',
        [CONFIG_KEYS.reportRange]: 'A1:B2',
        [CONFIG_KEYS.reportSnapshotFolder]: 'Team Snapshots',
      },
      readValues: (_input: SheetRange): SheetTable => [
        ['Metric', 'Value'],
        ['Open Tickets', 12],
      ],
      ensureFolder: (name: string): string => `folder:${name}`,
      createFile: (input: DriveFileInput): string => {
        state.lastCreatedFile = input;
        return 'file-123';
      },
      info: vi.fn(),
    });

    expect(result).toMatchObject({
      sourceSheet: 'Daily Summary',
      rangeA1Notation: 'A1:B2',
      rowCount: 2,
      folderId: 'folder:Team Snapshots',
      fileId: 'file-123',
    });
    expect(state.lastCreatedFile).toMatchObject({
      folderId: 'folder:Team Snapshots',
      mimeType: 'application/json',
    });
    if (!state.lastCreatedFile) {
      throw new Error('Expected createFile to capture the snapshot file.');
    }

    expect(state.lastCreatedFile.content).toContain('"sourceSheet": "Daily Summary"');
  });
});
