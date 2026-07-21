import type { LoggerPort } from '../../application/ports/logger.port';
import { safeStringify } from '../../utils/json';

export class AppsScriptLogger implements LoggerPort {
  public debug(message: string, context?: Readonly<Record<string, unknown>>): void {
    Logger.log(this.format('DEBUG', message, context));
  }

  public info(message: string, context?: Readonly<Record<string, unknown>>): void {
    Logger.log(this.format('INFO', message, context));
  }

  public warn(message: string, context?: Readonly<Record<string, unknown>>): void {
    Logger.log(this.format('WARN', message, context));
  }

  public error(message: string, context?: Readonly<Record<string, unknown>>): void {
    Logger.log(this.format('ERROR', message, context));
  }

  private format(
    level: string,
    message: string,
    context?: Readonly<Record<string, unknown>>,
  ): string {
    const contextSuffix = context ? ` | ${safeStringify(context)}` : '';
    return `[${level}] ${message}${contextSuffix}`;
  }
}
