"use client";
import { useState, useEffect } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { RiMusicLine, RiPlayLine, RiDeleteBinLine, RiAddLine } from "react-icons/ri";
import LoadingDots from "@/components/ui/LoadingDots";
import toast from "react-hot-toast";

interface Track {
  id: string;
  title: string;
  url: string;
}

export default function SunoTab() {
  const { user } = useAuth();
  const { play, currentTrack, isPlaying } = usePlayer();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

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

  const addTrack = async () => {
    if (!col || !title.trim() || !url.trim()) return;
    if (!url.startsWith("http")) { toast.error("Enter a valid URL"); return; }
    setSaving(true);
    try {
      const docRef = await addDoc(col, { title: title.trim(), url: url.trim(), createdAt: serverTimestamp() });
      setTracks((prev) => [{ id: docRef.id, title: title.trim(), url: url.trim() }, ...prev]);
      setTitle("");
      setUrl("");
      toast.success("Track added");
    } catch {
      toast.error("Failed to save track");
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

  return (
    <div className="space-y-4">
      {/* Add track form */}
      <div className="space-y-2 p-4 bg-bg-tertiary rounded-xl border border-bg-border">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Add a Suno Track</p>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Track title"
          className="w-full bg-bg-secondary border border-bg-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Suno share link (suno.com/s/...) or direct MP3 URL"
          className="w-full bg-bg-secondary border border-bg-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <button
          onClick={addTrack}
          disabled={saving || !title.trim() || !url.trim()}
          className="btn-primary flex items-center gap-1.5 text-sm"
        >
          {saving ? <LoadingDots /> : <><RiAddLine className="w-4 h-4" /> Add Track</>}
        </button>
      </div>

      {/* Track list */}
      {loading ? (
        <div className="flex justify-center py-8"><LoadingDots /></div>
      ) : tracks.length === 0 ? (
        <div className="flex flex-col items-center py-8 gap-2 text-text-muted">
          <RiMusicLine className="w-8 h-8 opacity-40" />
          <p className="text-sm">No tracks yet — add one above</p>
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
