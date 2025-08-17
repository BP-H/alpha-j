// src/components/feed/PostCard.test.tsx
import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import PostCard from "./PostCard";
import type { Post } from "../../types";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

describe("PostCard image grid", () => {
  const post: Post = {
    id: 1,
    author: "@user",
    images: ["/a.jpg", "/b.jpg", "/c.jpg"],
  };

  it("renders multiple images", () => {
    const { container } = render(<PostCard post={post} />);
    const gallery = container.querySelector(".pc-carousel") as HTMLElement;
    const imgs = Array.from(gallery.querySelectorAll("img")) as HTMLImageElement[];
    expect(imgs.length).toBe(3);
    expect(imgs[0].getAttribute("src")).toBe("/a.jpg");
  });
});

describe("PostCard reactions scrolling", () => {
  it("scrolls lengthy reaction sets", () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const css = fs.readFileSync(path.join(__dirname, "./postcard.css"), "utf8");
    const styleEl = document.createElement("style");
    styleEl.innerHTML = css;
    document.head.appendChild(styleEl);
    const wrap = document.createElement("div");
    wrap.className = "pc-reactions";
    for (let i = 0; i < 50; i++) {
      const span = document.createElement("span");
      span.className = "pc-emo-count";
      span.textContent = "🔥";
      wrap.appendChild(span);
    }
    document.body.appendChild(wrap);
    const style = getComputedStyle(wrap);
    expect(style.overflowY).toBe("auto");
    expect(style.overflowX).toBe("auto");
    expect(style.maxHeight).toBe("120px");
  });
});

