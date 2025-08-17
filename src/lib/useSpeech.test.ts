import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useSpeechRecognition from "./useSpeech";
import { logError } from "./logger";

vi.mock("./logger", () => ({
  logError: vi.fn(),
}));

describe("useSpeechRecognition", () => {
  afterEach(() => {
    delete (globalThis as any).SpeechRecognition;
  });

  it("logs errors and updates error state", () => {
    let instance: any;
    class MockSpeechRecognition {
      lang = "";
      interimResults = false;
      maxAlternatives = 1;
      onresult: any = null;
      onerror: any = null;
      constructor() {
        instance = this;
      }
      start() {}
      stop() {}
    }
    (globalThis as any).SpeechRecognition = MockSpeechRecognition as any;

    const { result } = renderHook(() => useSpeechRecognition(() => {}));

    const evt = new Error("fail");
    act(() => {
      instance.onerror?.(evt);
    });

    expect(logError).toHaveBeenCalledWith(evt);
    expect(result.current.error).toBe("Speech recognition failed");
  });
});

