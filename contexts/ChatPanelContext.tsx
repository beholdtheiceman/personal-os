"use client";
import { createContext, useContext, useState, ReactNode } from "react";

interface ChatPanelContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const ChatPanelContext = createContext<ChatPanelContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
});

export function ChatPanelProvider({ children }: { children: ReactNode }) {
  // Session-persistent: resets when a new browser session starts (useState, not localStorage)
  const [isOpen, setIsOpen] = useState(false);

  return (
    <ChatPanelContext.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((o) => !o),
      }}
    >
      {children}
    </ChatPanelContext.Provider>
  );
}

export function useChatPanel() {
  return useContext(ChatPanelContext);
}
