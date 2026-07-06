"use client";
import { createContext, useContext, useState, ReactNode } from "react";

interface ChatPanelContextType {
  isOpen: boolean;
  pendingMessage: string | null;
  open: (seed?: string) => void;
  close: () => void;
  toggle: () => void;
  consumePending: () => void;
}

const ChatPanelContext = createContext<ChatPanelContextType>({
  isOpen: false,
  pendingMessage: null,
  open: () => {},
  close: () => {},
  toggle: () => {},
  consumePending: () => {},
});

export function ChatPanelProvider({ children }: { children: ReactNode }) {
  // Session-persistent: resets when a new browser session starts (useState, not localStorage)
  const [isOpen, setIsOpen] = useState(false);
  // When set, the chat panel sends this as an opening user message once it opens —
  // lets the Today screen (and its quick-action chips) turn a tap into a conversation.
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  return (
    <ChatPanelContext.Provider
      value={{
        isOpen,
        pendingMessage,
        open: (seed?: string) => {
          if (seed != null && seed.trim() !== "") setPendingMessage(seed);
          setIsOpen(true);
        },
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((o) => !o),
        consumePending: () => setPendingMessage(null),
      }}
    >
      {children}
    </ChatPanelContext.Provider>
  );
}

export function useChatPanel() {
  return useContext(ChatPanelContext);
}
