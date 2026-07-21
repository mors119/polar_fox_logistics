import { describe, expect, it } from 'vitest';

import { CONFIG_KEYS } from '../src/config/config-keys';
import { ConfigService, type ConfigurationProvider } from '../src/config/config.service';

class InMemoryConfigurationProvider implements ConfigurationProvider {
  public constructor(private readonly values: Partial<Record<string, string>>) {}

  public get(key: string): string | null {
    return this.values[key] ?? null;
  }
}

describe('ConfigService', () => {
  it('returns the first configured value across providers', () => {
    const service = new ConfigService([
      new InMemoryConfigurationProvider({}),
      new InMemoryConfigurationProvider({
        [CONFIG_KEYS.reportRecipient]: 'team@example.com',
      }),
    ]);

    expect(service.getRequired(CONFIG_KEYS.reportRecipient)).toBe('team@example.com');
  });

  it('returns a default value when configuration is absent', () => {
    const service = new ConfigService([new InMemoryConfigurationProvider({})]);

    expect(service.getOptionalWithDefault(CONFIG_KEYS.reportSheetName, 'Report')).toBe('Report');
  });

  it('throws when a required value is missing', () => {
    const service = new ConfigService([new InMemoryConfigurationProvider({})]);

    expect(() => service.getRequired(CONFIG_KEYS.reportRecipient)).toThrow(
      /Missing required configuration value/,
    );
  });
});
