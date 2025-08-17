// src/components/ChatDock.tsx
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";
import type { AssistantMessage } from "../types";
import "./ChatDock.css";

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
  const [minimized, setMinimized] = useState(false);

  const handleClose = () => {
    ctx?.closeDock?.();
    onClose?.();
  };

  if (!open) return null;

  if (minimized)
    return (
      <button
        className="chat-dock-icon"
        aria-label="Open chat"
        onClick={() => setMinimized(false)}
      >
        💬
      </button>
    );

  return (
    <div className="chat-dock">
      <div className="chat-dock-header">
        <strong>Chat</strong>
        <div>
          <button
            aria-label="Minimize chat"
            className="chat-dock-minimize"
            onClick={() => setMinimized(true)}
          >
            _
          </button>
          <button
            aria-label="Close chat"
            className="chat-dock-close"
            onClick={handleClose}
          >
            ×
          </button>
        </div>
      </div>
      <div className="chat-dock-messages">
        {messages.map((m) => (
          <div key={m.id} className="chat-dock-message">
            <b>{m.role === "assistant" ? "Assistant" : "You"}:</b> {m.text}
          </div>
        ))}
      </div>
    </div>
  );
}
