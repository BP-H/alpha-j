import { describe, it, expect, vi, afterEach } from "vitest";
import handler from "../../api/assistant-voice";

describe("assistant-voice context handling", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.resetAllMocks();
  });

  it("sends prompt without context when ctx is absent", async () => {
    const mockFetch = vi.fn(async (_url, init) => ({
      ok: true,
      status: 200,
      headers: { get: () => "audio/mpeg" },
      body: undefined,
    })) as any;
    // @ts-ignore
    global.fetch = mockFetch;

    const req = {
      method: "POST",
      body: { apiKey: "k", prompt: "Hello" },
      headers: {},
    } as any;

    const res = {
      status: vi.fn(() => res),
      setHeader: vi.fn(),
      json: vi.fn(),
      send: vi.fn(),
      end: vi.fn(),
    } as any;

    await handler(req, res);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.input).toBe("Hello");
  });

  it("prepends context when provided", async () => {
    const mockFetch = vi.fn(async (_url, init) => ({
      ok: true,
      status: 200,
      headers: { get: () => "audio/mpeg" },
      body: undefined,
    })) as any;
    // @ts-ignore
    global.fetch = mockFetch;

    const req = {
      method: "POST",
      body: {
        apiKey: "k",
        prompt: "Hello",
        ctx: {
          title: "My Post",
          text: "Some text",
          imageUrl: "http://img",
          postId: 1,
        },
      },
      headers: {},
    } as any;

    const res = {
      status: vi.fn(() => res),
      setHeader: vi.fn(),
      json: vi.fn(),
      send: vi.fn(),
      end: vi.fn(),
    } as any;

    await handler(req, res);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.input).toBe(
      "Context: Title: My Post Text: Some text Image: http://img Post ID: 1\n\nHello",
    );
  });
});

