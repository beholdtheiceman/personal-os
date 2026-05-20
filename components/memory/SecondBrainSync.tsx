"use client";
import { useState, useEffect, useRef } from "react";
import { collection, onSnapshot, query, orderBy, limit, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getIdToken } from "firebase/auth";
import { RiFolderOpenLine, RiRefreshLine, RiFileTextLine, RiCheckLine, RiTimeLine } from "react-icons/ri";
import toast from "react-hot-toast";

interface SyncedFile {
  id: string;
  path: string;
  filename: string;
  content: string;
  syncedAt: string;
}

export default function SecondBrainSync() {
  const { user } = useAuth();
  const [files, setFiles] = useState<SyncedFile[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, `users/${user.uid}/second_brain`),
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SyncedFile));
        setFiles(docs);
        if (docs.length > 0) {
          const latest = docs.reduce((a, b) => (a.syncedAt > b.syncedAt ? a : b));
          setLastSync(latest.syncedAt);
        }
        setLoaded(true);
      }
    );
    return unsub;
  }, [user]);

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setSyncing(true);
    try {
      const mdFiles: { path: string; content: string }[] = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (!file.name.endsWith(".md")) continue;

        const content = await file.text();
        // webkitRelativePath gives "FolderName/subdir/file.md" — strip the root folder name
        const parts = file.webkitRelativePath.split("/");
        const relativePath = parts.slice(1).join("/"); // remove the root "SecondBrain/" prefix
        mdFiles.push({ path: relativePath || file.name, content });
      }

      if (mdFiles.length === 0) {
        toast.error("No .md files found in selected folder");
        return;
      }

      const token = await getIdToken(user!);
      const res = await fetch("/api/second-brain/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ files: mdFiles }),
      });

      if (!res.ok) throw new Error("Sync failed");
      const { synced } = await res.json();
      toast.success(`Synced ${synced} files to your Personal OS`);
    } catch {
      toast.error("Failed to sync Second Brain");
    } finally {
      setSyncing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  // Group files by top-level folder
  const grouped: Record<string, SyncedFile[]> = {};
  for (const f of files) {
    const parts = f.path.split("/");
    const group = parts.length > 1 ? parts[0] : "Root";
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(f);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Second Brain Sync</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Upload your Second Brain folder to inject it into every chat as context.
          </p>
          {lastSync && (
            <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
              <RiTimeLine className="w-3 h-3" />
              Last synced {fmt(lastSync)} · {files.length} files
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {files.length > 0 && (
            <button
              onClick={() => inputRef.current?.click()}
              disabled={syncing}
              className="btn-ghost flex items-center gap-2 text-sm"
            >
              <RiRefreshLine className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              Re-sync
            </button>
          )}
          <button
            onClick={() => inputRef.current?.click()}
            disabled={syncing}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <RiFolderOpenLine className="w-4 h-4" />
            {files.length === 0 ? "Select Folder" : "Upload Again"}
          </button>
        </div>
      </div>

      {/* Hidden folder input */}
      <input
        ref={inputRef}
        type="file"
        // @ts-expect-error webkitdirectory is non-standard
        webkitdirectory=""
        multiple
        accept=".md"
        className="hidden"
        onChange={handleFolderSelect}
      />

      {/* Synced files */}
      {!loaded ? null : files.length === 0 ? (
        <div className="card flex flex-col items-center py-12 text-center">
          <RiFolderOpenLine className="w-10 h-10 text-text-muted mb-3" />
          <p className="text-sm text-text-secondary mb-1">No Second Brain synced yet</p>
          <p className="text-xs text-text-muted mb-4">
            Select your Second Brain folder and all .md files will be stored and injected into chat context
          </p>
          <button
            onClick={() => inputRef.current?.click()}
            className="btn-primary text-sm"
          >
            Select Folder
          </button>
        </div>
      ) : (
        <div className="card space-y-3">
          {Object.entries(grouped).sort(([a], [b]) => a === "Root" ? -1 : b === "Root" ? 1 : a.localeCompare(b)).map(([group, groupFiles]) => (
            <div key={group}>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">{group}</p>
              <div className="space-y-1">
                {groupFiles.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 py-1">
                    <RiFileTextLine className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span className="text-xs text-text-secondary truncate flex-1">{f.path}</span>
                    <span className="text-xs text-text-muted shrink-0">{(f.content.length / 1000).toFixed(1)}k</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-success bg-success/10 px-3 py-2 rounded-lg">
          <RiCheckLine className="w-3.5 h-3.5 shrink-0" />
          Second Brain is active — all chat conversations include this context
        </div>
      )}
    </div>
  );
}
