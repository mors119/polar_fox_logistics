import { safeStringify } from './json';

function formatLog(
  level: string,
  message: string,
  context?: Readonly<Record<string, unknown>>,
): string {
  const contextSuffix = context ? ` | ${safeStringify(context)}` : '';
  return `[${level}] ${message}${contextSuffix}`;
}

export function logInfo(message: string, context?: Readonly<Record<string, unknown>>): void {
  Logger.log(formatLog('INFO', message, context));
}
