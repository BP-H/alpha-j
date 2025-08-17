import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useSpeech from "./useSpeech";
import { logError } from "./logger";

vi.mock("./logger", () => ({
  logError: vi.fn(),
}));

describe("useSpeech", () => {
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

    const { result } = renderHook(() => useSpeech({ onResult: () => {} }));

    const evt = new Error("fail");
    act(() => {
      instance.onerror?.(evt);
    });

    expect(logError).toHaveBeenCalledWith(evt);
    expect(result.current.error).toBe("Speech recognition failed");
  });

  it("buffers results and emits final transcript once", async () => {
    let instance: any;
    class MockSpeechRecognition {
      lang = "";
      interimResults = true;
      maxAlternatives = 1;
      onresult: any = null;
      onend: any = null;
      start() {}
      stop() {}
      constructor() {
        instance = this;
      }
    }
    (globalThis as any).SpeechRecognition = MockSpeechRecognition as any;

    const onResult = vi.fn();
    renderHook(() => useSpeech({ onResult, onInterim: () => {} }));

    const r1: any = [{ transcript: "hello" }];
    r1.isFinal = true;
    const r2: any = [{ transcript: "world" }];
    r2.isFinal = true;

    await act(async () => {
      instance.onresult?.({ resultIndex: 0, results: [r1] });
      instance.onresult?.({ resultIndex: 1, results: [r1, r2] });
      await instance.onend?.();
    });

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith("hello world");
  });
});

