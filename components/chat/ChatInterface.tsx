"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsTouch } from "@/hooks/useIsTouch";
import {
  collection, addDoc, getDocs, query, orderBy, limit,
  onSnapshot, doc, updateDoc, setDoc, getDoc, writeBatch, deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchMemoryEntries, buildSystemPrompt, buildMemoryContext } from "@/lib/memory";
import { checkAndAward } from "@/lib/checkAndAward";
import ReactMarkdown from "react-markdown";
import LoadingDots from "@/components/ui/LoadingDots";
import CameraCapture from "./CameraCapture";
import SkillPicker from "./SkillPicker";
import ActiveSkillBadge from "./ActiveSkillBadge";
import { useSkills } from "@/hooks/useSkills";
import type { Skill } from "@/lib/skills";
import { useTTS } from "@/hooks/useTTS";
import {
  RiSendPlane2Line, RiMicLine, RiMicOffLine, RiCheckLine,
  RiCameraLine, RiCloseLine, RiAddLine, RiChat1Line,
  RiEditLine, RiMenuLine, RiVolumeUpLine, RiVolumeMuteLine,
} from "react-icons/ri";
import toast from "react-hot-toast";
import type { ChatMessage } from "@/types";
import { format, isToday, isYesterday } from "date-fns";

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

function chatDateLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
}

export default function ChatInterface() {
  const { user } = useAuth();
  const isTouch = useIsTouch();

  // ── Chats list state ─────────────────────────────────────────────────────
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Active chat state ────────────────────────────────────────────────────
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [chatsLoaded, setChatsLoaded] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Build system prompt once ─────────────────────────────────────────────
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

  // ── Migrate old chat_history → new chats structure (runs once) ──────────
  const migrateOldHistory = async (uid: string) => {
    // Check if already migrated
    const flagRef = doc(db, "users", uid, "settings", "chat_migration");
    const flagSnap = await getDoc(flagRef);
    if (flagSnap.exists()) return;

    // Check if there's anything to migrate
    const oldSnap = await getDocs(
      query(collection(db, "users", uid, "chat_history"), orderBy("timestamp", "asc"))
    );
    if (oldSnap.empty) {
      await setDoc(flagRef, { done: true, migratedAt: new Date().toISOString() });
      return;
    }

    // Group messages by date
    const byDate: Record<string, AssistantMessage[]> = {};
    for (const d of oldSnap.docs) {
      const msg = { id: d.id, ...d.data() } as AssistantMessage;
      const date = msg.timestamp?.slice(0, 10) ?? "unknown";
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(msg);
    }

    // Create one chat per date
    const dates = Object.keys(byDate).sort();
    for (const date of dates) {
      const msgs = byDate[date];
      const label = format(new Date(date + "T12:00:00"), "MMMM d, yyyy");
      const lastMsg = msgs[msgs.length - 1];
      const chatRef = await addDoc(collection(db, "users", uid, "chats"), {
        name: label,
        lastMessage: lastMsg.content.slice(0, 80),
        createdAt: msgs[0].timestamp,
        updatedAt: lastMsg.timestamp,
      });
      // Write messages in batches of 500
      const BATCH_SIZE = 499;
      for (let i = 0; i < msgs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        for (const msg of msgs.slice(i, i + BATCH_SIZE)) {
          const msgRef = doc(collection(db, "users", uid, "chats", chatRef.id, "messages"));
          batch.set(msgRef, {
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            ...(msg.actions ? { actions: msg.actions } : {}),
          });
        }
        await batch.commit();
      }
    }

    // Mark as done
    await setDoc(flagRef, { done: true, migratedAt: new Date().toISOString(), chatsCreated: dates.length });
    toast.success(`Restored ${dates.length} day${dates.length > 1 ? "s" : ""} of chat history`);
  };

  // ── Live chats list ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    // Run migration once before loading chats
    migrateOldHistory(user.uid).catch(console.error);

    const q = query(
      collection(db, "users", user.uid, "chats"),
      orderBy("updatedAt", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Chat));
      setChats(list);
      setChatsLoaded(true);
      // Auto-select the most recent chat on first load
      if (!activeChatId && list.length > 0) {
        setActiveChatId(list[0].id);
      }
    });
    return unsub;
  }, [user]);

  // ── Load messages for active chat ────────────────────────────────────────
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Create new chat ──────────────────────────────────────────────────────
  const createChat = async (name = "New Chat") => {
    if (!user) return null;
    const now = new Date().toISOString();
    const ref = await addDoc(collection(db, "users", user.uid, "chats"), {
      name,
      lastMessage: "",
      createdAt: now,
      updatedAt: now,
    });
    setActiveChatId(ref.id);
    setSidebarOpen(false);
    return ref.id;
  };

  // ── Rename chat ───────────────────────────────────────────────────────────
  const renameChat = async (chatId: string, name: string) => {
    if (!user || !name.trim()) return;
    await updateDoc(doc(db, "users", user.uid, "chats", chatId), { name: name.trim() });
    setEditingChatId(null);
  };

  // Start inline rename
  const startRename = (chat: Chat) => {
    setEditingChatId(chat.id);
    setEditingName(chat.name);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };

  // ── Save message to Firestore ────────────────────────────────────────────
  const saveMessage = async (chatId: string, msg: Omit<AssistantMessage, "id" | "image">) => {
    if (!user) return null;
    const ref = await addDoc(collection(db, "users", user.uid, "chats", chatId, "messages"), msg);
    // Update chat metadata
    await updateDoc(doc(db, "users", user.uid, "chats", chatId), {
      lastMessage: msg.content.slice(0, 80),
      updatedAt: new Date().toISOString(),
    });
    return ref;
  };

  // ── TTS ───────────────────────────────────────────────────────────────────
  const tts = useTTS();

  // ── Skills ───────────────────────────────────────────────────────────────
  const skills = useSkills(systemPrompt);

  const sendOpeningMessage = async (skill: Skill) => {
    if (!user) return;
    let chatId = activeChatId;
    if (!chatId) { chatId = await createChat(); if (!chatId) return; }
    const placeholderId = `skill-${Date.now()}`;
    setMessages((prev) => [...prev, { id: placeholderId, role: "assistant", content: "", timestamp: new Date().toISOString() }]);
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          messages: [{ role: "user", content: skill.openingPrompt }],
          systemPrompt: `${systemPrompt}\n\n${skill.systemPromptAddition}`,
          uid: user.uid,
          chatId,
          localDate: format(new Date(), "yyyy-MM-dd"),
          isFirstMessage: messages.length === 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      const assistantMsg: AssistantMessage = {
        id: placeholderId,
        role: "assistant",
        content: data.text ?? "",
        actions: data.actions?.length ? data.actions : undefined,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => prev.map((m) => m.id === placeholderId ? assistantMsg : m));
      await saveMessage(chatId, { role: "assistant", content: assistantMsg.content, timestamp: assistantMsg.timestamp, ...(assistantMsg.actions ? { actions: assistantMsg.actions } : {}) });
    } catch {
      toast.error("Failed to load skill context");
      setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSkill = (skill: Skill) => {
    skills.activateSkill(skill);
    setInput("");
    sendOpeningMessage(skill);
  };

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = async (text: string) => {
    if ((!text.trim() && !capturedImage) || !user || loading) return;
    if (text.trim() === "/end") { skills.dismissSkill(); setInput(""); return; }
    tts.stop();

    // Create a new chat if none is active
    let chatId = activeChatId;
    if (!chatId) {
      chatId = await createChat();
      if (!chatId) return;
    }

    const displayText = text.trim() || (capturedImage ? "What's in this image?" : "");
    const imageToSend = capturedImage;
    const isFirstMessage = messages.length === 0;

    const userMsg: AssistantMessage = {
      id: Date.now().toString(),
      role: "user",
      content: displayText,
      timestamp: new Date().toISOString(),
      image: imageToSend ?? undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setCapturedImage(null);
    setLoading(true);
    // Reset textarea height after clearing
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const savedUserRef = await saveMessage(chatId, { role: "user", content: userMsg.content, timestamp: userMsg.timestamp });

    await checkAndAward(user.uid, "hello_world");
    if (messages.length + 1 >= 500) await checkAndAward(user.uid, "power_user");

    const history = [...messages.slice(-19), userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const placeholderId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, {
      id: placeholderId, role: "assistant", content: "", timestamp: new Date().toISOString(),
    }]);

    try {
      const idToken = await user.getIdToken();
      const imageBase64 = imageToSend
        ? imageToSend.replace(/^data:image\/\w+;base64,/, "")
        : undefined;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          messages: history,
          systemPrompt: skills.effectiveSystemPrompt,
          uid: user.uid,
          chatId,
          localDate: format(new Date(), "yyyy-MM-dd"),
          imageBase64,
          isFirstMessage,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");

      // Handle rename action from API
      if (data.renamedChat) {
        // Chat name updated server-side, nothing to do — sidebar listener picks it up
      }

      const assistantMsg: AssistantMessage = {
        id: placeholderId,
        role: "assistant",
        content: data.text ?? "",
        actions: data.actions?.length ? data.actions : undefined,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => prev.map((m) => m.id === placeholderId ? assistantMsg : m));
      tts.speakResponse(assistantMsg.content);
      await saveMessage(chatId, {
        role: "assistant",
        content: assistantMsg.content,
        timestamp: assistantMsg.timestamp,
        ...(assistantMsg.actions ? { actions: assistantMsg.actions } : {}),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to get response");
      // Roll back the user message we optimistically saved — otherwise the chat is
      // left ending on a user turn, and the next send produces two consecutive user
      // messages, which the Anthropic API rejects (permanently breaking the chat).
      setMessages((prev) => prev.filter((m) => m.id !== placeholderId && m.id !== userMsg.id));
      if (savedUserRef) await deleteDoc(savedUserRef).catch(() => { /* best-effort */ });
      // Put the text back so a failed send doesn't lose what the user typed
      setInput(displayText);
    } finally {
      setLoading(false);
      // Return focus to textarea so user can keep typing immediately
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  // ── Voice input ──────────────────────────────────────────────────────────
  const startRecording = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Speech recognition isn't supported in this browser. Try Chrome."); return; }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => setInput(e.results[0][0].transcript);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      const msgs: Record<string, string> = {
        "not-allowed": "Microphone permission denied",
        "no-speech": "No speech detected — try again",
        "network": "Network error",
        "audio-capture": "No microphone found",
      };
      toast.error(msgs[e.error] ?? `Speech error: ${e.error}`);
      setRecording(false);
    };
    recognition.onend = () => setRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
  };

  const stopRecording = () => { recognitionRef.current?.stop(); setRecording(false); };

  const activeChat = chats.find((c) => c.id === activeChatId);

  // ── Sidebar ──────────────────────────────────────────────────────────────
  const Sidebar = (
    <div className="flex flex-col h-full w-64 border-r border-white/10 shrink-0" style={{ background: "rgba(20, 8, 18, 0.85)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
      <div className="p-3 border-b border-white/10">
        <button
          onClick={() => createChat()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <RiAddLine className="w-4 h-4" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {!chatsLoaded ? (
          <div className="flex justify-center py-8"><LoadingDots /></div>
        ) : chats.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-8">No chats yet</p>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => { setActiveChatId(chat.id); setSidebarOpen(false); }}
              className={`group relative flex items-start gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                chat.id === activeChatId
                  ? "bg-accent/20 text-accent"
                  : "hover:bg-white/10 text-text-secondary"
              }`}
            >
              <RiChat1Line className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                {editingChatId === chat.id ? (
                  <input
                    ref={renameInputRef}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => renameChat(chat.id, editingName)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") renameChat(chat.id, editingName);
                      if (e.key === "Escape") setEditingChatId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full text-xs bg-transparent border-b border-accent outline-none text-text-primary"
                  />
                ) : (
                  <p className="text-xs font-medium truncate">{chat.name}</p>
                )}
                <p className="text-[10px] text-text-muted truncate mt-0.5">{chat.lastMessage || "No messages yet"}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[10px] text-text-muted">{chatDateLabel(chat.updatedAt)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); startRename(chat); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-accent"
                >
                  <RiEditLine className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        {Sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 flex">
            {Sidebar}
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0" style={{ background: "rgba(20, 8, 18, 0.85)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/10"
          >
            <RiMenuLine className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            {activeChatId && editingChatId === activeChatId ? (
              <input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => renameChat(activeChatId, editingName)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") renameChat(activeChatId!, editingName);
                  if (e.key === "Escape") setEditingChatId(null);
                }}
                className="text-sm font-medium bg-transparent border-b border-accent outline-none text-text-primary w-full max-w-xs"
                autoFocus
              />
            ) : (
              <button
                onClick={() => activeChat && startRename(activeChat)}
                className="text-sm font-medium text-text-primary hover:text-accent transition-colors truncate max-w-xs flex items-center gap-1.5 group"
                title="Click to rename"
              >
                {activeChat?.name ?? "Select a chat"}
                {activeChat && <RiEditLine className="w-3 h-3 opacity-0 group-hover:opacity-60 shrink-0" />}
              </button>
            )}
          </div>
          <button
            onClick={() => createChat()}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/10"
            title="New chat"
          >
            <RiAddLine className="w-5 h-5" />
          </button>
        </div>

        {/* Messages — explicit dark bg so the input's backdrop-filter blurs dark, not browser-white */}
        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-4" style={{ background: "rgba(8,3,5,0.55)" }}>
          {!activeChatId ? (
            <div className="text-center py-16 text-text-secondary">
              <RiChat1Line className="w-10 h-10 text-text-muted mx-auto mb-3" />
              <p className="text-lg font-medium text-text-primary mb-2">
                Hey {user?.displayName?.split(" ")[0] ?? "there"} 👋
              </p>
              <p className="text-sm mb-4">Start a new chat or select one from the sidebar.</p>
              <button onClick={() => createChat()} className="btn-primary text-sm">
                New Chat
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16 text-text-secondary">
              <p className="text-lg font-medium text-text-primary mb-2">
                Hey {user?.displayName?.split(" ")[0] ?? "there"} 👋
              </p>
              <p className="text-sm mb-1">Ask me anything. I have your full context loaded.</p>
              <p className="text-xs text-text-muted">I can add tasks, schedule events, log health, set goals, and more.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] md:max-w-[70%] min-w-0 rounded-2xl px-4 py-3 overflow-hidden ${
                    msg.role === "user"
                      ? "bg-accent text-white rounded-tr-sm"
                      : "border border-white/10 rounded-tl-sm"
                  }`}
                  style={msg.role === "assistant" ? { background: "rgba(35, 14, 28, 0.88)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" } : undefined}
                >
                  {msg.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={msg.image} alt="Attached" className="rounded-xl mb-2 max-w-full max-h-48 object-cover" />
                  )}
                  {msg.role === "assistant" ? (
                    msg.content ? (
                      <>
                        <div className="prose-dark text-sm break-words min-w-0">
                          <ReactMarkdown
                            components={{
                              a: ({ href, children }) => {
                                const text = String(children);
                                const isRawUrl = text.startsWith("http://") || text.startsWith("https://");
                                const label = isRawUrl
                                  ? (() => { try { return new URL(text).hostname; } catch { return text.slice(0, 40) + "…"; } })()
                                  : children;
                                return <a href={href} target="_blank" rel="noopener noreferrer" title={href}>{label}</a>;
                              },
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                        {msg.actions?.length ? <ActionsLog actions={msg.actions} /> : null}
                      </>
                    ) : <LoadingDots />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  )}
                  <p className={`text-[10px] mt-1.5 ${msg.role === "user" ? "text-white/60 text-right" : "text-text-muted"}`}>
                    {format(new Date(msg.timestamp), "HH:mm")}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="border-t border-white/10 px-4 py-3 shrink-0" style={{ background: "rgba(20, 8, 18, 0.90)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          {capturedImage && (
            <div className="relative inline-block mb-2 ml-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={capturedImage} alt="Captured" className="h-16 w-16 rounded-xl object-cover border-2 border-accent/30" />
              <button
                onClick={() => setCapturedImage(null)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-danger text-white flex items-center justify-center"
              >
                <RiCloseLine className="w-3 h-3" />
              </button>
            </div>
          )}
          {skills.activeSkill && (
            <ActiveSkillBadge skill={skills.activeSkill} onDismiss={skills.dismissSkill} />
          )}
          <div className="relative flex items-end gap-2 max-w-4xl mx-auto">
            <SkillPicker
              open={skills.pickerOpen}
              skills={skills.filteredSkills}
              highlightedIndex={skills.highlightedIndex}
              onSelect={handleSelectSkill}
              onClose={skills.closePicker}
            />
            <textarea
              ref={textareaRef}
              className="input-base flex-1 resize-none min-h-[44px] py-2.5 text-sm overflow-y-auto"
              style={{
                background: "rgba(255,255,255,0.08)",
                color: "white",
                borderColor: "rgba(255,255,255,0.15)",
                maxHeight: "240px",
              }}
              placeholder={capturedImage ? "Ask about this image…" : "Message your AI assistant…"}
              value={input}
              onChange={(e) => {
                const val = e.target.value;
                skills.onInputChange(val);
                setInput(val);
                // Auto-resize: reset then grow to content
                const el = e.target;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
              }}
              onKeyDown={(e) => {
                const skillResult = skills.onPickerKeyDown(e);
                if (skillResult === "consumed") return;
                if (skillResult && typeof skillResult === "object") { handleSelectSkill(skillResult); return; }
                if (e.key === "Enter" && !e.shiftKey) {
                  // On touch devices, Enter inserts a newline — send with the button instead.
                  if (isTouch) return;
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              rows={1}
            />
            <button
              onClick={() => setShowCamera(true)}
              disabled={loading}
              className="p-2.5 rounded-lg border transition-colors bg-white/10 text-text-secondary hover:text-text-primary border-white/15"
            >
              <RiCameraLine className="w-5 h-5" />
            </button>
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={loading}
              className={`p-2.5 rounded-lg border transition-colors ${
                recording ? "bg-danger/20 text-danger border-danger/30 animate-pulse" : "bg-white/10 text-text-secondary hover:text-text-primary border-white/15"
              }`}
            >
              {recording ? <RiMicOffLine className="w-5 h-5" /> : <RiMicLine className="w-5 h-5" />}
            </button>
            <button
              onClick={tts.toggle}
              className={`p-2.5 rounded-lg border transition-colors ${
                tts.enabled ? "bg-accent/20 text-accent border-accent/30" : "bg-white/10 text-text-secondary hover:text-text-primary border-white/15"
              }`}
              title={tts.enabled ? "Voice on — click to mute" : "Enable voice responses"}
            >
              {tts.enabled ? <RiVolumeUpLine className="w-5 h-5" /> : <RiVolumeMuteLine className="w-5 h-5" />}
            </button>
            <button
              onClick={() => sendMessage(input)}
              disabled={(!input.trim() && !capturedImage) || loading}
              className="btn-primary p-2.5 disabled:opacity-50"
            >
              <RiSendPlane2Line className="w-5 h-5" />
            </button>
          </div>
          <p className="text-center text-[11px] text-text-muted mt-2">
            {isTouch ? "Tap send to send · Enter adds a new line" : "Shift+Enter for new line · Enter to send"}
          </p>
        </div>
      </div>

      {showCamera && (
        <CameraCapture
          onCapture={(dataUrl) => setCapturedImage(dataUrl)}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
