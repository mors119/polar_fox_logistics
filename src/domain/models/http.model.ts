export interface WebAppResponseModel {
  readonly ok: boolean;
  readonly message: string;
  readonly timestamp: string;
  readonly data?: Readonly<Record<string, unknown>>;
}
