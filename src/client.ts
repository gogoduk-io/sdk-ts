import { GoGoDukError } from "./errors.js";
import type {
  AdminBoundariesParams,
  AdminBoundariesResponse,
  GoGoDukClientOptions,
  PlaceResolveParams,
  PlaceResolveResponse,
  ReverseGeocodeParams,
  ReverseGeocodeResponse,
  ReverseParams,
  ReverseResponse,
  SuggestParams,
  SuggestResponse,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.gogoduk.com";
const DEFAULT_TIMEOUT_MS = 10_000;

export class GoGoDukClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: GoGoDukClientOptions) {
    if (!options || typeof options.apiKey !== "string" || options.apiKey.trim() === "") {
      throw new Error("GoGoDukClient: apiKey is required");
    }

    this.apiKey = options.apiKey.trim();
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.defaultHeaders = { ...(options.defaultHeaders ?? {}) };

    // Resolve fetch once. Prefer the user override, then global fetch. Node
    // ≥18 ships a global fetch, so we don't need a polyfill — but error out
    // helpfully if the runtime is missing it.
    const fetchImpl = options.fetch ?? (typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : undefined);
    if (!fetchImpl) {
      throw new Error(
        "GoGoDukClient: no fetch implementation available. Pass `fetch` in options or run on Node ≥18.",
      );
    }
    this.fetchImpl = fetchImpl;
  }

  // -------------------------------------------------------------------------
  // Public endpoints
  // -------------------------------------------------------------------------

  /** Autocomplete address suggestions. `input` must be ≥ 2 characters. */
  suggest(params: SuggestParams): Promise<SuggestResponse> {
    if (!params.input || params.input.trim().length < 2) {
      throw new Error("GoGoDukClient.suggest: `input` must be at least 2 characters");
    }
    const query: Record<string, string | number | undefined> = {
      input: params.input.trim(),
      lang: params.lang,
      country: params.country,
      sessionToken: params.sessionToken,
      "focus.lat": params.focusLat,
      "focus.lon": params.focusLon,
    };
    return this.request<SuggestResponse>("GET", "/v1/suggest", query);
  }

  /** Proximity-based reverse geocode — returns the nearest known address(es). */
  reverse(params: ReverseParams): Promise<ReverseResponse> {
    const query: Record<string, string | number | undefined> = {
      "point.lat": params.lat,
      "point.lon": params.lon,
      size: params.size,
      "boundary.circle.radius": params.radiusKm,
      lang: params.lang,
      "boundary.country": params.country,
    };
    return this.request<ReverseResponse>("GET", "/v1/reverse", query);
  }

  /** Resolve a `placeId` (from `suggest`) into full place details. */
  placeResolve(params: PlaceResolveParams): Promise<PlaceResolveResponse> {
    if (!params.id || params.id.trim() === "") {
      throw new Error("GoGoDukClient.placeResolve: `id` is required");
    }
    const query: Record<string, string | number | undefined> = {
      id: params.id,
      lang: params.lang,
      sessionToken: params.sessionToken,
    };
    return this.request<PlaceResolveResponse>("GET", "/v1/place/resolve", query);
  }

  /**
   * Admin-boundary reverse geocode — returns the province/district that
   * contains the given lat/lng (PostGIS ST_Contains, no proximity fallback).
   */
  reverseGeocode(params: ReverseGeocodeParams): Promise<ReverseGeocodeResponse> {
    const query: Record<string, string | number | undefined> = {
      lat: params.lat,
      lng: params.lng,
      levels: params.levels?.join(","),
    };
    return this.request<ReverseGeocodeResponse>("GET", "/v1/reverse-geocode", query);
  }

  /** Fetch admin boundary polygons (provinces, districts) as GeoJSON or WKT. */
  adminBoundaries(params: AdminBoundariesParams = {}): Promise<AdminBoundariesResponse> {
    const query: Record<string, string | number | undefined> = {
      levels: params.levels?.join(","),
      format: params.format,
      country_code: params.countryCode,
      tolerance: params.tolerance,
    };
    return this.request<AdminBoundariesResponse>("GET", "/v1/admin-boundaries", query);
  }

  // -------------------------------------------------------------------------
  // Transport
  // -------------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    query: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = this.buildUrl(path, query);
    const controller = new AbortController();
    const timer =
      this.timeoutMs > 0 ? setTimeout(() => controller.abort(), this.timeoutMs) : undefined;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          ...this.defaultHeaders,
          "X-API-Key": this.apiKey,
          Accept: "application/json",
        },
        signal: controller.signal,
      });
    } catch (err) {
      if (timer !== undefined) clearTimeout(timer);
      if ((err as { name?: string }).name === "AbortError") {
        throw new GoGoDukError(`Request timed out after ${this.timeoutMs}ms`, 0);
      }
      throw new GoGoDukError(
        `Network error: ${(err as Error).message ?? "unknown"}`,
        0,
      );
    }
    if (timer !== undefined) clearTimeout(timer);

    const requestId = response.headers.get("x-request-id") ?? undefined;
    const text = await response.text();

    let body: unknown = undefined;
    if (text.length > 0) {
      try {
        body = JSON.parse(text);
      } catch {
        // Non-JSON body. Keep as raw string under `body`.
        body = text;
      }
    }

    if (!response.ok) {
      const message =
        (typeof body === "object" && body !== null && "message" in body
          ? String((body as { message: unknown }).message)
          : undefined) ??
        (typeof body === "object" && body !== null && "error" in body
          ? String((body as { error: unknown }).error)
          : undefined) ??
        `HTTP ${response.status}`;
      throw new GoGoDukError(message, response.status, { requestId, body });
    }

    return body as T;
  }

  private buildUrl(path: string, query: Record<string, string | number | undefined>): string {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }
}
