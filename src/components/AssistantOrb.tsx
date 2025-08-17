// src/components/AssistantOrb.tsx
import React, { useEffect, useRef, useState } from "react";
import bus from "../lib/bus";
import { logError } from "../lib/logger";
import { askLLMVoice, buildAssistantContext } from "../lib/assistant";
import useSpeech from "../lib/useSpeech";
import type { AssistantMessage, Post } from "../types";
import RadialMenu from "./RadialMenu";
import { HOLD_MS } from "./orbConstants";
import { motion, useReducedMotion } from "framer-motion";
import { EMOJI_LIST } from "../lib/emojis";
import { getKey } from "../lib/secureStore";

/**
 * Assistant Orb — circular quick menu + 60fps drag + voice.
 * - Tap = show radial menu (Chat top / React / Comment / Remix / Profile)
 * - Hold = push-to-talk; Double-click = toggle mic
 * - Drag (cross threshold) also starts mic; drop over post links context
 * - Petal drawers for React/Comment/Remix; Chat panel on side
 */


const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

// Derive sizes from the viewport rather than hard-coded pixels so the orb
// scales sensibly on phones and large screens. Use fallbacks for SSR/tests.
const vw = typeof window === "undefined" ? 1024 : window.innerWidth;
const ORB_SIZE = clamp(vw * 0.1, 56, 76);            // 10vw, min 56px, max 76px
const ORB_MARGIN = clamp(vw * 0.02, 8, 16);          // 2vw, min 8px
const DRAG_THRESHOLD = clamp(vw * 0.01, 4, 10);      // 1vw, min 4px
const PANEL_WIDTH = clamp(vw * 0.8, 260, 360);       // 80vw, max 360px
const STORAGE_KEY = "assistantOrbPos.v6";
const uuid = () => {
  try {
    return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  } catch {
    return Math.random().toString(36).slice(2);
  }
};


function getClosestPostId(el: Element | null): string | null {
  return el?.closest?.("[data-post-id]")?.getAttribute?.("data-post-id") ?? null;
}

function getPostText(p: Post | null): string {
  if (!p) return "";
  try {
    const el = document.querySelector(`[data-post-id="${p.id}"]`);
    return el?.textContent?.trim().slice(0, 2000) || "";
  } catch {
    return "";
  }
}

export default function AssistantOrb() {
  const mountedRef = useRef(true);
  // committed position
  const [pos, _setPos] = useState(() => {
    if (typeof window === "undefined") return { x: 0, y: 0 };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { x: number; y: number };
        return {
          x: clamp(saved.x, ORB_MARGIN, window.innerWidth - ORB_SIZE - ORB_MARGIN),
          y: clamp(saved.y, ORB_MARGIN, window.innerHeight - ORB_SIZE - ORB_MARGIN),
        };
      }
    } catch {}
    return {
      x: window.innerWidth - ORB_SIZE - ORB_MARGIN,
      y: window.innerHeight - ORB_SIZE - ORB_MARGIN,
    };
  });
  const setPos = (v: React.SetStateAction<{ x: number; y: number }>) => {
    if (mountedRef.current) {
      _setPos(v);
      requestAnimationFrame(updateAnchors);
    }
  };
  const posRef = useRef<{ x: number; y: number }>({ ...pos });

  // UI
  const [open, _setOpen] = useState(false);       // chat panel
  const setOpen = (v: React.SetStateAction<boolean>) => {
    if (mountedRef.current) {
      _setOpen(v);
      requestAnimationFrame(updateAnchors);
    }
  };
  const [mic, _setMic] = useState(false);
  const setMic = (v: React.SetStateAction<boolean>) => {
    if (mountedRef.current) _setMic(v);
  };
  const [toast, _setToast] = useState("");
  const setToast = (v: React.SetStateAction<string>) => {
    if (mountedRef.current) _setToast(v);
  };
  const [interim, _setInterim] = useState("");
  const setInterim = (v: React.SetStateAction<string>) => {
    if (mountedRef.current) _setInterim(v);
  };
  const [msgs, _setMsgs] = useState<AssistantMessage[]>([]);
  const setMsgs = (v: React.SetStateAction<AssistantMessage[]>) => {
    if (mountedRef.current) _setMsgs(v);
  };
  const [ctxPost, _setCtxPost] = useState<Post | null>(null);
  const setCtxPost = (v: React.SetStateAction<Post | null>) => {
    if (mountedRef.current) _setCtxPost(v);
  };
  const [ctxPostText, _setCtxPostText] = useState("");
  const setCtxPostText = (v: React.SetStateAction<string>) => {
    if (mountedRef.current) _setCtxPostText(v);
  };
  const [dragging, _setDragging] = useState(false);
  const setDragging = (v: React.SetStateAction<boolean>) => {
    if (mountedRef.current) _setDragging(v);
  };
  const [menuOpen, _setMenuOpen] = useState(false); // radial
  const setMenuOpen = (v: React.SetStateAction<boolean>) => {
    if (mountedRef.current) _setMenuOpen(v);
  };
  const [voiceOn, _setVoiceOn] = useState(true);
  const setVoiceOn = (v: React.SetStateAction<boolean>) => {
    if (mountedRef.current) _setVoiceOn(v);
  };
  const [playProgress, _setPlayProgress] = useState(0);
  const setPlayProgress = (v: React.SetStateAction<number>) => {
    if (mountedRef.current) _setPlayProgress(v);
  };
  const reduceMotion = useReducedMotion();

  // gestures
  const movedRef = useRef(false);
  const pressRef = useRef<{ id: number; dx: number; dy: number; sx: number; sy: number } | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const moveRafRef = useRef<number | null>(null);
  const lastPtrRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const preventTapRef   = useRef(false);
  const hoverIdRef = useRef<string | null>(null);

  // DOM refs
  const orbRef = useRef<HTMLButtonElement | null>(null);
  const toastRef = useRef<HTMLDivElement | null>(null);
  const interimRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const msgListRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const progressRafRef = useRef<number | null>(null);
  const inFlightIdRef = useRef(0);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      if (progressRafRef.current != null) {
        cancelAnimationFrame(progressRafRef.current);
      }
      audioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    const off = bus.on?.("voice:progress", (p: { buffered?: number }) => {
      if (typeof p?.buffered === "number") {
        setPlayProgress(p.buffered);
      }
    });
    return () => off?.();
  }, []);

  // feed context
  useEffect(() => {
    const onCtx = (p: { post: Post }) => {
      setCtxPost(p.post);
      setCtxPostText(getPostText(p.post));
    };
    const offHover = bus.on?.("feed:hover", onCtx);
    const offSelect = bus.on?.("feed:select", onCtx);
    return () => {
      offHover?.();
      offSelect?.();
    };
  }, []);

  // speech
  const {
    start: speechStart,
    stop: speechStop,
    supported: speechSupported,
  } = useSpeech({
    onResult: async (txt: string) => {
      await handleCommand(txt);
    },
    onInterim: (txt: string) => setInterim(txt),
    onStart: () => {
      setMic(true);
      setToast("Listening…");
    },
    onEnd: () => {
      setInterim("");
      setMic(false);
      setToast("");
    },
    onError: () => {
      setMic(false);
      setToast("Mic error");
    },
  });

  function startListening() {
    if (mic) return;
    if (!speechSupported) {
      setToast("Voice not supported");
      return;
    }
    speechStart();
  }

  function stopListening() {
    speechStop();
    setMic(false);
    setInterim("");
  }

  // commands
  const push = (m: AssistantMessage) => setMsgs(s => [...s, m]);

  async function handleCommand(text: string) {
    const T = text.trim();
    if (!T) return;

    const post = ctxPost || null;
    const ctx = buildAssistantContext(post, ctxPostText);

    push({ id: uuid(), role: "user", text: T, ts: Date.now(), postId: post?.id ?? null });

    const lower = T.toLowerCase();

    if (lower.startsWith("/react")) {
      const emoji = T.replace("/react", "").trim() || "❤️";
      if (post) {
        bus.emit?.("post:react", { id: post.id, emoji });
        push({ id: uuid(), role: "assistant", text: `✨ Reacted ${emoji} on ${post.id}`, ts: Date.now(), postId: post.id });
      } else {
        push({ id: uuid(), role: "assistant", text: "⚠️ Drag the orb over a post first.", ts: Date.now() });
      }
      return;
    }
    if (lower.startsWith("/comment ")) {
      const body = T.slice(9).trim();
      if (post) {
        bus.emit?.("post:comment", { id: post.id, body });
        push({ id: uuid(), role: "assistant", text: `💬 Commented: ${body}`, ts: Date.now(), postId: post.id });
      } else {
        push({ id: uuid(), role: "assistant", text: "⚠️ Drag onto a post to comment.", ts: Date.now() });
      }
      return;
    }
    if (lower.startsWith("/world")) {
      bus.emit?.("orb:portal", { x: posRef.current.x, y: posRef.current.y });
      push({ id: uuid(), role: "assistant", text: "🌀 Entering world…", ts: Date.now(), postId: post?.id ?? null });
      return;
    }
    if (lower.startsWith("/remix")) {
      if (post) {
        bus.emit?.("post:remix", { id: post.id });
        push({ id: uuid(), role: "assistant", text: `🎬 Remixing ${post.id}`, ts: Date.now(), postId: post.id });
      } else {
        push({ id: uuid(), role: "assistant", text: "⚠️ Drag onto a post to remix.", ts: Date.now() });
      }
      return;
    }

    // Ask the model with optional post context (id, title, visible text, selection, images)
    const apiKey = getKey("openai");
    if (!apiKey) {
      bus.emit?.("sidebar:open");
      setToast("Set your OpenAI API key in the sidebar to use the assistant");
      push({
        id: uuid(),
        role: "assistant",
        text: "⚠️ Set your OpenAI API key in the sidebar to use the assistant.",
        ts: Date.now(),
        postId: post?.id ?? null,
      });
      return;
    }

    const sendVoice = async () => {
      const id = ++inFlightIdRef.current;
      audioRef.current?.pause();
      setPlayProgress(0);

      const voiceResp = await askLLMVoice(T, ctx);
      if (id !== inFlightIdRef.current) return;
      if (voiceResp.ok) {
        if (voiceResp.text) {
          push({
            id: uuid(),
            role: "assistant",
            text: voiceResp.text,
            ts: Date.now(),
            postId: post?.id ?? null,
          });
        }

        if (voiceOn) {
          try {
            const el = audioRef.current;
            if (el) {
              if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
              if (id !== inFlightIdRef.current) {
                URL.revokeObjectURL(voiceResp.url);
                return;
              }
              audioUrlRef.current = voiceResp.url;
              el.src = voiceResp.url;
              setPlayProgress(0);
              try {
                await el.play();
              } catch (err) {
                logError(err);
                setToast("Audio playback failed");
              }
            }
          } catch (err) {
            logError(err);
            setToast("Voice failed");
            push({ id: uuid(), role: "assistant", text: "🔇 Voice unavailable", ts: Date.now(), postId: post?.id ?? null });
          }
        } else {
          URL.revokeObjectURL(voiceResp.url);
        }
      } else {
        const err = voiceResp.error;
        let msg = err.message || "Unknown error";
        if (err.type === "aborted") msg = "Request timed out";
        else if (err.type === "network") msg = "Network error, please check your connection";
        else if (err.type === "openai" && err.status === 401)
          msg = "Invalid or missing OpenAI API key";
        setToast(msg);
        push({
          id: uuid(),
          role: "assistant",
          text: `⚠️ ${msg}`,
          ts: Date.now(),
          postId: post?.id ?? null,
          meta:
            err.type === "openai" && err.status === 401
              ? undefined
              : { retry: sendVoice },
        });
      }
    };

    await sendVoice();
  }

  // ✅ missing function (caused your build error)
  function handleEmojiClick(emoji: string) {
    if (!ctxPost) { setToast("Hover a post first"); return; }
    bus.emit?.("post:react", { id: ctxPost.id, emoji });
    setToast(`Reacted ${emoji}`);
    window.setTimeout(() => setToast(""), 900);
  }

  function handleComment() {
    if (!ctxPost) { setToast("Hover a post first"); return; }
    const body = window.prompt("Write a comment");
    if (!body) return;
    bus.emit?.("post:comment", { id: ctxPost.id, body });
    setToast("Commented");
    window.setTimeout(() => setToast(""), 900);
  }

  function handleRemix() {
    if (!ctxPost) { setToast("Hover a post first"); return; }
    bus.emit?.("post:remix", { id: ctxPost.id });
    setToast("Remixing");
    window.setTimeout(() => setToast(""), 900);
  }

  async function handleShare() {
    if (!ctxPost) { setToast("Hover a post first"); return; }
    try {
      const url = `${location.origin}${location.pathname}#post-${ctxPost.id}`;
      await navigator.clipboard.writeText(url);
      setToast("Link copied");
      window.setTimeout(() => setToast(""), 900);
    } catch {}
  }

  // hover highlight
  function setHover(id: string | null) {
    if (hoverIdRef.current) {
      document
        .querySelector(`[data-post-id="${hoverIdRef.current}"]`)
        ?.classList.remove("pc-target");
      hoverIdRef.current = null;
    }
    if (id) {
      document
        .querySelector(`[data-post-id="${id}"]`)
        ?.classList.add("pc-target");
      hoverIdRef.current = id;
    }
  }

  // move & anchors
  function applyTransform(x: number, y: number) {
    const el = orbRef.current; if (!el) return;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function updateAnchors() {
    if (typeof window === "undefined") return;
    const { x, y } = posRef.current;

    const panelEl = panelRef.current;
    const measuredPanelW = panelEl?.offsetWidth || PANEL_WIDTH;
    const spaceRight = window.innerWidth - (x + ORB_SIZE + 8);
    const placeRightToast = spaceRight >= 200;

    if (toastRef.current) {
      const s = toastRef.current.style;
      s.position = "fixed";
      s.top = `${y + ORB_SIZE / 2}px`;
      s.left = placeRightToast ? `${x + ORB_SIZE + 8}px` : `${x - 8}px`;
      s.transform = placeRightToast ? "translateY(-50%)" : "translate(-100%, -50%)";
    }

    if (interimRef.current) {
      const s = interimRef.current.style;
      s.position = "fixed";
      s.top = `${Math.max(ORB_MARGIN, y - 30)}px`;
      s.left = placeRightToast ? `${x + ORB_SIZE + 8}px` : `${x - 8}px`;
      s.transform = placeRightToast ? "none" : "translateX(-100%)";
    }

    if (panelEl && open) {
      const s = panelEl.style;
      const panelH = panelEl.offsetHeight || 260;
      const top = clamp(
        y - 180,
        ORB_MARGIN,
        Math.max(ORB_MARGIN, window.innerHeight - panelH - ORB_MARGIN)
      );
      s.position = "fixed";
      s.top = `${top}px`;

      const minX = ORB_MARGIN;
      const maxX = window.innerWidth - measuredPanelW - ORB_MARGIN;
      const rightX = x + ORB_SIZE + 8;
      const leftX = x - measuredPanelW - 8;

      if (rightX <= maxX) {
        const nx = clamp(rightX, minX, maxX);
        s.left = `${nx}px`;
        s.transform = "none";
      } else if (leftX >= minX) {
        const nx = clamp(leftX, minX, maxX);
        s.left = `${nx}px`;
        s.transform = "none";
      } else {
        const center = clamp(
          x + ORB_SIZE / 2,
          ORB_MARGIN + measuredPanelW / 2,
          window.innerWidth - ORB_MARGIN - measuredPanelW / 2
        );
        s.left = `${center}px`;
        s.transform = "translateX(-50%)";
      }

      s.right = "";
    }
  }

  // pointer handlers
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = orbRef.current; if (!el) return;
    try { el.setPointerCapture(e.pointerId); } catch {}
    const dx = e.clientX - posRef.current.x;
    const dy = e.clientY - posRef.current.y;
    pressRef.current = { id: e.pointerId, dx, dy, sx: e.clientX, sy: e.clientY };
    movedRef.current = false;
    preventTapRef.current = false;
    setDragging(true);
    setMenuOpen(false);

    el.style.pointerEvents = "none";

    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = true;
      startListening();
    }, HOLD_MS);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pressRef.current) return;
    lastPtrRef.current = { x: e.clientX, y: e.clientY };
    if (moveRafRef.current != null) return;

    moveRafRef.current = requestAnimationFrame(() => {
      moveRafRef.current = null;
      const cur = lastPtrRef.current; if (!cur) return;

      const { dx, dy, sx, sy } = pressRef.current!;
      const nx = clamp(cur.x - dx, ORB_MARGIN, Math.max(ORB_MARGIN, window.innerWidth - ORB_SIZE - ORB_MARGIN));
      const ny = clamp(cur.y - dy, ORB_MARGIN, Math.max(ORB_MARGIN, window.innerHeight - ORB_SIZE - ORB_MARGIN));
      const dist = Math.hypot(cur.x - sx, cur.y - sy);
      if (holdTimerRef.current && dist > DRAG_THRESHOLD) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (!movedRef.current && dist > DRAG_THRESHOLD) {
        movedRef.current = true;
        preventTapRef.current = true;
        // Start listening once drag threshold is crossed
        if (!mic) { suppressClickRef.current = true; startListening(); }
      }

      posRef.current = { x: nx, y: ny };
      applyTransform(nx, ny);
      updateAnchors();

      const under = document.elementFromPoint(cur.x, cur.y);
      const id = getClosestPostId(under);
      if (id !== hoverIdRef.current) {
        setHover(id);
        if (id) bus.emit?.("feed:select-id", { id });
      }
    });
  };

  function finishGesture(clientX: number, clientY: number) {
    pressRef.current = null;
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (moveRafRef.current != null) { cancelAnimationFrame(moveRafRef.current); moveRafRef.current = null; }

    setPos({ ...posRef.current });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(posRef.current)); } catch {}
    updateAnchors();

    if (mic && (suppressClickRef.current || movedRef.current)) {
      stopListening();
      if (movedRef.current) {
        const under = document.elementFromPoint(clientX, clientY);
        const id = getClosestPostId(under);
        if (id) {
          bus.emit?.("post:focus", { id });
          setToast(`🎯 linked to ${id}`);
          window.setTimeout(() => setToast(""), 1100);
        }
      }
    }

    setHover(null);
    setDragging(false);
    movedRef.current = false;
    suppressClickRef.current = false;

    const el = orbRef.current; if (el) el.style.pointerEvents = "auto";
  }

  const onPointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    lastPtrRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    finishGesture(e.clientX, e.clientY);
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    lastPtrRef.current = null;
    finishGesture(e.clientX, e.clientY);
  };

  const onLostPointerCapture = () => {
    const last = lastPtrRef.current;
    lastPtrRef.current = null;
    const fallback = { x: posRef.current.x + ORB_SIZE / 2, y: posRef.current.y + ORB_SIZE / 2 };
    finishGesture(last?.x ?? fallback.x, last?.y ?? fallback.y);
  };

  const onClick = () => {
    if (suppressClickRef.current || preventTapRef.current) {
      suppressClickRef.current = false;
      preventTapRef.current = false;
      return;
    }
    setMenuOpen(v => !v);
    requestAnimationFrame(updateAnchors);
  };

  // double‑click toggles mic
  const onDoubleClick = () => {
    if (mic) stopListening(); else startListening();
  };

  // lifecycle
  useEffect(() => { applyTransform(pos.x, pos.y); posRef.current = { ...pos }; updateAnchors(); }, []);
  useEffect(() => { updateAnchors(); }, [toast, interim, menuOpen, dragging]);
  useEffect(() => { requestAnimationFrame(updateAnchors); }, [open]);
  useEffect(() => { if (msgListRef.current) msgListRef.current.scrollTop = msgListRef.current.scrollHeight; }, [msgs]);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const menuEl = document.querySelector('[role="menu"]');
      if (orbRef.current?.contains(e.target as Node)) return;
      if (menuEl?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    let resizeTimer: number | null = null;
    const handleResize = () => {
      if (typeof window === "undefined") return;
      const nx = clamp(posRef.current.x, ORB_MARGIN, window.innerWidth - ORB_SIZE - ORB_MARGIN);
      const ny = clamp(posRef.current.y, ORB_MARGIN, window.innerHeight - ORB_SIZE - ORB_MARGIN);
      posRef.current = { x: nx, y: ny };
      setPos({ x: nx, y: ny });
      applyTransform(nx, ny);
      updateAnchors();
    };
    const onResize = () => {
      if (resizeTimer != null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(handleResize, 100);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setMenuOpen(false);
        stopListening();
        orbRef.current?.focus();
      }
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.removeEventListener("keydown", onKey);
      if (resizeTimer != null) window.clearTimeout(resizeTimer);
    };
  }, []);

  useEffect(() => {
    return () => {
      speechStop();
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (moveRafRef.current != null) cancelAnimationFrame(moveRafRef.current);
      setHover(null);
    };
  }, [speechStop]);

  // styles
  const keyframes = `
    @keyframes panelIn { from { opacity: 0; transform: scale(.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  `;

  const isSmall =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 480px)").matches;
  const orbStyle: React.CSSProperties = {
    position: "fixed",
    left: 0, top: 0,
    width: ORB_SIZE, height: ORB_SIZE,
    borderRadius: 999,
    zIndex: 9999,
    display: "grid", placeItems: "center",
    userSelect: "none", touchAction: "none",
    border: "1px solid rgba(255,255,255,.12)",
    background: "radial-gradient(120% 120% at 30% 30%, #fff, #ffc6f3 60%, #ff74de)",
    boxShadow: mic
      ? "0 18px 44px rgba(255,116,222,0.24), 0 0 0 12px rgba(255,116,222,0.12)"
      : "0 12px 30px rgba(0,0,0,.35)",
    willChange: "transform",
    backdropFilter: "blur(14px) saturate(140%)",
    WebkitBackdropFilter: "blur(14px) saturate(140%)",
    transition: reduceMotion || dragging ? "none" : "box-shadow .2s ease, filter .2s ease",
    cursor: dragging ? "grabbing" : "grab",
    transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
  };
  const coreStyle: React.CSSProperties = {
    width: ORB_SIZE - 20, height: ORB_SIZE - 20, borderRadius: 999,
    background: "radial-gradient(60% 60% at 40% 35%, rgba(255,255,255,.95), rgba(255,255,255,.28) 65%, transparent 70%)",
    pointerEvents: "none",
  };
  const ringStyle: React.CSSProperties = {
    position: "absolute", inset: -(ORB_SIZE * 0.08), borderRadius: 999, pointerEvents: "none",
  };
  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 9997,
  };
  const toastBoxStyle: React.CSSProperties = {
    position: "fixed",
    background: "rgba(0,0,0,.7)",
    color: "#fff",
    padding: isSmall ? "4px 6px" : "6px 10px",
    borderRadius: isSmall ? 8 : 10,
    fontSize: isSmall ? 11 : 13,
    zIndex: 9998,
    pointerEvents: "none",
  };
  const panelStyle: React.CSSProperties = {
    position: "fixed",
    width: PANEL_WIDTH,
    maxWidth: "90vw",
    background: "linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.02))",
    border: "1px solid rgba(255,255,255,.06)",
    borderRadius: isSmall ? 10 : 14,
    padding: isSmall ? 8 : 12,
    fontSize: isSmall ? 14 : 16,
    zIndex: 9998,
    boxShadow: "0 16px 40px rgba(0,0,0,.45)",
    backdropFilter: "blur(10px) saturate(140%)",
    WebkitBackdropFilter: "blur(10px) saturate(140%)",
    animation: reduceMotion ? undefined : "panelIn .2s ease-out",
  };

  function handleOrbKeyDown(e: React.KeyboardEvent) {
    const k = e.key.toLowerCase();
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setMenuOpen(v => !v);
    } else if (k === "v") {
      e.preventDefault();
      mic ? stopListening() : startListening();
    } else if (k === "r") {
      e.preventDefault();
      setMenuOpen(true);
    } else if (k === "c") {
      e.preventDefault();
      handleComment();
      setMenuOpen(false);
    } else if (k === "m") {
      e.preventDefault();
      handleRemix();
      setMenuOpen(false);
    } else if (k === "s") {
      e.preventDefault();
      handleShare();
      setMenuOpen(false);
    } else if (e.key === "Escape") {
      setMenuOpen(false);
      stopListening();
      orbRef.current?.focus();
    }
  }

  return (
    <>
      <style>{keyframes}</style>
      <audio
        ref={audioRef}
        style={{ display: "none" }}
        onTimeUpdate={e => {
          const el = e.currentTarget;
          if (el.duration) {
            if (progressRafRef.current != null) {
              cancelAnimationFrame(progressRafRef.current);
            }
            progressRafRef.current = requestAnimationFrame(() => {
              setPlayProgress(el.currentTime / el.duration);
            });
          }
        }}
        onEnded={() => {
          if (progressRafRef.current != null) {
            cancelAnimationFrame(progressRafRef.current);
          }
          setPlayProgress(1);
          if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
          }
        }}
        onError={() => {
          if (progressRafRef.current != null) {
            cancelAnimationFrame(progressRafRef.current);
          }
          setToast("Audio playback failed");
          if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
          }
        }}
      />

      <button
        ref={orbRef}
        aria-label="Assistant orb"
        title="Tap for quick menu • Hold/drag to talk • Double‑click to talk"
        style={orbStyle}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onLostPointerCapture}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onKeyDown={handleOrbKeyDown}
      >
        <motion.div
          style={{ position: "relative", width: "100%", height: "100%" }}
          animate={{ scale: reduceMotion ? 1 : menuOpen || mic ? 1.1 : 1 }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 20 }}
        >
          <div style={coreStyle} />
          <motion.div
            style={ringStyle}
            animate={{ boxShadow: mic ? "0 0 0 10px rgba(255,116,222,.16)" : "inset 0 0 24px rgba(255,255,255,.55)" }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
          />
        </motion.div>
      </button>

      {/* Radial menu */}
      {menuOpen && !dragging && (
        <>
          <div
            style={overlayStyle}
            onClick={() => {
              setMenuOpen(false);
              orbRef.current?.focus();
            }}
          />
          <RadialMenu
            center={{ x: pos.x + ORB_SIZE / 2, y: pos.y + ORB_SIZE / 2 }}
            onClose={() => {
              setMenuOpen(false);
              orbRef.current?.focus();
            }}
            onChat={() => {
              setOpen(v => !v);
              setMenuOpen(false);
              requestAnimationFrame(updateAnchors);
            }}
            onReact={(e) => {
              handleEmojiClick(e);
              setMenuOpen(false);
            }}
            onComment={() => {
              handleComment();
              setMenuOpen(false);
            }}
            onRemix={() => {
              handleRemix();
              setMenuOpen(false);
            }}
            onShare={() => {
              handleShare();
              setMenuOpen(false);
            }}
            onProfile={() => {
              if (ctxPost) bus.emit?.("profile:open", { id: (ctxPost as any).author });
              setMenuOpen(false);
            }}
            avatarUrl={(ctxPost as any)?.authorAvatar || "/avatar.jpg"}
            emojis={EMOJI_LIST.slice(0, 8)}
          />
        </>
      )}

      {/* toast + interim */}
      {toast && <div ref={toastRef} style={toastBoxStyle} aria-live="polite">{toast}</div>}
      {interim && <div ref={interimRef} style={toastBoxStyle} aria-live="polite">…{interim}</div>}

      {/* Chat panel */}
      {open && (
        <div ref={panelRef} style={panelStyle}>
          <div style={{ fontWeight: 800, paddingBottom: 4, display: "flex", alignItems: "center" }}>
            Assistant
            <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.6, paddingLeft: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {ctxPost ? `(Context: ${ctxPost.id})` : ""}
            </span>
            <button
              onClick={() => setVoiceOn(v => !v)}
              style={{ marginLeft: "auto", height: 28, padding: "0 10px", borderRadius: 8, cursor: "pointer", background: "rgba(255,255,255,.08)", color: "#fff", border: "1px solid rgba(255,255,255,.16)" }}
              aria-label={voiceOn ? "Mute voice" : "Enable voice"}
              title={voiceOn ? "Mute voice" : "Enable voice"}
              aria-pressed={voiceOn}
            >
              {voiceOn ? "🔊" : "🔇"}
            </button>
            <button onClick={() => setOpen(false)} style={{ marginLeft: 8, height: 28, padding: "0 10px", borderRadius: 8, cursor: "pointer", background: "rgba(255,255,255,.08)", color: "#fff", border: "1px solid rgba(255,255,255,.16)" }} aria-label="Close">✕</button>
          </div>

          {voiceOn && (
            <div
              role="progressbar"
              aria-valuenow={Math.round(playProgress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ height: 4, background: "rgba(255,255,255,.12)", marginBottom: 8 }}
            >
              <div
                style={{ width: `${playProgress * 100}%`, height: "100%", background: "#fff", transition: "width .1s linear" }}
              />
            </div>
          )}

          <div ref={msgListRef} style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 200, overflowY: "auto", padding: "6px 0" }}>
            {msgs.length === 0 && <div style={{ fontSize: 13, opacity: .75 }}>Hold/drag or double‑click to speak, or use the quick menu.</div>}
            {msgs.map(m => {
              const retry = (m.meta as any)?.retry as (() => void) | undefined;
              return (
                <div key={m.id} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "80%", background: m.role === "user" ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.06)", padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(255,255,255,.12)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ flex: 1 }}>{m.text}</span>
                    {retry && (
                      <button
                        onClick={() => {
                          retry();
                          setMsgs(s => s.filter(x => x.id !== m.id));
                        }}
                        style={{
                          padding: "0 6px",
                          height: 24,
                          borderRadius: 6,
                          cursor: "pointer",
                          background: "rgba(255,255,255,.08)",
                          border: "1px solid rgba(255,255,255,.16)",
                          color: "#fff",
                        }}
                        aria-label="Retry"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {interim && (
              <div style={{ display: "flex" }}>
                <div style={{ maxWidth: "80%", background: "rgba(255,255,255,.06)", padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(255,255,255,.12)" }}>
                  …{interim}
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={async e => {
              e.preventDefault();
              const input = (e.currentTarget.elements.namedItem("cmd") as HTMLInputElement);
              const t = input.value.trim();
              if (!t) return;
              input.value = "";
              await handleCommand(t);
            }}
            style={{ display: "flex", gap: 8, marginTop: 8 }}
          >
            <input
              name="cmd"
              placeholder="Type /comment hello, /react ❤️, /world, /remix"
              style={{ flex: 1, height: 36, padding: "0 10px", borderRadius: 10, outline: "none", background: "rgba(16,18,28,.65)", border: "1px solid rgba(255,255,255,.16)", color: "#fff" }}
            />
            <button
              type="button"
              onClick={() => (mic ? stopListening() : startListening())}
              style={{ height: 36, padding: "0 10px", borderRadius: 10, cursor: "pointer", background: mic ? "rgba(255,116,222,.25)" : "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.16)", color: "#fff" }}
              aria-label={mic ? "Stop" : "Speak"}
              title={mic ? "Stop" : "Speak"}
            >
              {mic ? "🎙️" : "🎤"}
            </button>
            <button type="submit" style={{ height: 36, padding: "0 12px", borderRadius: 10, cursor: "pointer", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.16)", color: "#fff" }} aria-label="Send">➤</button>
          </form>
        </div>
      )}

    </>
  );
}
