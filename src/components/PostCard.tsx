// src/components/PostCard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./postcard.css";
import type { Post } from "../types";
import bus from "../lib/bus";
import { ensureModelViewer } from "../lib/ensureModelViewer";
import AmbientWorld from "./AmbientWorld";

const isBlob = (u?: string | null) => !!u && u.startsWith("blob:");

const EMOJI_LIST: string[] = [
  "🤗","😂","🤣","😅","🙂","😉","😍","😎","🥳","🤯","😡","😱","🤔","🤭","🙄","🥺","🤪","🤫","🤤","😴",
  "👻","🤖","👽","😈","👋","👍","👎","👏","🙏","👀","💪","🫶","💅","🔥","✨","⚡","💥","❤️","🫠","🫡",
  "💙","💜","🖤","🤍","❤️‍🔥","❤️‍🩹","💯","💬","🗯️","🎉","🎊","🎁","🏆","🎮","🚀","✈️","🚗","🏠","🫨","🗿",
  "📱","💡","🎵","📢","📚","📈","✅","❌","❗","❓","‼️","⚠️","🌀","🎬","🍕","🍔","🍎","🍺","⚙️","🧩"
];

export default function PostCard({ post }: { post: Post }) {
  const [drawer, setDrawer] = useState(false);
  const [comments, setComments] = useState<string[]>([]);
  const [reactions, setReactions] = useState<string[]>([]);

  useEffect(() => {
    const off1 = bus.on?.("post:comment", ({ id, body }) => {
      if (String(id) !== String(post.id)) return;
      setDrawer(true);
      setComments((s) => [body, ...s]);
    });
    const off2 = bus.on?.("post:react", ({ id, emoji }) => {
      if (String(id) !== String(post.id)) return;
      setDrawer(true);
      setReactions((s) => [emoji, ...s].slice(0, 60));
    });
    const off3 = bus.on?.("post:focus", ({ id }) => {
      if (String(id) !== String(post.id)) return;
      setDrawer(true);
    });
    return () => { try { off1?.(); off2?.(); off3?.(); } catch {} };
  }, [post.id]);

  const pdf = (post as any)?.pdf as string | undefined;
  const model3d = (post as any)?.model3d as string | undefined;
  const video = (post as any)?.video as string | undefined;

  useEffect(() => { if (model3d) ensureModelViewer().catch(() => {}); }, [model3d]);

  const images = useMemo(() => {
    const out: string[] = [];
    const srcs =
      post?.images && post.images.length
        ? post.images
        : [post?.image || post?.cover].filter(Boolean);
    for (const img of srcs as any[]) {
      if (!img) continue;
      if (typeof img === "string") out.push(img);
      else if (img.url) out.push(String(img.url));
    }
    return out;
  }, [post, video, pdf, model3d]);

  const onMediaReady = (e: React.SyntheticEvent<any>) => {
    const el = e.currentTarget as any;
    try { el.style.opacity = "1"; } catch {}
    const src: string = el.currentSrc || el.src || el.getAttribute?.("src") || "";
    if (src && src.startsWith("blob:")) { try { URL.revokeObjectURL(src); } catch {} }
  };

  // carousel
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let t = 0;
    const onScroll = () => {
      cancelAnimationFrame(t);
      t = requestAnimationFrame(() => {
        const w = el.clientWidth || 1;
        const i = Math.round(el.scrollLeft / w);
        if (i !== idx) setIdx(i);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [idx]);
  const go = (i: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    el.scrollTo({ left: w * i, behavior: "smooth" });
  };

  const postId = String(post?.id ?? "");

  return (
    <article className={`pc tank ${drawer ? "dopen" : ""}`} data-post-id={postId} id={`post-${postId}`}>
      <div className="pc-tank">
        <div className="pc-topbar" role="group" aria-label="Post info">
          <div className="pc-ava"
               title={post?.author || "@user"}
               onClick={() => bus.emit?.("profile:open", { id: post.author })}
               role="button" aria-label="Open profile">
            <img src={post?.authorAvatar || "/avatar.jpg"} alt={post?.author || "user"} />
          </div>
          <div className="pc-meta">
            <div className="pc-handle">{post?.author || "@user"}</div>
            <div className="pc-sub">{post?.time || "now"} • {post?.location || "superNova"}</div>
          </div>
          {post?.title && <div className="pc-title">{post.title}</div>}
        </div>

        <div className="pc-media-wrap">
          {pdf ? (
            <iframe className="pc-media" src={pdf} title="PDF" onLoad={onMediaReady} />
          ) : model3d ? (
            <model-viewer className="pc-media" src={model3d} camera-controls onLoad={onMediaReady} />
          ) : video ? (
            <video
              className="pc-media"
              src={video}
              controls
              playsInline
              preload="metadata"
              crossOrigin={isBlob(video) ? undefined : "anonymous"}
              onLoadedData={onMediaReady}
            />
          ) : images.length > 1 ? (
            <div ref={wrapRef} className="pc-carousel" role="region" aria-roledescription="carousel" aria-label="Post images">
              {images.map((src, i) => {
                const key = images.indexOf(src) === i ? src : `${src}-${i}`;
                return (
                  <img
                    key={key}
                    src={src}
                    alt={post?.title || post?.author || "post"}
                    loading="lazy"
                    decoding="async"
                    crossOrigin={isBlob(src) ? undefined : "anonymous"}
                    onLoad={onMediaReady}
                  />
                );
              })}
            </div>
          ) : images.length ? (
            <img
              className="pc-media"
              src={images[0]}
              alt={post?.title || post?.author || "post"}
              loading="lazy"
              crossOrigin={isBlob(images[0]) ? undefined : "anonymous"}
              onLoad={onMediaReady}
            />
          ) : (
            <AmbientWorld className="pc-media" />
          )}
        </div>

        <div className="pc-botbar" role="toolbar" aria-label="Post actions">
          <div className="pc-ava"
               title={`View ${post?.author || "@user"}`}
               onClick={() => bus.emit?.("profile:open", { id: post.author })}
               role="button" aria-label="Open profile">
            <img src={post?.authorAvatar || "/avatar.jpg"} alt={post?.author || "user"} />
          </div>
          <div className="pc-actions" aria-label="Actions">
            <button className="pc-act" aria-label="React" title="React" onClick={() => setDrawer(true)}>
              <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 21s-7-4.5-9.5-8A5.8 5.8 0 0 1 12 6a5.8 5.8 0 0 1 9.5 7c-2.5 3.5-9.5 8-9.5 8z"
                      fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="pc-act" aria-label="Comment" title="Comment" onClick={() => setDrawer(true)}>
              <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 5h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-5 5v-5H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
                      fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="pc-act" aria-label="Remix" title="Remix" onClick={() => bus.emit?.("post:remix", { id: post.id })}>
              <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 4h8l2 3h6v13H4zM7 10h10M7 14h10"
                      fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="pc-act" aria-label="Share" title="Share"
              onClick={async () => {
                if (typeof location !== "undefined" && typeof navigator !== "undefined" && (navigator as any).clipboard?.writeText) {
                  const url = `${location.origin}${location.pathname}#post-${post.id}`;
                  try { await (navigator as any).clipboard.writeText(url); } catch {}
                }
              }}>
              <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 9V5l7 7-7 7v-4H4V9h10Z"
                      fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {images.length > 1 && (
            <div className="pc-dots" aria-hidden="true">
              {images.map((_, i) => (
                <button key={i} className={`pc-dot ${i === idx ? "on" : ""}`} onClick={() => go(i)} aria-label={`Go to image ${i + 1}`} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pc-drawer">
        <div className="pc-drawer-inner">
          <div className="pc-emoji-bar" role="listbox" aria-label="React with emoji">
            {EMOJI_LIST.slice(0, 40).map((e, i) => (
              <button key={i} className="pc-emoji" onClick={() => bus.emit?.("post:react", { id: post.id, emoji: e })}
                title={e} aria-label={`React ${e}`}>{e}</button>
            ))}
          </div>

          <div className="pc-section">
            <strong>Reactions</strong>
            <div className="pc-reactions">
              {reactions.length ? reactions.map((e, i) => <span key={i} className="pc-re">{e}</span>) : <span className="pc-empty">—</span>}
            </div>
          </div>

          <div className="pc-section">
            <strong>Comments</strong>
            {comments.length ? (
              <ul className="pc-comments">{comments.map((c, i) => <li key={i}>{c}</li>)}</ul>
            ) : (<div className="pc-empty">—</div>)}
            <form className="pc-addcmt" onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem("cmt") as HTMLInputElement;
              const t = input.value.trim(); if (!t) return;
              bus.emit?.("post:comment", { id: post.id, body: t });
              input.value = "";
            }}>
              <input name="cmt" placeholder="Write a comment…" />
              <button type="submit">Send</button>
            </form>
          </div>
        </div>
      </div>
    </article>
  );
}
