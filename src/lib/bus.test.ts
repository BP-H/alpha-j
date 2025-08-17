import { describe, expect, it, vi } from "vitest";
import { on, emit, ERROR_EVENT } from "./bus";
import { logError } from "./logger";

vi.mock("./logger", () => ({ logError: vi.fn() }));

describe("bus", () => {
  it("logs listener errors and continues execution", () => {
    const off1 = on("evt", () => {
      throw new Error("boom");
    });
    let called = false;
    const off2 = on("evt", () => {
      called = true;
    });

    emit("evt");

    expect(logError).toHaveBeenCalledTimes(1);
    expect(called).toBe(true);

    off1();
    off2();
  });

  it("emits a global error event", () => {
    const errors: unknown[] = [];
    const offErr = on(ERROR_EVENT, (err) => errors.push(err));
    const off = on("evt", () => {
      throw new Error("boom");
    });

    emit("evt");

    expect(errors).toHaveLength(1);
    expect((errors[0] as any).event).toBe("evt");

    off();
    offErr();
  });
});

