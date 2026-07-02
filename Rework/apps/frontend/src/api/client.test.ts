// Regression coverage for the DELETE Content-Type bug (see TECHNICAL.md):
// Fastify 5 rejects a request that declares Content-Type: application/json
// but has no body with a 400 FST_ERR_CTP_EMPTY_JSON_BODY. The domain and
// route-level backend tests can't catch this - it's purely a frontend
// request-construction bug - so it needs coverage here.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, getToken, setToken } from "./client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("api client request()", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    setToken(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not send a Content-Type header on bodyless requests (e.g. DELETE)", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await api.deleteSeason(42);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("sends a Content-Type header when a body is present", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ id: 1, teams: [] }));

    await api.createSeason({ year: 2026, label: "Test", teams: [{ name: "A" }, { name: "B" }] });

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("attaches a stored token as a Bearer Authorization header", async () => {
    setToken("test-token-123");
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]));

    await api.getSeasons();

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token-123");
  });

  it("sends no Authorization header when no token is stored", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]));

    await api.getSeasons();

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("throws the backend's error message on a non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "Saison nicht gefunden." }, 404));

    await expect(api.getSeason(999)).rejects.toThrow("Saison nicht gefunden.");
  });

  it("treats a 204 No Content response as an empty result, not a JSON-parse attempt", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await expect(api.deleteSeason(1)).resolves.toBeUndefined();
  });

  it("persists the token via setToken/getToken", () => {
    expect(getToken()).toBeNull();
    setToken("abc");
    expect(getToken()).toBe("abc");
    setToken(null);
    expect(getToken()).toBeNull();
  });
});
