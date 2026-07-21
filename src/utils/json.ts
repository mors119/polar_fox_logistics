export const parseJson = <T>(value: string): T => JSON.parse(value) as T;

export const safeStringify = (value: unknown): string => JSON.stringify(value, null, 2);
