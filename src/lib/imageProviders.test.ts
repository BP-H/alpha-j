import { beforeEach, describe, expect, it, vi } from "vitest";

// Tests dynamically import modules so that module-level state like warnedProviders
// is reset between cases and environment variables are applied before import.
describe("fetchImages", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    delete process.env.VITE_UNSPLASH_KEY;
    delete process.env.VITE_PEXELS_KEY;
    try {
      window.localStorage.clear();
    } catch {}
  });

  it("uses VITE_UNSPLASH_KEY before secureStore", async () => {
    process.env.VITE_UNSPLASH_KEY = "ENV_U";
    const secure = await import("./secureStore");
    secure.setKey("unsplash", "STORE_U");

    const mockFetch = vi.fn(async (_url, opts: any) => {
      expect(opts?.headers?.Authorization).toBe("Client-ID ENV_U");
      return {
        ok: true,
        json: async () => [
          {
            id: "1",
            urls: { regular: "u", small: "t" },
            user: { name: "a" },
            links: { html: "l" },
            width: 1,
            height: 1,
          },
        ],
      } as any;
    });
    vi.stubGlobal("fetch", mockFetch);

    const { fetchImages } = await import("./imageProviders");
    await fetchImages({ provider: "unsplash", page: 1, perPage: 1 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("uses VITE_PEXELS_KEY before secureStore", async () => {
    process.env.VITE_PEXELS_KEY = "ENV_P";
    const secure = await import("./secureStore");
    secure.setKey("pexels", "STORE_P");

    const mockFetch = vi.fn(async (_url, opts: any) => {
      expect(opts?.headers?.Authorization).toBe("ENV_P");
      return {
        ok: true,
        json: async () => ({
          photos: [
            {
              id: "1",
              src: { large2x: "u", tiny: "t" },
              photographer: "a",
              url: "l",
              width: 1,
              height: 1,
            },
          ],
        }),
      } as any;
    });
    vi.stubGlobal("fetch", mockFetch);

    const { fetchImages } = await import("./imageProviders");
    await fetchImages({ provider: "pexels", page: 1, perPage: 1 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("warns once per provider and falls back to picsum when API key is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mockFetch = vi.fn(async (url: RequestInfo) => {
      expect(String(url)).toContain("picsum.photos");
      return {
        ok: true,
        json: async () => [
          { id: 1, author: "a", url: "https://example.com", width: 100, height: 100 },
        ],
      } as any;
    });
    vi.stubGlobal("fetch", mockFetch);

    const { fetchImages } = await import("./imageProviders");
    await fetchImages({ provider: "unsplash", page: 1, perPage: 1 });
    await fetchImages({ provider: "unsplash", page: 1, perPage: 1 });
    await fetchImages({ provider: "pexels", page: 1, perPage: 1 });
    await fetchImages({ provider: "pexels", page: 1, perPage: 1 });

    expect(warn).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});
