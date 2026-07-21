import type { ConfigKey } from '../config-keys';
import type { ConfigurationProvider } from '../config.service';

export class ScriptPropertiesConfigurationProvider implements ConfigurationProvider {
  public constructor(private readonly scriptProperties: GoogleAppsScript.Properties.Properties) {}

  public get(key: ConfigKey): string | null {
    return this.scriptProperties.getProperty(key);
  }
}
