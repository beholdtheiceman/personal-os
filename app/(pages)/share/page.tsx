"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  RiBookLine, RiBrainLine, RiCheckboxLine, RiChat1Line,
  RiCheckLine, RiExternalLinkLine, RiShare2Line,
} from "react-icons/ri";
import Link from "next/link";

type Destination = "reading_list" | "second_brain" | "task" | "chat";
type SaveState = "idle" | "saving" | "done";

function SharePageInner() {
  const { user } = useAuth();
  const params = useSearchParams();

  const url   = params.get("url")   ?? "";
  const title = params.get("title") ?? "";
  const text  = params.get("text")  ?? "";

  const displayTitle = title || text.slice(0, 80) || url || "Untitled";
  const displayUrl   = url || "";

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedTo, setSavedTo]     = useState<string>("");

  const capture = async (dest: Destination) => {
    if (!user || saveState === "saving") return;
    setSaveState("saving");
    const now = new Date().toISOString();

    try {
      switch (dest) {
        case "reading_list":
          await addDoc(collection(db, "users", user.uid, "books"), {
            title: displayTitle,
            author: "",
            status: "want_to_read",
            highlights: [],
            tags: url ? ["web"] : [],
            source_url: url,
            created_at: now,
          });
          setSavedTo("Reading List");
          break;

        case "second_brain":
          await addDoc(collection(db, "users", user.uid, "inbox"), {
            content: [title, url, text].filter(Boolean).join("\n"),
            source_url: url,
            source: "share",
            created_at: now,
          });
          setSavedTo("Second Brain inbox");
          break;

        case "task":
          await addDoc(collection(db, "users", user.uid, "tasks"), {
            title: displayTitle.slice(0, 200),
            description: url,
            status: "active",
            priority_score: 50,
            tags: [],
            due_date: null,
            source: "manual",
            created_at: now,
          });
          setSavedTo("Tasks");
          break;

        case "chat": {
          const chatText = [title && `"${title}"`, url].filter(Boolean).join(" — ");
          window.location.href = `/chat?prefill=${encodeURIComponent(chatText)}`;
          return;
        }
      }

      setSaveState("done");
    } catch (err) {
      console.error("Share capture failed:", err);
      setSaveState("idle");
    }
  };

  const actions: { dest: Destination; icon: React.ReactNode; label: string; description: string }[] = [
    {
      dest: "reading_list",
      icon: <RiBookLine className="w-5 h-5" />,
      label: "Reading List",
      description: "Save to want-to-read",
    },
    {
      dest: "second_brain",
      icon: <RiBrainLine className="w-5 h-5" />,
      label: "Second Brain",
      description: "Drop into inbox",
    },
    {
      dest: "task",
      icon: <RiCheckboxLine className="w-5 h-5" />,
      label: "New Task",
      description: "Add to task list",
    },
    {
      dest: "chat",
      icon: <RiChat1Line className="w-5 h-5" />,
      label: "Send to Chat",
      description: "Open with Claude",
    },
  ];

  return (
    <div className="max-w-sm mx-auto py-6 space-y-5">
      <div className="flex items-center gap-2">
        <RiShare2Line className="w-5 h-5 text-accent" />
        <h1 className="text-lg font-semibold text-text-primary">Quick Capture</h1>
      </div>

      {/* Preview card */}
      <div className="card border-accent/20 bg-accent/5 space-y-1.5">
        <p className="text-sm font-medium text-text-primary line-clamp-2">{displayTitle}</p>
        {displayUrl && (
          <a
            href={displayUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-accent hover:text-accent-text truncate"
          >
            <RiExternalLinkLine className="w-3 h-3 shrink-0" />
            <span className="truncate">{displayUrl}</span>
          </a>
        )}
        {text && !url && (
          <p className="text-xs text-text-muted line-clamp-3">{text}</p>
        )}
      </div>

      {saveState === "done" ? (
        /* Success state */
        <div className="card border-success/20 bg-success/5 text-center space-y-4 py-6">
          <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center mx-auto">
            <RiCheckLine className="w-6 h-6 text-success" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Saved to {savedTo}</p>
            <p className="text-xs text-text-muted mt-1">You can close this window</p>
          </div>
          <div className="flex gap-2 justify-center">
            <Link href="/dashboard" className="btn-primary text-sm px-4">
              Dashboard
            </Link>
            <button
              onClick={() => { setSaveState("idle"); setSavedTo(""); }}
              className="text-sm text-text-muted hover:text-text-primary px-4 py-2 rounded-lg transition-colors"
            >
              Capture again
            </button>
          </div>
        </div>
      ) : (
        /* Action buttons */
        <div className="space-y-2">
          <p className="text-xs text-text-muted px-1">Where do you want to send this?</p>
          {actions.map(({ dest, icon, label, description }) => (
            <button
              key={dest}
              onClick={() => capture(dest)}
              disabled={saveState === "saving"}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-bg-border hover:border-accent/40 hover:bg-accent/5 bg-bg-secondary/50 transition-all disabled:opacity-50 text-left group"
            >
              <div className="p-2 rounded-lg bg-accent/10 text-accent group-hover:bg-accent/20 transition-colors shrink-0">
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{label}</p>
                <p className="text-xs text-text-muted">{description}</p>
              </div>
              {saveState === "saving" && (
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}

      <Link
        href="/dashboard"
        className="block text-center text-xs text-text-muted hover:text-text-primary transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SharePageInner />
    </Suspense>
  );
}
