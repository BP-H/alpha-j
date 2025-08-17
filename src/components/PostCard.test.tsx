import React from "react";
import { render, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PostCard from "./PostCard";

vi.mock("../lib/bus", () => {
  const listeners: Record<string, any[]> = {};
  return {
    default: {
      on: (event: string, cb: any) => {
        (listeners[event] ||= []).push(cb);
        return () => {};
      },
      emit: (event: string, payload: any) => {
        (listeners[event] || []).forEach(fn => fn(payload));
      }
    }
  };
});
import bus from "../lib/bus";

vi.mock("../lib/ensureModelViewer", () => ({
  ensureModelViewer: () => Promise.resolve()
}));

vi.mock("./AmbientWorld", () => ({
  default: () => <div />
}));

describe("PostCard emoji accessibility", () => {
  it("emoji buttons are focusable", () => {
    const post = { id: 1 } as any;
    const { container } = render(<PostCard post={post} />);
    const bar = container.querySelector(".pc-emoji-bar")!;
    const buttons = Array.from(bar.querySelectorAll("button"));
    expect(buttons.length).toBeGreaterThan(0);
    const first = buttons[0] as HTMLButtonElement;
    first.focus();
    expect(document.activeElement).toBe(first);
  });
});

describe("PostCard reactions", () => {
  it("aggregates duplicate reactions", async () => {
    const post = { id: 1 } as any;
    const { container } = render(<PostCard post={post} />);
    await new Promise(r => setTimeout(r, 0));
    act(() => {
      bus.emit("post:react", { id: 1, emoji: "🔥" });
      bus.emit("post:react", { id: 1, emoji: "🔥" });
      bus.emit("post:react", { id: 1, emoji: "✨" });
    });
    const items = Array.from(container.querySelectorAll(".pc-re"));
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain("🔥");
    expect(items[0].textContent).toContain("2");
    expect(items[1].textContent).toContain("✨");
    expect(items[1].textContent).toContain("1");
  });
});

