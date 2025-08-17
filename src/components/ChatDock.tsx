// src/components/ChatDock.tsx
import React, { createContext, useContext, useState, ReactNode } from "react";
import type { AssistantMessage } from "../types";

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
    </div>
  );
}
