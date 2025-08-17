import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("./secureStore", () => ({
  getKey: () => "test-key",
}));

import { askLLM, askLLMVoice, buildCtx } from "./assistant";

describe("buildCtx", () => {
  it("includes selection and images", () => {
    const sel = "selected text";
    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => sel,
    } as any);
    const post = {
      id: "p1",
      images: [
        "https://example.com/a.png",
        "data:image/png;base64,abc",
        "invalid",
      ],
      title: "T",
    } as any;
    const ctx = buildCtx(post, "post text");
    expect(ctx).not.toBeNull();
    if (!ctx) throw new Error("ctx should not be null");
    expect(ctx.selection).toBe(sel);
    expect(ctx.images).toEqual([
      "https://example.com/a.png",
      "data:image/png;base64,abc",
    ]);
    expect(ctx.postId).toBe("p1");
    expect(ctx.text).toBe("post text");
  });
});

describe("askLLM id generation", () => {
  const originalFetch = global.fetch;
  const originalCryptoDesc = Object.getOwnPropertyDescriptor(global, "crypto");
  const originalRandom = Math.random;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalCryptoDesc) {
      Object.defineProperty(global, "crypto", originalCryptoDesc);
    } else {
      // @ts-ignore
      delete global.crypto;
    }
    Math.random = originalRandom;
    vi.resetAllMocks();
  });

  it("uses crypto.randomUUID when available", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ text: "hi" }),
    })) as any;
    // @ts-ignore
    global.fetch = mockFetch;
    const uuid = "uuid-123";
    Object.defineProperty(global, "crypto", {
      value: { randomUUID: () => uuid },
      configurable: true,
    });

    const result = await askLLM("hello");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.message.id).toBe(uuid);
  });

  it("falls back to Math.random when crypto.randomUUID is unavailable", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ text: "hi" }),
    })) as any;
    // @ts-ignore
    global.fetch = mockFetch;
    // @ts-ignore
    delete global.crypto;
    Math.random = () => 0.123456789;

    const result = await askLLM("hello");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.message.id).toBe("4fzzzxjylrx");
  });

  it("sends the stored API key", async () => {
    const mockFetch = vi.fn(async (_url: any, init: any) => {
      const body = JSON.parse(init.body);
      expect(body.apiKey).toBe("test-key");
      return { ok: true, json: async () => ({ text: "hi" }) } as any;
    });
    // @ts-ignore
    global.fetch = mockFetch;

    const result = await askLLM("hello");
    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("askLLMVoice", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.resetAllMocks();
  });

  it("forwards context selection and images", async () => {
    const mockFetch = vi.fn(async (_url: any, init: any) => {
      const body = JSON.parse(init.body);
      // Ensure the selection and image were embedded into the input array
      const selectionMsg = body.input.find((m: any) =>
        JSON.stringify(m).includes("User selected text: sel"),
      );
      expect(selectionMsg).toBeTruthy();
      const imageMsg = body.input.find((m: any) =>
        Array.isArray(m.content) && m.content.some((c: any) => c.image_url === "https://img.jpg"),
      );
      expect(imageMsg).toBeTruthy();
      return {
        ok: true,
        json: async () => ({
          output: [
            {
              content: [
                { type: "audio", audio: { data: "aGVsbG8=" } },
                { type: "text", text: "hi" },
              ],
            },
          ],
        }),
      } as any;
    });
    // @ts-ignore
    global.fetch = mockFetch;
    const originalCreate = URL.createObjectURL;
    // @ts-ignore
    URL.createObjectURL = () => "blob:mock";

    const ctx = { selection: "sel", images: ["https://img.jpg"] } as any;
    const res = await askLLMVoice("hi", ctx);
    expect(res.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    URL.createObjectURL = originalCreate;
  });
});
