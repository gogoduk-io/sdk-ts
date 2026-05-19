import { describe, it, expect, vi } from "vitest";
import { GoGoDukClient, GoGoDukError } from "../src/index.js";

// Tiny helper: build a stubbed fetch that records calls and returns a fixed
// JSON response. Tests assert on (a) the URL/headers we sent and (b) how
// we parse the response into the typed shape.
function stubFetch(json: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const impl = (vi.fn(async (url: string, requestInit?: RequestInit) => {
    calls.push({ url, init: requestInit });
    return new Response(JSON.stringify(json), {
      status: init.status ?? 200,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  }) as unknown) as typeof fetch;
  return { fetch: impl, calls };
}

function client(opts: { fetch: typeof fetch; baseUrl?: string }) {
  return new GoGoDukClient({
    apiKey: "gdk_live_test_secret",
    fetch: opts.fetch,
    baseUrl: opts.baseUrl,
  });
}

describe("GoGoDukClient construction", () => {
  it("requires an apiKey", () => {
    expect(() => new GoGoDukClient({} as never)).toThrow(/apiKey/);
  });

  it("trims whitespace from apiKey", async () => {
    const { fetch, calls } = stubFetch({ predictions: [] });
    const c = new GoGoDukClient({ apiKey: "  gdk_live_x  ", fetch });
    await c.suggest({ input: "Hanoi" });
    const headers = (calls[0]!.init!.headers as Record<string, string>) ?? {};
    expect(headers["X-API-Key"]).toBe("gdk_live_x");
  });

  it("strips trailing slash from baseUrl", async () => {
    const { fetch, calls } = stubFetch({ predictions: [] });
    const c = client({ fetch, baseUrl: "https://example.test/" });
    await c.suggest({ input: "Hanoi" });
    expect(calls[0]!.url.startsWith("https://example.test/v1/suggest")).toBe(true);
  });
});

describe("suggest()", () => {
  it("validates min input length", () => {
    const { fetch } = stubFetch({});
    const c = client({ fetch });
    // Validation happens synchronously before any fetch call.
    expect(() => c.suggest({ input: "a" })).toThrow(/at least 2/);
  });

  it("sends input + maps response", async () => {
    const { fetch, calls } = stubFetch({
      predictions: [
        { placeId: "p1", text: "Hà Nội", mainText: "Hà Nội", secondaryText: "Việt Nam", types: ["region"] },
      ],
    });
    const c = client({ fetch });
    const res = await c.suggest({ input: "Hanoi", lang: "en", country: "VN", focusLat: 21.03, focusLon: 105.85 });

    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe("/v1/suggest");
    expect(url.searchParams.get("input")).toBe("Hanoi");
    expect(url.searchParams.get("lang")).toBe("en");
    expect(url.searchParams.get("country")).toBe("VN");
    expect(url.searchParams.get("focus.lat")).toBe("21.03");
    expect(url.searchParams.get("focus.lon")).toBe("105.85");

    expect(res.predictions).toHaveLength(1);
    expect(res.predictions[0]!.placeId).toBe("p1");
  });

  it("omits undefined params from query string", async () => {
    const { fetch, calls } = stubFetch({ predictions: [] });
    const c = client({ fetch });
    await c.suggest({ input: "Hanoi" });
    const url = new URL(calls[0]!.url);
    expect(url.searchParams.has("lang")).toBe(false);
    expect(url.searchParams.has("country")).toBe(false);
  });
});

describe("reverse()", () => {
  it("sends point.lat / point.lon and parses results", async () => {
    const { fetch, calls } = stubFetch({
      results: [
        {
          place_id: "p1",
          address: "1 Ngõ Hào Nam",
          lat: 21.03,
          lon: 105.85,
          district: "Đống Đa",
          city: "Hà Nội",
          country: "VN",
          confidence: 0.95,
          distance_km: 0.012,
        },
      ],
    });
    const c = client({ fetch });
    const res = await c.reverse({ lat: 21.03, lon: 105.85, size: 3, radiusKm: 0.08 });

    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get("point.lat")).toBe("21.03");
    expect(url.searchParams.get("point.lon")).toBe("105.85");
    expect(url.searchParams.get("size")).toBe("3");
    expect(url.searchParams.get("boundary.circle.radius")).toBe("0.08");

    expect(res.results[0]!.confidence).toBe(0.95);
  });
});

describe("placeResolve()", () => {
  it("requires id", () => {
    const { fetch } = stubFetch({});
    const c = client({ fetch });
    expect(() => c.placeResolve({ id: "" })).toThrow(/id/);
  });

  it("forwards sessionToken + parses result", async () => {
    const { fetch, calls } = stubFetch({
      result: {
        place_id: "p1",
        name: "Vincom Bà Triệu",
        formatted_address: "191 Bà Triệu, Hà Nội",
        lat: 21.01,
        lon: 105.84,
        city: "Hà Nội",
      },
    });
    const c = client({ fetch });
    const res = await c.placeResolve({ id: "p1", sessionToken: "session-abc" });

    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get("id")).toBe("p1");
    expect(url.searchParams.get("sessionToken")).toBe("session-abc");
    expect(res.result.name).toBe("Vincom Bà Triệu");
  });
});

describe("reverseGeocode()", () => {
  it("joins levels with comma", async () => {
    const { fetch, calls } = stubFetch({
      lat: 21.03,
      lng: 105.85,
      city: "Hà Nội",
      district: "Đống Đa",
    });
    const c = client({ fetch });
    await c.reverseGeocode({ lat: 21.03, lng: 105.85, levels: [4, 8] });
    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get("levels")).toBe("4,8");
  });

  it("returns null fields when no boundary contains the point", async () => {
    const { fetch } = stubFetch({ lat: 0, lng: 0, city: null, district: null });
    const c = client({ fetch });
    const res = await c.reverseGeocode({ lat: 0, lng: 0 });
    expect(res.city).toBeNull();
    expect(res.district).toBeNull();
  });
});

describe("adminBoundaries()", () => {
  it("sends optional params + parses keyed response", async () => {
    const { fetch, calls } = stubFetch({
      admin_level_4: [{ name: "Hà Nội", boundary: [[[105.7, 20.9]]] }],
      admin_level_8: [{ name: "Đống Đa", boundary: [[[105.8, 21.0]]] }],
    });
    const c = client({ fetch });
    const res = await c.adminBoundaries({
      levels: [4, 8],
      format: "geojson",
      countryCode: "VN",
      tolerance: 0.002,
    });

    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get("levels")).toBe("4,8");
    expect(url.searchParams.get("format")).toBe("geojson");
    expect(url.searchParams.get("country_code")).toBe("VN");
    expect(url.searchParams.get("tolerance")).toBe("0.002");

    expect(res.admin_level_4).toHaveLength(1);
    expect(res.admin_level_4![0]!.name).toBe("Hà Nội");
  });
});

describe("error handling", () => {
  it("throws GoGoDukError with status + body for 4xx", async () => {
    const { fetch } = stubFetch(
      { error: true, message: "Parameter \"input\" must be at least 2 characters." },
      { status: 400 },
    );
    const c = client({ fetch });
    await expect(c.suggest({ input: "ab" })).rejects.toMatchObject({
      name: "GoGoDukError",
      status: 400,
      message: expect.stringMatching(/at least 2 characters/) as unknown as string,
    });
  });

  it("attaches x-request-id when server provides it", async () => {
    const { fetch } = stubFetch(
      { error: "boom" },
      { status: 500, headers: { "x-request-id": "req-123" } },
    );
    const c = client({ fetch });
    try {
      await c.placeResolve({ id: "p1" });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(GoGoDukError);
      expect((err as GoGoDukError).requestId).toBe("req-123");
    }
  });

  it("wraps network failures as status=0", async () => {
    const failing = (async () => {
      throw new TypeError("network down");
    }) as unknown as typeof fetch;
    const c = client({ fetch: failing });
    await expect(c.reverse({ lat: 21, lon: 105 })).rejects.toMatchObject({
      name: "GoGoDukError",
      status: 0,
    });
  });
});

describe("headers", () => {
  it("merges defaultHeaders but X-API-Key always wins", async () => {
    const { fetch, calls } = stubFetch({ predictions: [] });
    const c = new GoGoDukClient({
      apiKey: "gdk_live_secret",
      fetch,
      defaultHeaders: { "X-Tenant": "abc", "X-API-Key": "should-be-overridden" },
    });
    await c.suggest({ input: "Hanoi" });

    const headers = calls[0]!.init!.headers as Record<string, string>;
    expect(headers["X-API-Key"]).toBe("gdk_live_secret");
    expect(headers["X-Tenant"]).toBe("abc");
    expect(headers["Accept"]).toBe("application/json");
  });
});
