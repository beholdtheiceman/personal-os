"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import {
  RiMailLine, RiLinkM, RiRefreshLine, RiArrowLeftLine,
  RiArchiveLine, RiDeleteBinLine, RiMailOpenLine, RiMailUnreadLine,
  RiSendPlaneLine, RiCloseLine, RiReplyLine,
} from "react-icons/ri";
import LoadingDots from "@/components/ui/LoadingDots";
import toast from "react-hot-toast";

interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  fromEmail: string;
  date: string;
  snippet: string;
  read: boolean;
  labels: string[];
}

interface GmailBody {
  id: string;
  threadId: string;
  messageId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
}

function formatDate(raw: string) {
  try {
    const d = new Date(raw);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return format(d, "h:mm a");
    return format(d, "MMM d");
  } catch {
    return raw;
  }
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function GmailView() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<GmailMessage | null>(null);
  const [body, setBody] = useState<GmailBody | null>(null);
  const [loadingBody, setLoadingBody] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/gmail/messages?uid=${user.uid}&max=50`);
      const data = await res.json();
      setConnected(data.connected);
      setMessages(data.messages ?? []);
    } catch {
      toast.error("Failed to load Gmail");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const openMessage = async (msg: GmailMessage) => {
    setSelected(msg);
    setBody(null);
    setReplyOpen(false);
    setReplyText("");
    setLoadingBody(true);
    try {
      const res = await fetch(`/api/gmail/message?uid=${user!.uid}&id=${msg.id}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setBody(data);
      setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, read: true } : m));
    } catch {
      toast.error("Failed to load email");
    } finally {
      setLoadingBody(false);
    }
  };

  const doAction = async (action: "archive" | "trash" | "mark_read" | "mark_unread") => {
    if (!selected || !user) return;
    setActioning(action);
    try {
      const res = await fetch("/api/gmail/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, id: selected.id, action }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      if (action === "archive" || action === "trash") {
        setMessages((prev) => prev.filter((m) => m.id !== selected.id));
        setSelected(null);
        setBody(null);
        toast.success(action === "archive" ? "Archived" : "Moved to trash");
      } else {
        const read = action === "mark_read";
        setMessages((prev) => prev.map((m) => m.id === selected.id ? { ...m, read } : m));
        setSelected((prev) => prev ? { ...prev, read } : null);
        toast.success(read ? "Marked as read" : "Marked as unread");
      }
    } catch {
      toast.error("Action failed");
    } finally {
      setActioning(null);
    }
  };

  const sendReply = async () => {
    if (!body || !user || !replyText.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/gmail/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user.uid,
          threadId: body.threadId,
          messageId: body.messageId,
          to: body.from,
          subject: body.subject,
          body: replyText,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setReplyOpen(false);
      setReplyText("");
      toast.success("Reply sent");
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const unreadCount = messages.filter((m) => !m.read).length;

  // ── Not connected ──────────────────────────────────────────────────────────
  if (connected === false) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
          <RiMailLine className="w-7 h-7 text-accent" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-text-primary mb-1">Connect Gmail</h2>
          <p className="text-sm text-text-secondary">Read, reply, archive, and manage your inbox from Personal OS.</p>
        </div>
        <a href={`/api/gmail/auth?uid=${user?.uid}`} className="btn-primary flex items-center gap-2">
          <RiLinkM className="w-4 h-4" /> Connect Gmail
        </a>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-20"><LoadingDots /></div>;
  }

  // ── Email detail view ──────────────────────────────────────────────────────
  if (selected) {
    const isRead = selected.read;
    return (
      <div className="max-w-3xl mx-auto space-y-3">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setSelected(null); setBody(null); setReplyOpen(false); }}
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
          >
            <RiArrowLeftLine className="w-4 h-4" /> Back
          </button>

          <div className="flex-1" />

          <button
            onClick={() => doAction("archive")}
            disabled={!!actioning}
            className="btn-ghost text-sm flex items-center gap-1.5"
            title="Archive"
          >
            {actioning === "archive" ? <LoadingDots /> : <><RiArchiveLine className="w-4 h-4" /> Archive</>}
          </button>
          <button
            onClick={() => doAction("trash")}
            disabled={!!actioning}
            className="btn-ghost text-sm flex items-center gap-1.5 hover:text-danger"
            title="Delete"
          >
            {actioning === "trash" ? <LoadingDots /> : <><RiDeleteBinLine className="w-4 h-4" /> Delete</>}
          </button>
          <button
            onClick={() => doAction(isRead ? "mark_unread" : "mark_read")}
            disabled={!!actioning}
            className="btn-ghost text-sm flex items-center gap-1.5"
            title={isRead ? "Mark unread" : "Mark read"}
          >
            {actioning === "mark_read" || actioning === "mark_unread" ? (
              <LoadingDots />
            ) : isRead ? (
              <><RiMailUnreadLine className="w-4 h-4" /> Unread</>
            ) : (
              <><RiMailOpenLine className="w-4 h-4" /> Read</>
            )}
          </button>
          <button
            onClick={() => setReplyOpen((v) => !v)}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <RiReplyLine className="w-4 h-4" /> Reply
          </button>
        </div>

        {/* Email content */}
        <div className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary leading-snug">
              {selected.subject || "(no subject)"}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-text-secondary">
              <span className="font-medium text-text-primary">{selected.from}</span>
              <span className="text-text-muted">&lt;{selected.fromEmail}&gt;</span>
              <span className="text-text-muted">{formatDate(selected.date)}</span>
            </div>
            {body?.to && (
              <p className="text-xs text-text-muted mt-1">To: {body.to}</p>
            )}
          </div>

          <div className="border-t border-bg-border pt-4">
            {loadingBody ? (
              <div className="flex justify-center py-10"><LoadingDots /></div>
            ) : body ? (
              <div className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                {body.body || "(no content)"}
              </div>
            ) : null}
          </div>
        </div>

        {/* Reply composer */}
        {replyOpen && (
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text-primary">
                Reply to {selected.from}
              </p>
              <button
                onClick={() => { setReplyOpen(false); setReplyText(""); }}
                className="text-text-muted hover:text-text-primary"
              >
                <RiCloseLine className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write your reply..."
              rows={6}
              className="w-full bg-bg-tertiary border border-bg-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setReplyOpen(false); setReplyText(""); }}
                className="btn-ghost text-sm"
              >
                Cancel
              </button>
              <button
                onClick={sendReply}
                disabled={sending || !replyText.trim()}
                className="btn-primary text-sm flex items-center gap-2"
              >
                {sending ? <LoadingDots /> : <><RiSendPlaneLine className="w-4 h-4" /> Send</>}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Inbox list ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-text-primary">Inbox</h1>
          {unreadCount > 0 && (
            <span className="text-xs font-semibold bg-accent/15 text-accent px-2 py-0.5 rounded-full">
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setRefreshing(true); fetchMessages(); }}
            disabled={refreshing}
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            {refreshing ? <LoadingDots /> : <><RiRefreshLine className="w-4 h-4" /> Refresh</>}
          </button>
          <a
            href={`/api/gmail/auth?uid=${user?.uid}`}
            className="btn-ghost text-sm flex items-center gap-1.5"
            title="Reconnect Gmail"
          >
            <RiLinkM className="w-4 h-4" /> Reconnect
          </a>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="card text-center py-12 text-text-muted text-sm">Your inbox is empty.</div>
      ) : (
        <div className="card p-0 overflow-hidden divide-y divide-bg-border">
          {messages.map((msg) => (
            <button
              key={msg.id}
              onClick={() => openMessage(msg)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-bg-tertiary transition-colors ${
                !msg.read ? "bg-accent/[0.03]" : ""
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold mt-0.5 ${
                !msg.read ? "bg-accent/20 text-accent" : "bg-bg-tertiary text-text-secondary"
              }`}>
                {getInitials(msg.from) || <RiMailLine className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`text-sm truncate ${!msg.read ? "font-semibold text-text-primary" : "text-text-primary"}`}>
                    {msg.from}
                  </span>
                  <span className="text-xs text-text-muted shrink-0">{formatDate(msg.date)}</span>
                </div>
                <p className={`text-sm truncate ${!msg.read ? "font-medium text-text-primary" : "text-text-secondary"}`}>
                  {msg.subject || "(no subject)"}
                </p>
                <p className="text-xs text-text-muted truncate mt-0.5">{msg.snippet}</p>
              </div>
              {!msg.read && <div className="w-2 h-2 rounded-full bg-accent shrink-0 mt-2" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
