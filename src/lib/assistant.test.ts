import { describe, it, expect, vi, afterEach } from "vitest";
import { askLLM } from "./assistant";
import { clearAll } from "./secureStore";

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
    clearAll();
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

    const res = await askLLM("hello");
    expect(res.ok).toBe(true);
    expect(res.ok && res.message.id).toBe(uuid);
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

    const res = await askLLM("hello");
    expect(res.ok).toBe(true);
    expect(res.ok && res.message.id).toBe("4fzzzxjylrx");
  });
});
