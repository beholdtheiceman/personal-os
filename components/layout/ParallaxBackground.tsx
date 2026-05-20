"use client";
import { useState, useEffect } from "react";

// Sky animation frames (480×270 pixel art, cycled at ~8fps)
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

// Each layer scrolls at a different speed — mountains slowest, foreground fastest
const LAYERS = [
  { src: "/cherry-blossom/01 - Mountains.png",   duration: "90s"  },
  { src: "/cherry-blossom/02 - Mid Trees.png",   duration: "50s"  },
  { src: "/cherry-blossom/03 - Front Trees.png", duration: "28s"  },
  { src: "/cherry-blossom/04 - Foreground.png",  duration: "16s"  },
];

export default function ParallaxBackground() {
  const [skyFrame, setSkyFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSkyFrame((f) => (f + 1) % SKY_FRAMES.length), 120);
    return () => clearInterval(id);
  }, []);

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundRepeat: "repeat-x",
    // Scale tile height to viewport, width proportional (480/270 = 16:9)
    backgroundSize: "177.78vh auto",
    imageRendering: "pixelated",
    backgroundPosition: "bottom",
    // Knocks out white backgrounds so layers composite correctly
    mixBlendMode: "multiply",
  };

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Sky — animated frames, no scroll, no blend mode needed */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url('${SKY_FRAMES[skyFrame]}')`,
          backgroundRepeat: "repeat-x",
          backgroundSize: "177.78vh auto",
          imageRendering: "pixelated",
          backgroundPosition: "top",
        }}
      />

      {/* Parallax scroll layers */}
      {LAYERS.map(({ src, duration }) => (
        <div
          key={src}
          style={{
            ...baseStyle,
            backgroundImage: `url('${src}')`,
            animation: `parallax-scroll ${duration} linear infinite`,
          }}
        />
      ))}

      {/* Subtle dark overlay so UI cards stay readable */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.18)" }}
      />
    </div>
  );
}
