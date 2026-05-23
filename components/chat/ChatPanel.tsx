"use client";
// Persistent slide-in chat panel — 400px desktop, full-screen mobile
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  collection, addDoc, query, orderBy, limit,
  onSnapshot, doc, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchMemoryEntries, buildSystemPrompt, buildMemoryContext } from "@/lib/memory";
import ReactMarkdown from "react-markdown";
import LoadingDots from "@/components/ui/LoadingDots";
import {
  RiSendPlane2Line, RiMicLine, RiMicOffLine, RiCheckLine,
  RiAddLine, RiChat1Line, RiArrowRightSLine, RiCloseLine,
  RiExternalLinkLine,
} from "react-icons/ri";
import Link from "next/link";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { useChatPanel } from "@/contexts/ChatPanelContext";
import { useIsTouch } from "@/hooks/useIsTouch";
import type { ChatMessage } from "@/types";

interface AssistantMessage extends ChatMessage {
  actions?: string[];
  image?: string;
}

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  updatedAt: string;
  createdAt: string;
}

function ActionsLog({ actions }: { actions: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[11px] text-success/80 hover:text-success transition-colors"
      >
        <RiCheckLine className="w-3 h-3" />
        {actions.length} action{actions.length > 1 ? "s" : ""} taken
        <span className="ml-0.5 opacity-60">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          {actions.map((action, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px] text-success bg-success/10 rounded-lg px-2.5 py-1.5">
              <RiCheckLine className="w-3.5 h-3.5 shrink-0" />
              {action}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatPanel() {
  const { isOpen, close } = useChatPanel();
  const { user } = useAuth();
  const isTouch = useIsTouch();

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatName, setActiveChatName] = useState("Chat");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Build system prompt once
  useEffect(() => {
    if (!user) return;
    fetchMemoryEntries(user.uid).then((memory) => {
      const memCtx = buildMemoryContext(memory);
      const prompt = buildSystemPrompt(memCtx, user.displayName ?? "User", {
        date: new Date().toDateString(),
      });
      setSystemPrompt(prompt);
    });
  }, [user]);

  // Auto-select most recent chat when panel opens
  useEffect(() => {
    if (!isOpen || !user || activeChatId) return;
    const q = query(
      collection(db, "users", user.uid, "chats"),
      orderBy("updatedAt", "desc"),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0];
        const chat = { id: d.id, ...d.data() } as Chat;
        setActiveChatId(chat.id);
        setActiveChatName(chat.name);
      }
    });
    return unsub;
  }, [isOpen, user, activeChatId]);

  // Load messages for active chat
  useEffect(() => {
    if (!user || !activeChatId) return;
    setMessages([]);
    const q = query(
      collection(db, "users", user.uid, "chats", activeChatId, "messages"),
      orderBy("timestamp", "asc"),
      limit(100)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AssistantMessage)));
    });
    return unsub;
  }, [user, activeChatId]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createChat = async () => {
    if (!user) return null;
    const now = new Date().toISOString();
    const ref = await addDoc(collection(db, "users", user.uid, "chats"), {
      name: "New Chat",
      lastMessage: "",
      createdAt: now,
      updatedAt: now,
    });
    setActiveChatId(ref.id);
    setActiveChatName("New Chat");
    setMessages([]);
    return ref.id;
  };

  const saveMessage = async (chatId: string, msg: Omit<AssistantMessage, "id" | "image">) => {
    if (!user) return;
    await addDoc(collection(db, "users", user.uid, "chats", chatId, "messages"), msg);
    await updateDoc(doc(db, "users", user.uid, "chats", chatId), {
      lastMessage: msg.content.slice(0, 80),
      updatedAt: new Date().toISOString(),
    });
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || !user || loading) return;

    let chatId = activeChatId;
    if (!chatId) {
      chatId = await createChat();
      if (!chatId) return;
    }

    const isFirstMessage = messages.length === 0;

    const userMsg: AssistantMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    await saveMessage(chatId, { role: "user", content: userMsg.content, timestamp: userMsg.timestamp });

    const history = [...messages.slice(-19), userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const placeholderId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: placeholderId, role: "assistant", content: "", timestamp: new Date().toISOString() },
    ]);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          messages: history,
          systemPrompt,
          uid: user.uid,
          chatId,
          localDate: format(new Date(), "yyyy-MM-dd"),
          isFirstMessage,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");

      if (data.renamedChat) {
        setActiveChatName(data.renamedChat);
      }

      const assistantMsg: AssistantMessage = {
        id: placeholderId,
        role: "assistant",
        content: data.text ?? "",
        actions: data.actions?.length ? data.actions : undefined,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => prev.map((m) => (m.id === placeholderId ? assistantMsg : m)));
      await saveMessage(chatId, {
        role: "assistant",
        content: assistantMsg.content,
        timestamp: assistantMsg.timestamp,
        ...(assistantMsg.actions ? { actions: assistantMsg.actions } : {}),
      });
    } catch {
      toast.error("Failed to get response");
      setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // On touch devices, Enter inserts a newline — send with the button instead.
      if (isTouch) return;
      e.preventDefault();
      sendMessage(input);
    }
  };

  const startRecording = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Speech not supported — try Chrome"); return; }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => setInput(e.results[0][0].transcript);
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
  };

  const stopRecording = () => { recognitionRef.current?.stop(); setRecording(false); };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="md:hidden fixed inset-0 bg-black/40 z-40"
        onClick={close}
      />

      {/* Panel */}
      <div
        className={`
          fixed z-50 flex flex-col
          /* Mobile: full screen above nav */
          inset-x-0 bottom-16 top-14
          /* Desktop: right-side panel */
          md:inset-auto md:top-14 md:right-0 md:bottom-0 md:w-[400px]
        `}
        style={{
          background: "rgba(15, 6, 13, 0.97)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderLeft: "1px solid rgba(255,255,255,0.10)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0"
          style={{ borderColor: "rgba(255,255,255,0.10)" }}
        >
          <RiChat1Line className="w-4 h-4 text-accent shrink-0" />
          <span className="flex-1 text-sm font-medium text-text-primary truncate">{activeChatName}</span>
          <button
            onClick={createChat}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors"
            title="New chat"
          >
            <RiAddLine className="w-4 h-4" />
          </button>
          <Link
            href="/chat"
            onClick={close}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors"
            title="Full view"
          >
            <RiExternalLinkLine className="w-4 h-4" />
          </Link>
          <button
            onClick={close}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors"
            title="Close panel"
          >
            <RiCloseLine className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {!activeChatId || messages.length === 0 ? (
            <div className="text-center py-12 text-text-secondary">
              <RiChat1Line className="w-8 h-8 text-text-muted mx-auto mb-3" />
              <p className="text-sm font-medium text-text-primary mb-1">
                Hey {user?.displayName?.split(" ")[0] ?? "there"} 👋
              </p>
              <p className="text-xs text-text-muted">
                Ask me anything — I have your full context loaded.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] min-w-0 rounded-2xl px-3 py-2.5 overflow-hidden ${
                    msg.role === "user"
                      ? "bg-accent text-white rounded-tr-sm"
                      : "border border-white/10 rounded-tl-sm"
                  }`}
                  style={
                    msg.role === "assistant"
                      ? { background: "rgba(35, 14, 28, 0.88)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }
                      : undefined
                  }
                >
                  {msg.role === "assistant" ? (
                    msg.content ? (
                      <>
                        <div className="prose-dark text-xs break-words min-w-0">
                          <ReactMarkdown
                            components={{
                              a: ({ href, children }) => (
                                <a href={href} target="_blank" rel="noopener noreferrer">
                                  {children}
                                </a>
                              ),
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                        {msg.actions?.length ? <ActionsLog actions={msg.actions} /> : null}
                      </>
                    ) : (
                      <LoadingDots />
                    )
                  ) : (
                    <p className="text-xs whitespace-pre-wrap break-words">{msg.content}</p>
                  )}
                  <p
                    className={`text-[10px] mt-1 ${
                      msg.role === "user" ? "text-white/60 text-right" : "text-text-muted"
                    }`}
                  >
                    {format(new Date(msg.timestamp), "HH:mm")}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div
          className="shrink-0 px-3 py-2.5 border-t"
          style={{ borderColor: "rgba(255,255,255,0.10)" }}
        >
          <div
            className="flex items-end gap-2 rounded-xl px-3 py-2"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={handleKeyDown}
              placeholder="Message Claude…"
              className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none resize-none leading-5"
              style={{ maxHeight: "120px" }}
              disabled={loading}
            />
            <div className="flex items-center gap-1 shrink-0 pb-0.5">
              <button
                onClick={recording ? stopRecording : startRecording}
                className={`p-1.5 rounded-lg transition-colors ${
                  recording
                    ? "text-danger bg-danger/20"
                    : "text-text-secondary hover:text-text-primary hover:bg-white/10"
                }`}
                title={recording ? "Stop recording" : "Voice input"}
              >
                {recording ? <RiMicOffLine className="w-4 h-4" /> : <RiMicLine className="w-4 h-4" />}
              </button>
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="p-1.5 rounded-lg bg-accent text-white disabled:opacity-40 hover:bg-accent/90 transition-colors"
                title="Send"
              >
                <RiSendPlane2Line className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
