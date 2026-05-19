/**
 * Error thrown when the GoGoDuk API returns a non-2xx response, or when a
 * network/parse failure happens before the server replies. The `status` is 0
 * if the request never reached the server.
 */
export class GoGoDukError extends Error {
  readonly status: number;
  readonly requestId: string | undefined;
  readonly body: unknown;

  constructor(message: string, status: number, options?: { requestId?: string; body?: unknown }) {
    super(message);
    this.name = "GoGoDukError";
    this.status = status;
    this.requestId = options?.requestId;
    this.body = options?.body;
  }
}
