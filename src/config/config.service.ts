import type { ConfigKey } from './config-keys';

export interface ConfigurationProvider {
  get(key: ConfigKey): string | null;
}

export class ConfigService {
  public constructor(private readonly providers: ReadonlyArray<ConfigurationProvider>) {}

  public getRequired(key: ConfigKey): string {
    const value = this.getOptional(key);

    if (!value) {
      throw new Error(`Missing required configuration value for key: ${key}`);
    }

    return value;
  }

  public getOptional(key: ConfigKey): string | null {
    for (const provider of this.providers) {
      const value = provider.get(key);

      if (value) {
        return value;
      }
    }

    return null;
  }

  public getOptionalWithDefault(key: ConfigKey, fallbackValue: string): string {
    return this.getOptional(key) ?? fallbackValue;
  }
}
