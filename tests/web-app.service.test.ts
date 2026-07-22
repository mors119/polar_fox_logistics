import { describe, expect, it, vi } from 'vitest';

import { CONFIG_KEYS } from '../src/config/keys';
import type { DriveFileInput } from '../src/shared/drive';
import { handleWebAppPost } from '../src/webapp/handlers';

describe('handleWebAppPost', () => {
  it('stores incoming payloads in Drive', () => {
    const response = handleWebAppPost('{"ok":true}', {
      config: {
        [CONFIG_KEYS.reportDriveFolder]: 'Webhook Payloads',
      },
      ensureFolder: (): string => 'folder-123',
      createFile: (_input: DriveFileInput): string => 'file-123',
      info: vi.fn(),
    });

    expect(response.ok).toBe(true);
    expect(response.data).toMatchObject({
      fileId: 'file-123',
      folderId: 'folder-123',
    });
  });
});
