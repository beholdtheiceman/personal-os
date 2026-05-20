"use client";

const LAYERS = [
  { src: "/cherry-blossom/01 - Mountains.png",   duration: "90s" },
  { src: "/cherry-blossom/02 - Mid Trees.png",   duration: "50s" },
  { src: "/cherry-blossom/03 - Front Trees.png", duration: "28s" },
  { src: "/cherry-blossom/04 - Foreground.png",  duration: "16s" },
];

export default function ParallaxBackground() {
  const tileStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundRepeat: "repeat-x",
    backgroundSize: "177.78vh auto",
    imageRendering: "pixelated",
    backgroundPosition: "bottom",
  };

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Static sky — one frame, no animation, no flickering */}
      <div style={{
        ...tileStyle,
        backgroundImage: "url('/cherry-blossom/00 - Sky.png')",
        backgroundPosition: "top",
        backgroundRepeat: "repeat-x",
      }} />

      {/* Parallax scroll layers */}
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
