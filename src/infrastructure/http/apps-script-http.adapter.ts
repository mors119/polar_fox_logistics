import type { HttpPort, HttpRequest, HttpResponse } from '../../application/ports/http.port';
import { parseJson } from '../../utils/json';

const normalizeHeaders = (
  headers: Record<string, string | ReadonlyArray<string>>,
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(headers).map(([headerName, headerValue]) => [
      headerName,
      Array.isArray(headerValue) ? headerValue.join(', ') : String(headerValue),
    ]),
  );

export class AppsScriptHttpAdapter implements HttpPort {
  public requestJson<TBody>(request: HttpRequest): HttpResponse<TBody> {
    const response = UrlFetchApp.fetch(request.url, {
      method: request.method,
      headers: request.headers,
      payload: request.payload,
      muteHttpExceptions: true,
      contentType: 'application/json',
    });
    const statusCode = response.getResponseCode();

    if (statusCode < 200 || statusCode >= 300) {
      throw new Error(`HTTP request to ${request.url} failed with status ${statusCode}`);
    }

    return {
      statusCode,
      body: parseJson<TBody>(response.getContentText()),
      headers: normalizeHeaders(
        response.getAllHeaders() as Record<string, string | ReadonlyArray<string>>,
      ),
    };
  }
}
