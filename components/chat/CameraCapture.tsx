"use client";
import { useEffect, useRef, useState } from "react";
import { RiCameraLine, RiRefreshLine, RiCloseLine, RiCheckLine } from "react-icons/ri";

interface Props {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  const startCamera = async (mode: "user" | "environment") => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setError(null);
    } catch {
      setError("Camera access denied — check browser permissions.");
    }
  };

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flipCamera = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    setPreview(null);
    startCamera(next);
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPreview(dataUrl);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  const retake = () => {
    setPreview(null);
    startCamera(facingMode);
  };

  const confirm = () => {
    if (preview) {
      onCapture(preview);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden bg-black">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        >
          <RiCloseLine className="w-5 h-5" />
        </button>

        {/* Flip camera */}
        {!preview && (
          <button
            onClick={flipCamera}
            className="absolute top-3 left-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <RiRefreshLine className="w-5 h-5" />
          </button>
        )}

        {/* Video / Preview */}
        {error ? (
          <div className="flex items-center justify-center h-64 text-white/60 text-sm px-6 text-center">
            {error}
          </div>
        ) : preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Captured" className="w-full object-contain max-h-[70vh]" />
        ) : (
          <video
            ref={videoRef}
            className="w-full object-contain max-h-[70vh]"
            muted
            playsInline
          />
        )}

        <canvas ref={canvasRef} className="hidden" />

        {/* Controls */}
        <div className="flex items-center justify-center gap-6 py-5 bg-black">
          {preview ? (
            <>
              <button
                onClick={retake}
                className="px-5 py-2 rounded-xl bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
              >
                Retake
              </button>
              <button
                onClick={confirm}
                className="w-14 h-14 rounded-full bg-accent hover:bg-accent-hover flex items-center justify-center text-white shadow-lg transition-all hover:scale-105"
              >
                <RiCheckLine className="w-6 h-6" />
              </button>
            </>
          ) : (
            <button
              onClick={capture}
              disabled={!!error}
              className="w-16 h-16 rounded-full bg-white hover:bg-white/90 flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
            >
              <RiCameraLine className="w-7 h-7 text-black" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
