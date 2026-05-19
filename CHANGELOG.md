# Changelog

All notable changes to `@gogoduk/sdk` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-05-19

### Added

- `AdminBoundary` now surfaces the additional fields the API expanded on the
  same day: `province_name`, `province_id`, `population`, `area_km2`,
  `pre_merge_info`, `admin_center`, `phone`, `website`, and `centroid`
  (`[lng, lat]` for cheap labelling). All are optional on the type so the
  bump is backwards-compatible — existing v0.1.x consumers that only read
  `name` + `boundary` continue to work without changes.

## [0.1.0] — 2026-05-19

Initial release.

### Added

- `GoGoDukClient` with five typed endpoint methods:
  - `suggest()` — autocomplete predictions (`GET /v1/suggest`)
  - `reverse()` — proximity-based reverse geocode (`GET /v1/reverse`)
  - `placeResolve()` — resolve a placeId to full details (`GET /v1/place/resolve`)
  - `reverseGeocode()` — admin-boundary lookup via PostGIS `ST_Contains` (`GET /v1/reverse-geocode`)
  - `adminBoundaries()` — province/district polygons (`GET /v1/admin-boundaries`)
- `GoGoDukError` with `status`, `requestId`, `body` for structured error handling.
- Per-request timeout (default 10s), custom `fetch` injection, default headers merge.
- Dual ESM + CJS build with `.d.ts` declarations.
