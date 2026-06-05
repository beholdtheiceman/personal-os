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
import { checkAndAward } from "@/lib/checkAndAward";
import ReactMarkdown from "react-markdown";
import LoadingDots from "@/components/ui/LoadingDots";
import {
  RiSendPlane2Line, RiMicLine, RiMicOffLine, RiCheckLine,
  RiAddLine, RiChat1Line, RiArrowRightSLine, RiCloseLine,
  RiExternalLinkLine, RiVolumeUpLine, RiVolumeMuteLine,
  RiAttachmentLine, RiEyeOffLine, RiEyeLine,
} from "react-icons/ri";
import Link from "next/link";
import { format } from "date-fns";
import toast from "react-hot-toast";
import SkillPicker from "./SkillPicker";
import ActiveSkillBadge from "./ActiveSkillBadge";
import { useSkills } from "@/hooks/useSkills";
import type { Skill } from "@/lib/skills";
import { useTTS } from "@/hooks/useTTS";
import { useChatPanel } from "@/contexts/ChatPanelContext";
import { compressImage } from "@/lib/compress-image";
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
  const [offRecord, setOffRecord] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; text: string; type: "text" } | { name: string; base64: string; type: "pdf" } | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          localTime: new Date().toLocaleTimeString("en-US", {
            hour12: false, hour: "2-digit", minute: "2-digit",
          }),
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => compressImage(reader.result as string).then(setCapturedImage).catch((err: Error) => toast.error(err.message));
      reader.readAsDataURL(file);
      e.target.value = "";
      return;
    }

    const textTypes = ["text/plain", "text/csv", "text/markdown", "application/json"];
    const isTextFile = textTypes.includes(file.type) || file.name.endsWith(".md") || file.name.endsWith(".csv") || file.name.endsWith(".txt");

    if (isTextFile) {
      const reader = new FileReader();
      reader.onload = () => setAttachedFile({ name: file.name, text: reader.result as string, type: "text" });
      reader.readAsText(file);
      e.target.value = "";
      return;
    }

    if (file.type === "application/pdf") {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.replace(/^data:application\/pdf;base64,/, "");
        setAttachedFile({ name: file.name, base64, type: "pdf" });
      };
      reader.readAsDataURL(file);
      e.target.value = "";
      return;
    }

    toast.error("Unsupported file type. Supported: images, .txt, .csv, .md, .json, .pdf");
    e.target.value = "";
  };

  const sendMessage = async (text: string) => {
    if ((!text.trim() && !capturedImage && !attachedFile) || !user || loading) return;
    if (text.trim() === "/end") { skills.dismissSkill(); setInput(""); return; }
    tts.stop();

    let chatId = activeChatId;
    if (!chatId) {
      chatId = await createChat();
      if (!chatId) return;
    }

    const isFirstMessage = messages.length === 0;
    const displayText = text.trim() || (capturedImage ? "What's in this image?" : attachedFile ? `Please analyze this file: ${attachedFile.name}` : "");
    const imageToSend = capturedImage;
    const fileToSend = attachedFile;
    setCapturedImage(null);
    setAttachedFile(null);

    const userMsg: AssistantMessage = {
      id: Date.now().toString(),
      role: "user",
      content: displayText,
      timestamp: new Date().toISOString(),
      image: imageToSend ?? undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    if (!offRecord) {
      await saveMessage(chatId, { role: "user", content: displayText, timestamp: userMsg.timestamp });
    }

    await checkAndAward(user.uid, "hello_world");
    if (messages.length + 1 >= 500) await checkAndAward(user.uid, "power_user");


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
      const imageMimeType = imageToSend
        ? (imageToSend.match(/^data:(image\/\w+);base64,/)?.[1] ?? "image/jpeg")
        : undefined;
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
          localTime: new Date().toLocaleTimeString("en-US", {
            hour12: false, hour: "2-digit", minute: "2-digit",
          }),
          imageBase64,
          imageMimeType,
          fileText: fileToSend?.type === "text" ? fileToSend.text : undefined,
          fileName: fileToSend?.name,
          filePdfBase64: fileToSend?.type === "pdf" ? fileToSend.base64 : undefined,
          isFirstMessage,
          offRecord,
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
      tts.speakResponse(assistantMsg.content);
      if (!offRecord) {
        await saveMessage(chatId, {
          role: "assistant",
          content: assistantMsg.content,
          timestamp: assistantMsg.timestamp,
          ...(assistantMsg.actions ? { actions: assistantMsg.actions } : {}),
        });
      }
    } catch {
      toast.error("Failed to get response");
      setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
    } finally {
      setLoading(false);
      // Use a short delay so React's render cycle has time to re-enable the
      // textarea before focus() is called — 0ms loses the race.
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const skillResult = skills.onPickerKeyDown(e);
    if (skillResult === "consumed") return;
    if (skillResult && typeof skillResult === "object") { handleSelectSkill(skillResult); return; }
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
          {attachedFile && (
            <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-xl bg-white/5 border border-white/10 text-xs text-text-secondary">
              <RiAttachmentLine className="w-3.5 h-3.5 shrink-0 text-accent" />
              <span className="truncate flex-1">{attachedFile.name}</span>
              <button onClick={() => setAttachedFile(null)} className="shrink-0 text-text-muted hover:text-text-primary">
                <RiCloseLine className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {capturedImage && (
            <div className="relative inline-block mb-2 ml-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={capturedImage} alt="Captured" className="h-12 w-12 rounded-xl object-cover border-2 border-accent/30" />
              <button
                onClick={() => setCapturedImage(null)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-danger text-white flex items-center justify-center"
              >
                <RiCloseLine className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
          {skills.activeSkill && (
            <ActiveSkillBadge skill={skills.activeSkill} onDismiss={skills.dismissSkill} />
          )}
          <div className="relative flex items-end gap-2">
            <SkillPicker
              open={skills.pickerOpen}
              skills={skills.filteredSkills}
              highlightedIndex={skills.highlightedIndex}
              onSelect={handleSelectSkill}
              onClose={skills.closePicker}
            />
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                const val = e.target.value;
                skills.onInputChange(val);
                setInput(val);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={handleKeyDown}
              placeholder="Message Claude…"
              className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none focus:outline-none focus:ring-0 ring-0 resize-none leading-5"
              style={{ maxHeight: "120px" }}
            />
            <div className="flex items-center gap-1 shrink-0 pb-0.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.txt,.csv,.md,.json,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                title="Attach file"
                className="p-1.5 rounded-lg transition-colors text-text-secondary hover:text-text-primary hover:bg-white/10"
              >
                <RiAttachmentLine className="w-4 h-4" />
              </button>
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
                onClick={tts.toggle}
                className={`p-1.5 rounded-lg transition-colors ${
                  tts.enabled
                    ? "text-accent bg-accent/20"
                    : "text-text-secondary hover:text-text-primary hover:bg-white/10"
                }`}
                title={tts.enabled ? "Voice on — click to mute" : "Enable voice responses"}
              >
                {tts.enabled ? <RiVolumeUpLine className="w-4 h-4" /> : <RiVolumeMuteLine className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setOffRecord((v) => !v)}
                className={`p-1.5 rounded-lg transition-colors ${
                  offRecord
                    ? "text-amber-400 bg-amber-500/20"
                    : "text-text-secondary hover:text-text-primary hover:bg-white/10"
                }`}
                title={offRecord ? "Off the record — nothing saved. Click to exit." : "Go off the record"}
              >
                {offRecord ? <RiEyeOffLine className="w-4 h-4" /> : <RiEyeLine className="w-4 h-4" />}
              </button>
              <button
                onClick={() => sendMessage(input)}
                disabled={(!input.trim() && !capturedImage && !attachedFile) || loading}
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
