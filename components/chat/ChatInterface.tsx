"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, addDoc, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchMemoryEntries, buildSystemPrompt, buildMemoryContext } from "@/lib/memory";
import ReactMarkdown from "react-markdown";
import LoadingDots from "@/components/ui/LoadingDots";
import CameraCapture from "./CameraCapture";
import { RiSendPlane2Line, RiMicLine, RiMicOffLine, RiCheckLine, RiCameraLine, RiCloseLine } from "react-icons/ri";
import toast from "react-hot-toast";
import type { ChatMessage } from "@/types";
import { format } from "date-fns";

interface AssistantMessage extends ChatMessage {
  actions?: string[];
  image?: string; // base64 data URL for display only (not persisted)
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

export default function ChatInterface() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const q = query(
        collection(db, "users", user.uid, "chat_history"),
        orderBy("timestamp", "desc"),
        limit(50)
      );
      const snap = await getDocs(q);
      const history = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AssistantMessage)).reverse();
      setMessages(history);

      const memory = await fetchMemoryEntries(user.uid);
      const memCtx = buildMemoryContext(memory);
      const prompt = buildSystemPrompt(memCtx, user.displayName ?? "User", {
        date: new Date().toDateString(),
      });
      setSystemPrompt(prompt);
    })();
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveMessage = async (msg: Omit<AssistantMessage, "id" | "image">) => {
    if (!user) return;
    const ref = await addDoc(collection(db, "users", user.uid, "chat_history"), msg);
    return ref.id;
  };

  const sendMessage = async (text: string) => {
    if ((!text.trim() && !capturedImage) || !user || loading) return;

    const displayText = text.trim() || (capturedImage ? "What's in this image?" : "");
    const imageToSend = capturedImage;

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

    await saveMessage({ role: "user", content: userMsg.content, timestamp: userMsg.timestamp });

    // Build conversation history (last 20 turns, text only for history)
    const history = [...messages.slice(-19), userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Placeholder while Claude thinks
    const placeholderId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, {
      id: placeholderId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    }]);

    try {
      const idToken = await user.getIdToken();

      // Strip the data URL prefix for the API (e.g. "data:image/jpeg;base64,")
      const imageBase64 = imageToSend
        ? imageToSend.replace(/^data:image\/\w+;base64,/, "")
        : undefined;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          messages: history,
          systemPrompt,
          uid: user.uid,
          localDate: format(new Date(), "yyyy-MM-dd"),
          imageBase64,
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

      await saveMessage({
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
    }
  };

  // ── Web Speech API voice input ────────────────────────────────────────────
  const startRecording = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

    if (!SR) {
      toast.error("Speech recognition isn't supported in this browser. Try Chrome.");
      return;
    }

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      const messages: Record<string, string> = {
        "not-allowed":         "Microphone permission denied — check browser settings",
        "no-speech":           "No speech detected — try again",
        "network":             "Network error — speech recognition requires internet",
        "service-not-allowed": "Speech service blocked — try on HTTPS",
        "audio-capture":       "No microphone found",
      };
      toast.error(messages[e.error] ?? `Speech error: ${e.error}`);
      setRecording(false);
    };

    recognition.onend = () => setRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-16 text-text-secondary">
            <p className="text-lg font-medium text-text-primary mb-2">
              Hey {user?.displayName?.split(" ")[0] ?? "there"} 👋
            </p>
            <p className="text-sm mb-1">Ask me anything. I have your full context loaded.</p>
            <p className="text-xs text-text-muted">I can also add tasks, schedule events, log health, set goals, and track expenses.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] md:max-w-[70%] min-w-0 rounded-2xl px-4 py-3 overflow-hidden ${
              msg.role === "user"
                ? "bg-accent text-white rounded-tr-sm"
                : "bg-bg-secondary border border-bg-border rounded-tl-sm"
            }`}>
              {/* Image attachment */}
              {msg.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={msg.image}
                  alt="Attached"
                  className="rounded-xl mb-2 max-w-full max-h-48 object-cover"
                />
              )}

              {msg.role === "assistant" ? (
                msg.content ? (
                  <>
                    <div className="prose-dark text-sm break-words min-w-0">
                      <ReactMarkdown
                        components={{
                          a: ({ href, children }) => {
                            // If the visible text is just the raw URL, shorten it for readability
                            const text = String(children);
                            const isRawUrl = text.startsWith("http://") || text.startsWith("https://");
                            const label = isRawUrl
                              ? (() => { try { return new URL(text).hostname; } catch { return text.slice(0, 40) + "…"; } })()
                              : children;
                            return (
                              <a href={href} target="_blank" rel="noopener noreferrer" title={href}>
                                {label}
                              </a>
                            );
                          },
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    {msg.actions?.length ? (
                      <ActionsLog actions={msg.actions} />
                    ) : null}
                  </>
                ) : (
                  <LoadingDots />
                )
              ) : (
                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
              )}
              <p className={`text-[10px] mt-1.5 ${msg.role === "user" ? "text-white/60 text-right" : "text-text-muted"}`}>
                {format(new Date(msg.timestamp), "HH:mm")}
              </p>
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-bg-border bg-bg-secondary px-4 py-3">
        {/* Image preview */}
        {capturedImage && (
          <div className="relative inline-block mb-2 ml-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capturedImage}
              alt="Captured"
              className="h-16 w-16 rounded-xl object-cover border-2 border-accent/30"
            />
            <button
              onClick={() => setCapturedImage(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-danger text-white flex items-center justify-center"
            >
              <RiCloseLine className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 max-w-4xl mx-auto">
          <textarea
            className="input-base flex-1 resize-none min-h-[44px] max-h-40 py-2.5 text-sm"
            placeholder={capturedImage ? "Ask about this image… (or send as-is)" : "Message your AI assistant…"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            disabled={loading}
            rows={1}
          />

          {/* Camera */}
          <button
            onClick={() => setShowCamera(true)}
            disabled={loading}
            className="p-2.5 rounded-lg border transition-colors bg-bg-tertiary text-text-secondary hover:text-text-primary border-bg-border"
            title="Attach photo"
          >
            <RiCameraLine className="w-5 h-5" />
          </button>

          {/* Mic */}
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={loading}
            className={`p-2.5 rounded-lg border transition-colors ${
              recording
                ? "bg-danger/20 text-danger border-danger/30 animate-pulse"
                : "bg-bg-tertiary text-text-secondary hover:text-text-primary border-bg-border"
            }`}
          >
            {recording ? <RiMicOffLine className="w-5 h-5" /> : <RiMicLine className="w-5 h-5" />}
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
          Shift+Enter for new line · Enter to send
        </p>
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
