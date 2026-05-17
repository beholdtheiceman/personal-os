// Chat page — full height, no extra padding
import ChatInterface from "@/components/chat/ChatInterface";

export default function ChatPage() {
  return (
    <div className="-m-4 md:-m-6 h-[calc(100vh-3.5rem)]">
      <ChatInterface />
    </div>
  );
}
