import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("./secureStore", () => ({ getKey: () => "test-key" }));

import { askLLMVoice } from "./assistant";

const originalFetch = global.fetch;
const originalAtob = global.atob as any;
const originalCreate = global.URL.createObjectURL;

afterEach(() => {
  global.fetch = originalFetch;
  global.atob = originalAtob;
  URL.createObjectURL = originalCreate;
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("askLLMVoice", () => {
  it("returns audio on success", async () => {
    global.atob = (b64: string) => Buffer.from(b64, "base64").toString("binary");
    URL.createObjectURL = vi.fn(() => "blob:url");
    const audioB64 = Buffer.from("hi").toString("base64");
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        output: [
          {
            content: [
              { type: "audio", audio: { data: audioB64 } },
              { type: "text", text: "hello" },
            ],
          },
        ],
      }),
    })) as any;

    const res = await askLLMVoice("test");
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.error.message);
    expect(res.text).toBe("hello");
    expect(res.type).toBe("audio/mpeg");
    expect(res.url).toBe("blob:url");
    expect(res.audio).toBeInstanceOf(Uint8Array);
  });

  it("handles timeout", async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn((_url: any, init: any) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const err: any = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    }) as any;
    const p = askLLMVoice("test");
    vi.advanceTimersByTime(46000);
    const res = await p;
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected fail");
    expect(res.error.type).toBe("aborted");
  });

  it("handles 401", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "bad key" } }),
    })) as any;
    const res = await askLLMVoice("test");
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected fail");
    expect(res.error.type).toBe("openai");
    expect(res.error.status).toBe(401);
    expect(res.error.message).toMatch(/bad key/i);
  });
});
