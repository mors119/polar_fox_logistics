export interface HttpRequest {
  readonly url: string;
  readonly method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  readonly headers?: Readonly<Record<string, string>>;
  readonly payload?: string;
}

export interface HttpResponse<TBody> {
  readonly statusCode: number;
  readonly body: TBody;
  readonly headers: Readonly<Record<string, string>>;
}

export interface HttpPort {
  requestJson<TBody>(request: HttpRequest): HttpResponse<TBody>;
}
