import { describe, expect, it, vi } from 'vitest';

import { CONFIG_KEYS } from '../src/config/config-keys';
import { ConfigService, type ConfigurationProvider } from '../src/config/config.service';
import { WebAppService } from '../src/application/services/web-app.service';
import type { DriveFileInput, DrivePort } from '../src/application/ports/drive.port';
import type { LoggerPort } from '../src/application/ports/logger.port';

class InMemoryConfigurationProvider implements ConfigurationProvider {
  public constructor(private readonly values: Partial<Record<string, string>>) {}

  public get(key: string): string | null {
    return this.values[key] ?? null;
  }
}

class FakeDrivePort implements DrivePort {
  public ensureFolder(_name: string, _parentFolderId?: string): string {
    return 'folder-123';
  }

  public createFile(_input: DriveFileInput): string {
    return 'file-123';
  }

  public uploadContent(_fileId: string, _content: string, _mimeType?: string): void {}
}

describe('WebAppService', () => {
  it('stores incoming payloads in Drive', () => {
    const configService = new ConfigService([
      new InMemoryConfigurationProvider({
        [CONFIG_KEYS.reportDriveFolder]: 'Webhook Payloads',
      }),
    ]);
    const logger: LoggerPort = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const service = new WebAppService(configService, new FakeDrivePort(), logger);

    const response = service.handlePost('{"ok":true}');

    expect(response.ok).toBe(true);
    expect(response.data).toMatchObject({
      fileId: 'file-123',
      folderId: 'folder-123',
    });
  });
});
