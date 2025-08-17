import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("./secureStore", () => ({
  getKey: () => "test-key",
}));

import { askLLM, askLLMVoice, buildAssistantContext } from "./assistant";

describe("buildAssistantContext", () => {
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
    const ctx = buildAssistantContext(post, "post text");
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
    const mockFetch = vi.fn(async (url: any, init: any) => {
      expect(url).toBe("/api/assistant-voice");
      const body = JSON.parse(init.body);
      expect(body.ctx.selection).toBe("sel");
      expect(body.ctx.images[0]).toBe("https://img.jpg");
      return {
        ok: true,
        json: async () => ({ audio: "aGVsbG8=", text: "hi", type: "audio/mpeg" }),
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
