"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { format, parseISO } from "date-fns";
import {
  RiDiscordLine, RiSendPlaneLine, RiHashtag, RiRefreshLine,
} from "react-icons/ri";
import LoadingDots from "@/components/ui/LoadingDots";
import toast from "react-hot-toast";
interface Guild { id: string; name: string; icon: string | null }
interface Channel { id: string; name: string }
interface ChannelGroup { id: string; name: string; channels: Channel[] }
interface Message {
  id: string;
  content: string;
  timestamp: string;
  author: { id: string; username: string; avatar: string | null };
  attachments: { url: string; filename: string }[];
}

function Avatar({ author }: { author: Message["author"] }) {
  if (author.avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={author.avatar}
        alt={author.username}
        className="rounded-full shrink-0 w-9 h-9 object-cover"
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-[#5865F2]/20 text-[#5865F2] flex items-center justify-center text-xs font-semibold shrink-0">
      {author.username[0]?.toUpperCase()}
    </div>
  );
}

export default function DiscordView() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const [channelGroups, setChannelGroups] = useState<ChannelGroup[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingGuilds, setLoadingGuilds] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [configured, setConfigured] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load guilds on mount
  useEffect(() => {
    fetch("/api/discord/guilds")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setConfigured(false); return; }
        setGuilds(data);
        if (data.length > 0) setSelectedGuild(data[0]);
      })
      .catch(() => setConfigured(false))
      .finally(() => setLoadingGuilds(false));
  }, []);

  // Load channels when guild changes
  useEffect(() => {
    if (!selectedGuild) return;
    setLoadingChannels(true);
    setSelectedChannel(null);
    setMessages([]);
    fetch(`/api/discord/channels?guildId=${selectedGuild.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { toast.error(data.error); return; }
        setChannelGroups(data);
        // Auto-select first text channel
        const first = data[0]?.channels[0];
        if (first) setSelectedChannel(first);
      })
      .finally(() => setLoadingChannels(false));
  }, [selectedGuild]);

  // Load messages when channel changes
  const fetchMessages = useCallback(async (channelId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/discord/messages?channelId=${channelId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages([...data].reverse()); // Discord returns newest first
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedChannel) return;
    fetchMessages(selectedChannel.id);
  }, [selectedChannel, fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!selectedChannel || !input.trim() || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/discord/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: selectedChannel.id, content }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      // Refresh messages after sending
      await fetchMessages(selectedChannel.id);
    } catch {
      toast.error("Failed to send message");
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Not configured ──────────────────────────────────────────────────────────
  if (!configured) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#5865F2]/10 border border-[#5865F2]/20 flex items-center justify-center">
          <RiDiscordLine className="w-7 h-7 text-[#5865F2]" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-text-primary mb-1">Discord Not Connected</h2>
          <p className="text-sm text-text-secondary max-w-sm">
            Add your <code className="text-accent">DISCORD_BOT_TOKEN</code> to your environment variables to connect Discord.
          </p>
        </div>
      </div>
    );
  }

  if (loadingGuilds) {
    return <div className="flex justify-center py-20"><LoadingDots /></div>;
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* ── Left: Server + Channel list ─────────────────────────────────────── */}
      <div className="w-56 shrink-0 flex flex-col gap-3">
        {/* Server selector */}
        <div className="card p-2">
          <select
            value={selectedGuild?.id ?? ""}
            onChange={(e) => {
              const g = guilds.find((g) => g.id === e.target.value);
              if (g) setSelectedGuild(g);
            }}
            className="w-full bg-transparent text-sm text-text-primary focus:outline-none cursor-pointer"
          >
            {guilds.map((g) => (
              <option key={g.id} value={g.id} className="bg-bg-secondary">
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* Channel list */}
        <div className="card p-2 flex-1 overflow-y-auto space-y-3">
          {loadingChannels ? (
            <div className="flex justify-center py-4"><LoadingDots /></div>
          ) : (
            channelGroups.map((group) => (
              <div key={group.id}>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide px-2 mb-1">
                  {group.name}
                </p>
                {group.channels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedChannel(ch)}
                    className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm transition-colors text-left ${
                      selectedChannel?.id === ch.id
                        ? "bg-accent/15 text-accent"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
                    }`}
                  >
                    <RiHashtag className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{ch.name}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Right: Messages ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 card p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border shrink-0">
          <div className="flex items-center gap-2">
            <RiHashtag className="w-4 h-4 text-text-muted" />
            <span className="font-medium text-text-primary text-sm">
              {selectedChannel?.name ?? "Select a channel"}
            </span>
          </div>
          {selectedChannel && (
            <button
              onClick={() => fetchMessages(selectedChannel.id)}
              className="btn-ghost text-xs flex items-center gap-1.5"
            >
              <RiRefreshLine className="w-3.5 h-3.5" /> Refresh
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {loadingMessages ? (
            <div className="flex justify-center py-10"><LoadingDots /></div>
          ) : messages.length === 0 ? (
            <p className="text-center text-text-muted text-sm py-10">No messages yet.</p>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-3">
                <Avatar author={msg.author} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-text-primary">
                      {msg.author.username}
                    </span>
                    <span className="text-xs text-text-muted">
                      {format(parseISO(msg.timestamp), "MMM d, h:mm a")}
                    </span>
                  </div>
                  {msg.content && (
                    <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed mt-0.5">
                      {msg.content}
                    </p>
                  )}
                  {msg.attachments.map((a) => (
                    <a
                      key={a.url}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:underline block mt-1"
                    >
                      {a.filename}
                    </a>
                  ))}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Compose */}
        {selectedChannel && (
          <div className="px-4 py-3 border-t border-bg-border shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message #${selectedChannel.name}`}
                rows={1}
                className="flex-1 bg-bg-tertiary border border-bg-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
                style={{ minHeight: "38px", maxHeight: "120px" }}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                className="btn-primary p-2 shrink-0"
              >
                {sending ? <LoadingDots /> : <RiSendPlaneLine className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-text-muted mt-1.5">Enter to send · Shift+Enter for new line</p>
          </div>
        )}
      </div>
    </div>
  );
}
