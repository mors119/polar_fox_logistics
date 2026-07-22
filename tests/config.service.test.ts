import { describe, expect, it } from 'vitest';

import { CONFIG_KEYS } from '../src/config/keys';
import { getConfig, getConfigOrDefault, getRequiredConfig } from '../src/shared/config';

describe('shared/config', () => {
  it('returns a configured value when present', () => {
    expect(
      getRequiredConfig(CONFIG_KEYS.reportRecipient, {
        [CONFIG_KEYS.reportRecipient]: 'team@example.com',
      }),
    ).toBe('team@example.com');
  });

  it('returns a default value when configuration is absent', () => {
    expect(getConfigOrDefault(CONFIG_KEYS.reportSheetName, 'Report', {})).toBe('Report');
  });

  it('throws when a required value is missing', () => {
    expect(() => getRequiredConfig(CONFIG_KEYS.reportRecipient, {})).toThrow(
      /Missing required configuration value/,
    );
  });

  it('returns null when configuration is absent', () => {
    expect(getConfig(CONFIG_KEYS.reportRecipient, {})).toBeNull();
  });
});
