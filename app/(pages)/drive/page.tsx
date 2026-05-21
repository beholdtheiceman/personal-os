"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "next/navigation";
import {
  RiSearchLine, RiFileLine, RiFileTextLine, RiFileExcel2Line,
  RiFilePpt2Line, RiFolder3Line, RiLink, RiCloudLine,
  RiRefreshLine, RiArrowLeftLine,
} from "react-icons/ri";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
}

const MIME_ICONS: Record<string, React.ElementType> = {
  "application/vnd.google-apps.document":     RiFileTextLine,
  "application/vnd.google-apps.spreadsheet":  RiFileExcel2Line,
  "application/vnd.google-apps.presentation": RiFilePpt2Line,
  "application/vnd.google-apps.folder":       RiFolder3Line,
};

const MIME_LABELS: Record<string, string> = {
  "application/vnd.google-apps.document":     "Google Doc",
  "application/vnd.google-apps.spreadsheet":  "Google Sheet",
  "application/vnd.google-apps.presentation": "Google Slides",
  "application/vnd.google-apps.folder":       "Folder",
  "text/plain":                                "Text",
  "application/json":                         "JSON",
};

function FileIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const Icon = MIME_ICONS[mimeType] ?? RiFileLine;
  return <Icon className={className} />;
}

function isReadable(mimeType: string) {
  return (
    mimeType in { "application/vnd.google-apps.document": 1, "application/vnd.google-apps.spreadsheet": 1, "application/vnd.google-apps.presentation": 1 } ||
    mimeType.startsWith("text/") ||
    mimeType === "application/json"
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DrivePage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const justConnected = searchParams.get("connected") === "true";
  const oauthError = searchParams.get("error");

  const [connected, setConnected] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const fetchFiles = useCallback(async (q = "", pageToken = "") => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ uid: user.uid });
      if (q) params.set("q", q);
      if (pageToken) params.set("pageToken", pageToken);
      const res = await fetch(`/api/drive/files?${params}`);
      const data = await res.json();
      if (data.connected === false && data.error) {
        toast.error(`Drive error: ${data.error}`);
      }
      setConnected(data.connected ?? false);
      if (pageToken) {
        setFiles((prev) => [...prev, ...(data.files ?? [])]);
      } else {
        setFiles(data.files ?? []);
      }
      setNextPageToken(data.nextPageToken ?? null);
    } catch (err) {
      console.error("Drive fetch error:", err);
      toast.error("Could not reach Drive API");
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    if (justConnected) toast.success("Google Drive connected!");
    if (oauthError) toast.error("Failed to connect Google Drive");
  }, [justConnected, oauthError]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setSelectedFile(null);
    setFileContent("");
    fetchFiles(searchInput);
  };

  const openFile = async (file: DriveFile) => {
    if (!user) return;
    if (!isReadable(file.mimeType)) {
      window.open(file.webViewLink, "_blank");
      return;
    }
    setSelectedFile(file);
    setFileContent("");
    setLoadingContent(true);
    try {
      const res = await fetch(`/api/drive/file?uid=${user.uid}&id=${file.id}`);
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        setFileContent("");
      } else {
        setFileContent(data.content ?? "");
      }
    } catch {
      toast.error("Failed to read file");
    } finally {
      setLoadingContent(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fileContent);
    toast.success("Copied to clipboard");
  };

  if (!connected && !loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-text-primary mb-1">Google Drive</h1>
          <p className="text-text-secondary text-sm">Browse and read your Drive files from anywhere, and pull them into chat context.</p>
        </div>
        <div className="card flex flex-col items-center py-16 text-center gap-4">
          <RiCloudLine className="w-12 h-12 text-text-muted" />
          <div>
            <p className="text-text-primary font-medium mb-1">Connect Google Drive</p>
            <p className="text-text-secondary text-sm">Read-only access — browse files, preview docs, and reference them in chat.</p>
          </div>
          <a
            href={`/api/drive/auth?uid=${user?.uid}`}
            className="btn-primary"
          >
            Connect Google Drive
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary mb-1">Google Drive</h1>
          <p className="text-text-secondary text-sm">Browse and read your files. Click any doc to preview its content.</p>
        </div>
        <button
          onClick={() => fetchFiles(search)}
          className="btn-ghost flex items-center gap-2 text-sm"
        >
          <RiRefreshLine className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="relative">
        <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          className="input-base w-full pl-9 pr-24"
          placeholder="Search files and documents…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary text-xs px-3 py-1.5">
          Search
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* File list */}
        <div className="card space-y-1 min-h-[300px]">
          {search && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-text-muted">Results for "{search}"</span>
              <button
                onClick={() => { setSearch(""); setSearchInput(""); fetchFiles(""); setSelectedFile(null); setFileContent(""); }}
                className="text-xs text-accent hover:text-accent/80"
              >
                Clear
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : files.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-12">
              {search ? "No files found." : "No files found in your Drive."}
            </p>
          ) : (
            <>
              {files.map((file) => (
                <button
                  key={file.id}
                  onClick={() => openFile(file)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    selectedFile?.id === file.id
                      ? "bg-accent/15 border border-accent/30"
                      : "hover:bg-white/[0.06]"
                  }`}
                >
                  <FileIcon mimeType={file.mimeType} className="w-5 h-5 text-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{file.name}</p>
                    <p className="text-xs text-text-muted">
                      {MIME_LABELS[file.mimeType] ?? file.mimeType.split("/").pop()} · {formatDate(file.modifiedTime)}
                    </p>
                  </div>
                  {file.webViewLink && !isReadable(file.mimeType) && (
                    <RiLink className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  )}
                </button>
              ))}
              {nextPageToken && (
                <button
                  onClick={() => fetchFiles(search, nextPageToken)}
                  className="w-full text-xs text-accent hover:text-accent/80 py-2 text-center"
                >
                  Load more
                </button>
              )}
            </>
          )}
        </div>

        {/* File content preview */}
        <div className="card min-h-[300px]">
          {!selectedFile ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <RiFileTextLine className="w-10 h-10 text-text-muted mb-3" />
              <p className="text-sm text-text-secondary">Select a file to preview its content</p>
              <p className="text-xs text-text-muted mt-1">Google Docs, Sheets, Slides, and text files are supported</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => { setSelectedFile(null); setFileContent(""); }}
                    className="p-1 rounded-lg hover:bg-white/10 text-text-muted transition-colors shrink-0"
                  >
                    <RiArrowLeftLine className="w-4 h-4" />
                  </button>
                  <p className="text-sm font-semibold text-text-primary truncate">{selectedFile.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {fileContent && (
                    <button onClick={copyToClipboard} className="btn-ghost text-xs px-2 py-1">
                      Copy
                    </button>
                  )}
                  {selectedFile.webViewLink && (
                    <a
                      href={selectedFile.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost text-xs px-2 py-1 flex items-center gap-1"
                    >
                      Open <RiLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {loadingContent ? (
                <div className="flex justify-center py-12">
                  <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              ) : fileContent ? (
                <div
                  className="text-xs text-text-secondary font-mono leading-relaxed overflow-y-auto max-h-[60vh] whitespace-pre-wrap break-words rounded-lg p-3"
                  style={{ background: "rgba(0,0,0,0.20)" }}
                >
                  {fileContent}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
