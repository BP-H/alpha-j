// src/lib/share.ts
import type { Post } from "../types";

/** Options version (Web Share friendly) */
export interface ShareOptions {
  url: string;
  title?: string;
  text?: string;
}

/**
 * sharePost
 * - Accepts a Post, a {url,title,text} object, or a raw url string.
 * - Uses the Web Share API when available; falls back to copying the URL.
 */
export async function sharePost(arg: Post | ShareOptions | string): Promise<boolean> {
  let url = "";
  let title: string | undefined;
  let text: string | undefined;

  if (typeof arg === "string") {
    // sharePost("https://example.com")
    url = arg;
  } else if ("url" in arg) {
    // sharePost({ url, title?, text? })
    const opts = arg as ShareOptions;
    url = opts.url ?? "";
    title = opts.title;
    text = opts.text;
  } else {
    // sharePost(post)
    const p = arg as Post;
    title = p.title;
    // try post.link first, otherwise current location (if available)
    url =
      (p as any).link ??
      (typeof location !== "undefined" ? location.href : "");
  }

  if (!url) return false;

  // Web Share API
  try {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      await (navigator as any).share({ url, title, text });
      return true;
    }
  } catch {
    // ignore and continue to fallbacks
  }

  // Clipboard API first
  if (typeof navigator !== "undefined") {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        return true;
      }
    } catch {
      // ignore and fall back to manual prompt
    }
  }

  // Manual copy prompt fallback
  if (typeof window !== "undefined" && typeof window.prompt === "function") {
    window.prompt("Copy this URL:", url);
  }
  return false;
}

export default sharePost;
