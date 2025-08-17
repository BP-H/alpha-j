import { render, screen } from "@testing-library/react";
import { act } from "react";
import { test, expect } from "vitest";
import ToastContainer from "./ToastContainer";
import bus from "../lib/bus";

test("shows toast message from bus", () => {
  render(<ToastContainer />);
  act(() => {
    bus.emit("toast", { message: "hello" });
  });
  expect(screen.getByText("hello")).toBeTruthy();
});
