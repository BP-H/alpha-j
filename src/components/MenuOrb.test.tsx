import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import MenuOrb from "./MenuOrb";
import bus from "../lib/bus";

describe("MenuOrb interactions", () => {
  it("emits sidebar toggle even when sidebar is open", () => {
    const emitSpy = vi.spyOn(bus, "emit");
    const { getByRole } = render(
      <>
        <div className="sb open" />
        <MenuOrb />
      </>
    );
    const orb = getByRole("button", { name: /toggle sidebar/i });
    fireEvent.click(orb);
    expect(emitSpy).toHaveBeenCalledWith("sidebar:toggle");
    emitSpy.mockRestore();
  });

  it("sets a z-index above the sidebar", () => {
    const { container } = render(<MenuOrb />);
    const styleTag = container.querySelector("style");
    expect(styleTag?.textContent).toContain("z-index:80");
  });
});
