import type { ConfigKey } from '../config/keys';

export type ConfigValues = Partial<Record<ConfigKey, string>>;

export function getConfig(key: ConfigKey, values: ConfigValues = {}): string | null {
  if (key in values) {
    return values[key] ?? null;
  }

  if (typeof PropertiesService === 'undefined') {
    return null;
  }

  return PropertiesService.getScriptProperties().getProperty(key);
}

export function getRequiredConfig(key: ConfigKey, values: ConfigValues = {}): string {
  const value = getConfig(key, values);

  if (!value) {
    throw new Error(`Missing required configuration value for key: ${key}`);
  }

  return value;
}

export function getConfigOrDefault(
  key: ConfigKey,
  fallbackValue: string,
  values: ConfigValues = {},
): string {
  return getConfig(key, values) ?? fallbackValue;
}
