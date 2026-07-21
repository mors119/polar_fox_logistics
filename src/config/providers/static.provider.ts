import type { ConfigKey } from '../config-keys';
import type { ConfigurationProvider } from '../config.service';

export class StaticConfigurationProvider implements ConfigurationProvider {
  public constructor(private readonly values: Partial<Record<ConfigKey, string>>) {}

  public get(key: ConfigKey): string | null {
    return this.values[key] ?? null;
  }
}
