import { describe, it, expect, vi, afterEach } from "vitest";
import { askLLM } from "./assistant";

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

    const msg = await askLLM("hello");
    expect(msg.id).toBe(uuid);
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

    const msg = await askLLM("hello");
    expect(msg.id).toBe("4fzzzxjylrx");
  });
});
