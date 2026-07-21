import type { ConfigService } from '../../config/config.service';
import { CONFIG_KEYS } from '../../config/config-keys';
import type { WebAppResponseModel } from '../../domain/models/http.model';
import type { DrivePort } from '../ports/drive.port';
import type { LoggerPort } from '../ports/logger.port';

export class WebAppService {
  public constructor(
    private readonly configService: ConfigService,
    private readonly drivePort: DrivePort,
    private readonly logger: LoggerPort,
  ) {}

  public handleGet(): WebAppResponseModel {
    return {
      ok: true,
      message: 'Google Apps Script TypeScript Starter is running.',
      timestamp: new Date().toISOString(),
      data: {
        reportDriveFolder:
          this.configService.getOptional(CONFIG_KEYS.reportDriveFolder) ?? 'not-configured',
      },
    };
  }

  public handlePost(payload: string): WebAppResponseModel {
    const folderName = this.configService.getOptionalWithDefault(
      CONFIG_KEYS.reportDriveFolder,
      'Webhook Payloads',
    );
    const folderId = this.drivePort.ensureFolder(folderName);
    const fileId = this.drivePort.createFile({
      folderId,
      fileName: `payload-${Date.now()}.json`,
      content: payload,
      mimeType: 'application/json',
    });

    this.logger.info('Webhook payload persisted', {
      folderName,
      fileId,
    });

    return {
      ok: true,
      message: 'Payload stored successfully.',
      timestamp: new Date().toISOString(),
      data: {
        fileId,
        folderId,
      },
    };
  }
}
