import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchImages } from "./imageProviders";
import { clearAll } from "./secureStore";

describe("fetchImages", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearAll();
  });

  it("warns once and falls back to picsum when API key is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mockFetch = vi.fn(async () => ({
      ok: true,
      json: async () => [
        { id: 1, author: "a", url: "https://example.com", width: 100, height: 100 },
      ],
    }));
    global.fetch = mockFetch as any;

    const r1 = await fetchImages({ provider: "unsplash", page: 1, perPage: 1 });
    const r2 = await fetchImages({ provider: "unsplash", page: 1, perPage: 1 });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    for (const [url] of mockFetch.mock.calls) {
      expect(String(url)).toContain("picsum.photos");
    }
    expect(r1.length).toBe(1);
    expect(r2.length).toBe(1);
  });
});

