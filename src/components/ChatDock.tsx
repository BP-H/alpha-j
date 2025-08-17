// src/components/ChatDock.tsx
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useRef,
  useEffect,
} from "react";
import type { AssistantMessage, Post } from "../types";
import bus from "../lib/bus";

type ChatDockContextValue = {
  open: boolean;
  messages: AssistantMessage[];
  openDock: () => void;
  closeDock: () => void;
  addMessage: (msg: AssistantMessage) => void;
};

const ChatDockContext = createContext<ChatDockContextValue | undefined>(
  undefined,
);

export function ChatDockProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);

  const openDock = () => setOpen(true);
  const closeDock = () => setOpen(false);
  const addMessage = (msg: AssistantMessage) =>
    setMessages((m) => [...m, msg]);

  return (
    <ChatDockContext.Provider
      value={{ open, messages, openDock, closeDock, addMessage }}
    >
      {children}
    </ChatDockContext.Provider>
  );
}

export function useChatDock() {
  const ctx = useContext(ChatDockContext);
  if (!ctx)
    throw new Error("useChatDock must be used within a ChatDockProvider");
  return ctx;
}

export interface ChatDockProps {
  open?: boolean;
  messages?: AssistantMessage[];
  onClose?: () => void;
}

export default function ChatDock({
  open: openProp,
  messages: messagesProp,
  onClose,
}: ChatDockProps) {
  const ctx = useContext(ChatDockContext);
  const open = openProp ?? ctx?.open ?? false;
  const messages = messagesProp ?? ctx?.messages ?? [];
  const [ctxPost, setCtxPost] = useState<Post | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onCtx = (p: { post: Post }) => setCtxPost(p.post);
    const offHover = bus.on?.("feed:hover", onCtx);
    const offSelect = bus.on?.("feed:select", onCtx);
    return () => {
      offHover?.();
      offSelect?.();
    };
  }, []);

  const uuid = () => {
    try {
      return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
    } catch {
      return Math.random().toString(36).slice(2);
    }
  };

  const push = (m: AssistantMessage) => ctx?.addMessage(m);

  async function handleCommand(text: string) {
    const T = text.trim();
    if (!T) return;

    const post = ctxPost || null;
    push({ id: uuid(), role: "user", text: T, ts: Date.now(), postId: post?.id ?? null });

    const lower = T.toLowerCase();

    if (lower.startsWith("/react")) {
      const emoji = T.replace("/react", "").trim() || "❤️";
      if (post) {
        bus.emit?.("post:react", { id: post.id, emoji });
        push({ id: uuid(), role: "assistant", text: `✨ Reacted ${emoji} on ${post.id}`, ts: Date.now(), postId: post.id });
      } else {
        push({ id: uuid(), role: "assistant", text: "⚠️ Hover a post to react.", ts: Date.now() });
      }
      return;
    }

    if (lower.startsWith("/comment ")) {
      const body = T.slice(9).trim();
      if (post) {
        bus.emit?.("post:comment", { id: post.id, body });
        push({ id: uuid(), role: "assistant", text: `💬 Commented: ${body}`, ts: Date.now(), postId: post.id });
      } else {
        push({ id: uuid(), role: "assistant", text: "⚠️ Hover a post to comment.", ts: Date.now() });
      }
      return;
    }

    if (lower.startsWith("/share")) {
      if (post) {
        try {
          const url = `${location.origin}${location.pathname}#post-${post.id}`;
          await navigator.clipboard.writeText(url);
          push({ id: uuid(), role: "assistant", text: "🔗 Link copied", ts: Date.now(), postId: post.id });
        } catch {
          push({ id: uuid(), role: "assistant", text: "⚠️ Failed to copy link.", ts: Date.now(), postId: post.id });
        }
      } else {
        push({ id: uuid(), role: "assistant", text: "⚠️ Hover a post to share.", ts: Date.now() });
      }
      return;
    }

    push({ id: uuid(), role: "assistant", text: T, ts: Date.now(), postId: post?.id ?? null });
  }

  const insertCommand = (cmd: string) => {
    if (inputRef.current) {
      inputRef.current.value = cmd;
      inputRef.current.focus();
    }
  };

  const handleClose = () => {
    ctx?.closeDock?.();
    onClose?.();
  };

  if (!open) return null;

  return (
    <div
      className="chat-dock"
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "90vw",
        height: "70vh",
        maxWidth: "480px",
        maxHeight: "600px",
        background: "#fff",
        color: "#000",
        display: "flex",
        flexDirection: "column",
        border: "1px solid #ccc",
        borderRadius: "8px",
        zIndex: 1000,
      }}
    >
      <div style={{ padding: "8px", borderBottom: "1px solid #ddd" }}>
        <button
          aria-label="Close chat"
          onClick={handleClose}
          style={{ float: "right", border: "none", background: "none" }}
        >
          ×
        </button>
        <strong>Chat</strong>
      </div>
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "8px",
        }}
      >
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: "4px" }}>
            <b>{m.role === "assistant" ? "Assistant" : "You"}:</b> {m.text}
          </div>
        ))}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const t = inputRef.current?.value.trim() || "";
          if (!t) return;
          if (inputRef.current) inputRef.current.value = "";
          await handleCommand(t);
        }}
        style={{ display: "flex", gap: 8, padding: "8px", borderTop: "1px solid #ddd" }}
      >
        <input
          ref={inputRef}
          aria-label="Chat input"
          style={{ flex: 1, padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc" }}
        />
        <button type="submit" aria-label="Send" style={{ padding: "4px 12px" }}>
          Send
        </button>
      </form>
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "8px",
          borderTop: "1px solid #ddd",
        }}
      >
        <button
          type="button"
          onClick={() => insertCommand("/comment ")}
          aria-label="Insert /comment"
          style={{ flex: 1 }}
        >
          /comment
        </button>
        <button
          type="button"
          onClick={() => insertCommand("/react ")}
          aria-label="Insert /react"
          style={{ flex: 1 }}
        >
          /react
        </button>
        <button
          type="button"
          onClick={() => handleCommand("/share")}
          aria-label="Share current post"
          style={{ flex: 1 }}
        >
          /share
        </button>
      </div>
    </div>
  );
}
