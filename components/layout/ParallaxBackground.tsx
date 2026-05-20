"use client";
import { useState, useEffect } from "react";

const SKY_FRAMES = [
  "/cherry-blossom/00 - Sky.png",
  "/cherry-blossom/00 - Sky1.png",
  "/cherry-blossom/00 - Sky2.png",
  "/cherry-blossom/00 - Sky3.png",
  "/cherry-blossom/00 - Sky4.png",
  "/cherry-blossom/00 - Sky5.png",
  "/cherry-blossom/00 - Sky6.png",
  "/cherry-blossom/00 - Sky7.png",
  "/cherry-blossom/00 - Sky8.png",
];

const LAYERS = [
  { src: "/cherry-blossom/01 - Mountains.png",   duration: "90s" },
  { src: "/cherry-blossom/02 - Mid Trees.png",   duration: "50s" },
  { src: "/cherry-blossom/03 - Front Trees.png", duration: "28s" },
  { src: "/cherry-blossom/04 - Foreground.png",  duration: "16s" },
];

// Solid fallback matching the sky base color — no white ever shows through
const SKY_BASE = "#3ecfb2";

export default function ParallaxBackground() {
  const [skyFrame, setSkyFrame] = useState(0);

  // Slow cycle — subtle star twinkle, no jarring flash
  useEffect(() => {
    const id = setInterval(() => setSkyFrame((f) => (f + 1) % SKY_FRAMES.length), 600);
    return () => clearInterval(id);
  }, []);

  const tileStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundRepeat: "repeat-x",
    backgroundSize: "177.78vh auto",
    imageRendering: "pixelated",
    backgroundPosition: "bottom",
  };

  return (
    // Solid base color — instantly visible, eliminates any white flash
    <div className="fixed inset-0 -z-10 overflow-hidden" style={{ background: SKY_BASE }}>

      {/* Sky — all frames pre-rendered, cross-fade via opacity (no background-image swap) */}
      {SKY_FRAMES.map((src, i) => (
        <div
          key={src}
          style={{
            ...tileStyle,
            backgroundImage: `url('${src}')`,
            backgroundPosition: "top",
            opacity: i === skyFrame ? 1 : 0,
            transition: "opacity 0.4s ease-in-out",
          }}
        />
      ))}

      {/* Parallax scroll layers — transparent PNGs composited over sky */}
      {LAYERS.map(({ src, duration }) => (
        <div
          key={src}
          style={{
            ...tileStyle,
            backgroundImage: `url('${src}')`,
            animation: `parallax-scroll ${duration} linear infinite`,
          }}
        />
      ))}

      {/* Subtle overlay so UI cards stay readable */}
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.15)" }} />
    </div>
  );
}
