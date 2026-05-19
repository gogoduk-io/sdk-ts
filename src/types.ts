// Public types for the SDK. Shape mirrors the actual JSON returned by the
// GoGoDuk API; see https://api.gogoduk.com docs for canonical reference.

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export type GoGoDukClientOptions = {
  /**
   * Your GoGoDuk API key. Required.
   * Sent as the `X-API-Key` request header.
   */
  apiKey: string;

  /**
   * API base URL. Override when targeting a self-hosted deployment or a
   * staging environment.
   * @default "https://api.gogoduk.com"
   */
  baseUrl?: string;

  /**
   * Per-request timeout in milliseconds. 0 disables the timeout.
   * @default 10000
   */
  timeoutMs?: number;

  /**
   * Inject a custom fetch implementation (useful for tests or environments
   * that need a polyfill). Defaults to the global `fetch`.
   */
  fetch?: typeof fetch;

  /**
   * Extra headers merged into every request. Cannot override `X-API-Key`.
   */
  defaultHeaders?: Record<string, string>;
};

// ---------------------------------------------------------------------------
// /v1/suggest
// ---------------------------------------------------------------------------

export type SuggestParams = {
  /** User input. Must be at least 2 characters. */
  input: string;
  /** Language code (ISO-639-1). @default "vi" */
  lang?: string;
  /** ISO-3166-1 country filter (alpha-2 or alpha-3). */
  country?: string;
  /**
   * Autocomplete session token. Pass the same value across calls in one
   * session, then reuse it on `placeResolve` to close billing on the
   * session.
   */
  sessionToken?: string;
  /** Bias point latitude. */
  focusLat?: number;
  /** Bias point longitude. */
  focusLon?: number;
};

export type Prediction = {
  placeId: string;
  text: string;
  mainText: string;
  secondaryText: string;
  types?: string[];
};

export type SuggestResponse = {
  predictions: Prediction[];
};

// ---------------------------------------------------------------------------
// /v1/reverse
// ---------------------------------------------------------------------------

export type ReverseParams = {
  /** Latitude (WGS84). */
  lat: number;
  /** Longitude (WGS84). */
  lon: number;
  /** Max results, 1-5. @default 1 */
  size?: number;
  /** Search radius in km. Capped at 0.1 server-side. @default 0.05 */
  radiusKm?: number;
  /** Language code. @default "vi" */
  lang?: string;
  /** Comma-separated ISO-3166-1 alpha-2 country codes to constrain results. */
  country?: string;
};

export type ReverseResult = {
  place_id: string;
  address: string;
  lat: number;
  lon: number;
  district?: string;
  city?: string;
  country?: string;
  confidence: number;
  distance_km: number;
};

export type ReverseResponse = {
  results: ReverseResult[];
};

// ---------------------------------------------------------------------------
// /v1/place/resolve
// ---------------------------------------------------------------------------

export type PlaceResolveParams = {
  /** Place identifier from a prior `suggest` call. */
  id: string;
  /** Language code. @default "vi" */
  lang?: string;
  /**
   * Autocomplete session token from `suggest`. Passing it here closes the
   * billing session.
   */
  sessionToken?: string;
};

/**
 * Place details — superset of fields seen on autocomplete results. Optional
 * fields can be absent depending on data source coverage.
 */
export type Place = {
  place_id: string;
  name: string;
  formatted_address: string;
  address_normalized?: string;
  lat: number;
  lon: number;
  housenumber?: string;
  street?: string;
  ward?: string;
  district?: string;
  city?: string;
  country_code?: string;
  layer?: string;
  types?: string[];
  source?: string;
};

export type PlaceResolveResponse = {
  result: Place;
};

// ---------------------------------------------------------------------------
// /v1/reverse-geocode  (admin-boundary)
// ---------------------------------------------------------------------------

export type ReverseGeocodeParams = {
  /** Latitude. */
  lat: number;
  /** Longitude. */
  lng: number;
  /**
   * Admin levels to return. OSM convention: 4 = province, 8 = district.
   * @default [4, 8]
   */
  levels?: number[];
};

export type ReverseGeocodeResponse = {
  lat: number;
  lng: number;
  /** Province name (admin_level=4), or null if no boundary contains the point. */
  city: string | null;
  /** District name (admin_level=8), or null if no boundary contains the point. */
  district: string | null;
};

// ---------------------------------------------------------------------------
// /v1/admin-boundaries
// ---------------------------------------------------------------------------

export type AdminBoundariesParams = {
  /**
   * Admin levels to fetch. OSM convention: 4 = province, 8 = district.
   * @default [4, 8]
   */
  levels?: number[];
  /** Output format. WKT returns string geometries; geojson returns coordinate arrays. @default "geojson" */
  format?: "geojson" | "wkt";
  /** ISO-3166-1 alpha-2 country code. @default "VN" */
  countryCode?: string;
  /**
   * Douglas-Peucker simplification tolerance in degrees. Lower = more
   * detail = bigger payload. Server default ~0.001 (~100m at equator).
   */
  tolerance?: number;
};

export type AdminBoundary = {
  name: string;
  /**
   * Polygon ring coordinates. For `format=geojson`, this is either
   * `number[][]` (single polygon ring) or `number[][][]` (multipolygon
   * exterior rings). For `format=wkt`, it's a string.
   */
  boundary: number[][] | number[][][] | string;
  /** Parent province name. For provinces (admin_level=4) this equals `name`. */
  province_name?: string;
  /** Source identifier of the parent province record. */
  province_id?: string;
  /** Total population recorded for this boundary. */
  population?: number;
  /** Area in square kilometres. */
  area_km2?: number;
  /**
   * Notes on the most recent administrative reorganisation (Vietnam
   * boundaries merge/split over time). Free-form Vietnamese text.
   */
  pre_merge_info?: string;
  /** Official seat of administration (city/town name). */
  admin_center?: string;
  /** Public contact phone number for the local administration. */
  phone?: string;
  /** Official website URL for the local administration. */
  website?: string;
  /** `[longitude, latitude]` centroid for cheap labelling. */
  centroid?: [number, number];
};

/**
 * Map keyed by `admin_level_<N>` (e.g. `admin_level_4`, `admin_level_8`)
 * to a list of boundaries at that level.
 */
export type AdminBoundariesResponse = {
  [adminLevelKey: string]: AdminBoundary[];
};
