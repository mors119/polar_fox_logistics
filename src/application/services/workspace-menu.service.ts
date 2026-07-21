import type { ConfigService } from '../../config/config.service';
import { CONFIG_KEYS } from '../../config/config-keys';
import type { MenuItem, UiPort } from '../ports/ui.port';

export class WorkspaceMenuService {
  public constructor(
    private readonly configService: ConfigService,
    private readonly uiPort: UiPort,
  ) {}

  public install(items: ReadonlyArray<MenuItem>): void {
    const title = this.configService.getOptionalWithDefault(
      CONFIG_KEYS.reportMenuTitle,
      'Workspace Starter',
    );

    this.uiPort.createMenu(title, items);
  }

  public showHelp(): void {
    this.uiPort.alert(
      'Starter Configuration',
      [
        `Set ${CONFIG_KEYS.reportRecipient} to the destination email address.`,
        `Set ${CONFIG_KEYS.reportSheetName} and ${CONFIG_KEYS.reportRange} for report data.`,
        `Optionally set ${CONFIG_KEYS.reportDriveFolder} for web app payload storage.`,
        `Optionally set ${CONFIG_KEYS.reportSnapshotFolder} for Drive snapshot exports.`,
      ].join('\n'),
    );
  }
}
