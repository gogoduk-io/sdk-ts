# @gogoduk/sdk

Official TypeScript SDK for the [GoGoDuk Map API](https://gogoduk.com) — geocoding, reverse geocoding, autocomplete, and admin boundaries for Vietnam and Southeast Asia.

[![npm](https://img.shields.io/npm/v/@gogoduk/sdk.svg)](https://www.npmjs.com/package/@gogoduk/sdk)
[![license](https://img.shields.io/npm/l/@gogoduk/sdk.svg)](./LICENSE)

> **Free forever.** 100 requests/day per account, no credit card. Need more? [Email us](mailto:hi@gogoduk.com) and we'll raise your limit.

## Install

```bash
npm install @gogoduk/sdk
# or
pnpm add @gogoduk/sdk
# or
yarn add @gogoduk/sdk
```

Requires **Node 18+** (global `fetch`). Works in browsers, Bun, Deno, and edge runtimes.

## Quick start

```ts
import { GoGoDukClient } from "@gogoduk/sdk";

const client = new GoGoDukClient({ apiKey: process.env.GOGODUK_API_KEY! });

// 1. Autocomplete
const { predictions } = await client.suggest({ input: "Hà Nội" });

// 2. Resolve a place
const { result } = await client.placeResolve({ id: predictions[0].placeId });
console.log(result.formatted_address, result.lat, result.lon);

// 3. Reverse geocode (proximity)
const { results } = await client.reverse({ lat: 21.03, lon: 105.85 });

// 4. Reverse geocode (admin boundary)
const { city, district } = await client.reverseGeocode({ lat: 21.03, lng: 105.85 });

// 5. Admin boundary polygons (provinces + districts)
const boundaries = await client.adminBoundaries({ levels: [4, 8] });
```

Get your API key at [app.gogoduk.com](https://app.gogoduk.com).

## API

### `new GoGoDukClient(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | — | **Required.** Your API key. Sent as `X-API-Key`. |
| `baseUrl` | `string` | `"https://api.gogoduk.com"` | Override for self-hosted or staging. |
| `timeoutMs` | `number` | `10000` | Per-request timeout. `0` disables. |
| `fetch` | `typeof fetch` | global `fetch` | Inject a polyfill or mock. |
| `defaultHeaders` | `Record<string, string>` | `{}` | Extra headers merged into every request. |

### `client.suggest(params)`

Autocomplete predictions. Input must be ≥ 2 characters.

```ts
const { predictions } = await client.suggest({
  input: "Hào Nam",
  lang: "vi",           // default "vi"
  country: "VN",        // ISO-3166-1
  sessionToken: "uuid", // reuse on placeResolve to close the billing session
  focusLat: 21.03,      // bias point
  focusLon: 105.85,
});
```

### `client.reverse(params)`

Proximity-based reverse geocode — returns the nearest known address.

```ts
const { results } = await client.reverse({
  lat: 21.03,
  lon: 105.85,
  size: 1,        // max 5
  radiusKm: 0.05, // capped at 0.1
  lang: "vi",
  country: "VN",  // comma-separated ISO-2 codes
});
```

### `client.placeResolve(params)`

Resolve a `placeId` (from `suggest`) into full place details.

```ts
const { result } = await client.placeResolve({
  id: "place_abc",
  lang: "vi",
  sessionToken: "uuid", // closes the autocomplete billing session
});
```

### `client.reverseGeocode(params)`

Admin-boundary reverse geocode — returns the province/district that contains the point (PostGIS `ST_Contains`). No proximity fallback.

```ts
const { city, district } = await client.reverseGeocode({
  lat: 21.03,
  lng: 105.85,
  levels: [4, 8], // OSM: 4 = province, 8 = district
});
```

Both `city` and `district` can be `null` when no boundary contains the point.

### `client.adminBoundaries(params)`

Province/district polygons as GeoJSON coordinates or WKT.

```ts
const boundaries = await client.adminBoundaries({
  levels: [4, 8],
  format: "geojson", // or "wkt"
  countryCode: "VN",
  tolerance: 0.001,  // Douglas-Peucker degrees (lower = more detail)
});

for (const province of boundaries.admin_level_4 ?? []) {
  console.log(province.name, province.boundary);
}
```

> **Note:** the current response only includes `name` + `boundary`. The underlying dataset has more (province codes, population, area, historical names) — these will surface in a future API revision; this SDK will follow with a backwards-compatible minor bump.

## Errors

All endpoint methods reject with `GoGoDukError` on non-2xx responses or transport failures:

```ts
import { GoGoDukError } from "@gogoduk/sdk";

try {
  await client.suggest({ input: "ab" });
} catch (err) {
  if (err instanceof GoGoDukError) {
    console.error(err.status, err.message, err.requestId, err.body);
  }
}
```

| Property | Description |
|---|---|
| `status` | HTTP status. `0` for network/timeout failures. |
| `message` | Server-provided `message` or `error`, falling back to `HTTP <status>`. |
| `requestId` | `x-request-id` header value, if the server set it. Include this when reporting bugs. |
| `body` | Parsed JSON or raw text body. |

## Versioning

This SDK uses [semver](https://semver.org). Pre-1.0 (`0.x.y`), minor bumps (`0.1 → 0.2`) may include breaking changes.

## Contributing

Issues + PRs welcome at [gogoduk-io/sdk-ts](https://github.com/gogoduk-io/sdk-ts).

## License

[MIT](./LICENSE)
