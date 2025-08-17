import { describe, it, expect, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import handler from "../../api/assistant-voice";

describe("assistant-voice input building", () => {
  it("sends text and image content, ignoring invalid URLs", async () => {
    let captured: any = null;
    const fetchMock = vi.fn(async (_url: any, init: any) => {
      captured = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          output: [
            {
              content: [
                { type: "text", text: "hi" },
                { type: "audio", audio: { data: "xyz" } },
              ],
            },
          ],
        }),
      } as any;
    });
    // @ts-ignore
    global.fetch = fetchMock;

    const req = {
      method: "POST",
      body: {
        apiKey: "k",
        prompt: "hello",
        ctx: {
          images: ["https://valid/image.png", "notaurl"],
        },
      },
      headers: {},
    } as unknown as VercelRequest;

    const res: Partial<VercelResponse> = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
      send: vi.fn(),
    } as any;

    await handler(req, res as VercelResponse);

    expect(fetchMock).toHaveBeenCalled();
    expect(captured.input).toBeTruthy();
    const imgEntry = captured.input.find((p: any) =>
      Array.isArray(p.content) && p.content.some((c: any) => c.type === "input_image"),
    );
    expect(imgEntry).toBeTruthy();
    const urls = imgEntry.content.map((c: any) => c.image_url);
    expect(urls).toEqual(["https://valid/image.png"]);
  });
});
