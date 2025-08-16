import { describe, expect, it } from "vitest";
import { on, emit } from "./bus";

describe("bus", () => {
  it("handles listener errors via callback", () => {
    const off1 = on("evt", () => { throw new Error("boom"); });
    let called = false;
    const off2 = on("evt", () => { called = true; });

    const errors: unknown[] = [];
    emit("evt", undefined, (err) => errors.push(err));

    expect(errors).toHaveLength(1);
    expect(called).toBe(true);

    off1();
    off2();
  });

  it("rethrows listener errors when no callback provided", () => {
    const off = on("evt", () => { throw new Error("boom"); });
    expect(() => emit("evt")).toThrow("boom");
    off();
  });
});
