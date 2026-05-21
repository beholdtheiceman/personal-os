"use client";
import { useState, useEffect, useRef } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import {
  RiMusicLine, RiPlayLine, RiDeleteBinLine, RiAddLine,
  RiUploadLine, RiLinkM, RiCheckLine,
} from "react-icons/ri";
import LoadingDots from "@/components/ui/LoadingDots";
import toast from "react-hot-toast";
import { getIdToken } from "firebase/auth";

interface Track {
  id: string;
  title: string;
  url: string;
}

type AddMode = "url" | "upload";

export default function SunoTab() {
  const { user } = useAuth();
  const { play, currentTrack, isPlaying } = usePlayer();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMode, setAddMode] = useState<AddMode>("upload");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const col = user ? collection(db, "users", user.uid, "sunoTracks") : null;

  const loadTracks = async () => {
    if (!col) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(col, orderBy("createdAt", "desc")));
      setTracks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as { title: string; url: string }) })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    // Auto-fill title from filename if empty
    if (f && !title.trim()) {
      setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "));
    }
  };

  const addTrack = async () => {
    if (!col || !user || !title.trim()) return;

    setSaving(true);
    try {
      let trackUrl = url.trim();

      if (addMode === "upload") {
        if (!file) { toast.error("Choose a file to upload"); setSaving(false); return; }
        setUploadProgress("Uploading…");
        const idToken = await getIdToken(user);
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/media/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        trackUrl = data.url as string;
        setUploadProgress(null);
      } else {
        if (!trackUrl.startsWith("http")) { toast.error("Enter a valid URL"); setSaving(false); return; }
      }

      const docRef = await addDoc(col, {
        title: title.trim(),
        url: trackUrl,
        createdAt: serverTimestamp(),
      });
      setTracks((prev) => [{ id: docRef.id, title: title.trim(), url: trackUrl }, ...prev]);
      setTitle("");
      setUrl("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Track added");
    } catch (err) {
      setUploadProgress(null);
      toast.error(err instanceof Error ? err.message : "Failed to save track");
    } finally {
      setSaving(false);
    }
  };

  const deleteTrack = async (id: string) => {
    if (!col) return;
    try {
      await deleteDoc(doc(col, id));
      setTracks((prev) => prev.filter((t) => t.id !== id));
    } catch {
      toast.error("Delete failed");
    }
  };

  const isActive = (trackUrl: string) => currentTrack?.type === "suno" && currentTrack.url === trackUrl;

  const canSave = !!title.trim() && (addMode === "upload" ? !!file : !!url.trim());

  return (
    <div className="space-y-4">
      {/* Add track form */}
      <div className="space-y-3 p-4 bg-bg-tertiary rounded-xl border border-bg-border">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Add a Suno Track</p>
          {/* Mode toggle */}
          <div className="flex items-center gap-0.5 bg-bg-secondary rounded-lg p-0.5 border border-bg-border">
            <button
              onClick={() => setAddMode("upload")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                addMode === "upload" ? "bg-accent text-white" : "text-text-muted hover:text-text-primary"
              }`}
            >
              <RiUploadLine className="w-3.5 h-3.5" /> Upload MP3
            </button>
            <button
              onClick={() => setAddMode("url")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                addMode === "url" ? "bg-accent text-white" : "text-text-muted hover:text-text-primary"
              }`}
            >
              <RiLinkM className="w-3.5 h-3.5" /> URL
            </button>
          </div>
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Track title"
          className="w-full bg-bg-secondary border border-bg-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />

        {addMode === "upload" ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`w-full flex items-center gap-3 border-2 border-dashed rounded-lg px-3 py-3 cursor-pointer transition-colors ${
              file ? "border-accent/50 bg-accent/5" : "border-bg-border hover:border-accent/40 hover:bg-accent/5"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <>
                <RiCheckLine className="w-4 h-4 text-accent shrink-0" />
                <span className="text-sm text-text-primary truncate">{file.name}</span>
                <span className="text-xs text-text-muted shrink-0 ml-auto">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              </>
            ) : (
              <>
                <RiUploadLine className="w-4 h-4 text-text-muted shrink-0" />
                <span className="text-sm text-text-muted">Click to choose an MP3 file</span>
              </>
            )}
          </div>
        ) : (
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Direct MP3 URL"
            className="w-full bg-bg-secondary border border-bg-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        )}

        <button
          onClick={addTrack}
          disabled={saving || !canSave}
          className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <><LoadingDots /> {uploadProgress ?? "Saving…"}</>
          ) : (
            <><RiAddLine className="w-4 h-4" /> Add Track</>
          )}
        </button>
      </div>

      {/* Track list */}
      {loading ? (
        <div className="flex justify-center py-8"><LoadingDots /></div>
      ) : tracks.length === 0 ? (
        <div className="flex flex-col items-center py-8 gap-2 text-text-muted">
          <RiMusicLine className="w-8 h-8 opacity-40" />
          <p className="text-sm">No tracks yet — upload an MP3 above</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {tracks.map((track) => {
            const active = isActive(track.url);
            return (
              <div
                key={track.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  active ? "border-accent/40 bg-accent/10" : "border-bg-border hover:bg-bg-tertiary"
                }`}
              >
                <button
                  onClick={() => play({ type: "suno", url: track.url, title: track.title })}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    active ? "bg-accent text-white" : "bg-accent/15 text-accent"
                  }`}>
                    {active && isPlaying ? (
                      <span className="flex gap-0.5 items-end h-4">
                        {[1, 2, 3].map((i) => (
                          <span
                            key={i}
                            className="w-0.5 bg-white rounded-full animate-bounce"
                            style={{ height: `${8 + i * 3}px`, animationDelay: `${i * 0.1}s` }}
                          />
                        ))}
                      </span>
                    ) : (
                      <RiPlayLine className="w-4 h-4" />
                    )}
                  </div>
                  <p className={`text-sm font-medium truncate ${active ? "text-accent" : "text-text-primary"}`}>
                    {track.title}
                  </p>
                </button>
                <button
                  onClick={() => deleteTrack(track.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-danger/10 hover:text-danger text-text-muted transition-colors shrink-0"
                  aria-label="Delete"
                >
                  <RiDeleteBinLine className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
