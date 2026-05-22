"use client";
import { useEffect, useRef } from "react";

const COLORS: [number, number, number][] = [
  [255, 183, 197],
  [240, 148, 168],
  [255, 210, 220],
  [220, 128, 152],
  [250, 195, 208],
  [235, 165, 182],
];

const PETAL_COUNT = 38;

interface Petal {
  x: number;
  y: number;
  size: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  color: [number, number, number];
  sway: number;
  swaySpeed: number;
  swayAmplitude: number;
}

function newPetal(w: number, startBelowTop = false): Petal {
  return {
    x: Math.random() * (w + 200) - 100,
    y: startBelowTop ? Math.random() * window.innerHeight : -20 - Math.random() * 200,
    size: 5 + Math.random() * 7,
    speedY: 0.55 + Math.random() * 0.9,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.032,
    opacity: 0.45 + Math.random() * 0.45,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    sway: Math.random() * Math.PI * 2,
    swaySpeed: 0.007 + Math.random() * 0.013,
    swayAmplitude: 0.7 + Math.random() * 1.6,
  };
}

function drawPetal(ctx: CanvasRenderingContext2D, p: Petal) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.globalAlpha = p.opacity;

  const [r, g, b] = p.color;
  ctx.fillStyle = `rgb(${r},${g},${b})`;

  // Teardrop / petal bezier shape
  const s = p.size;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.bezierCurveTo( s * 0.9, -s * 0.4,  s * 0.7,  s * 0.6, 0,  s);
  ctx.bezierCurveTo(-s * 0.7,  s * 0.6, -s * 0.9, -s * 0.4, 0, -s);
  ctx.fill();

  // Subtle center vein
  ctx.globalAlpha = p.opacity * 0.25;
  ctx.strokeStyle = `rgb(${Math.max(r - 30, 0)},${Math.max(g - 30, 0)},${Math.max(b - 30, 0)})`;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.8);
  ctx.lineTo(0, s * 0.8);
  ctx.stroke();

  ctx.restore();
}

export default function CherryBlossoms() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    const petals: Petal[] = Array.from({ length: PETAL_COUNT }, (_, i) =>
      newPetal(w, i < PETAL_COUNT * 0.7) // seed most petals already on screen
    );

    const onResize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    window.addEventListener("resize", onResize);

    let rafId: number;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);

      for (const p of petals) {
        p.sway += p.swaySpeed;
        p.x += Math.sin(p.sway) * p.swayAmplitude;
        p.y += p.speedY;
        p.rotation += p.rotationSpeed;

        if (p.y > h + 30) {
          Object.assign(p, newPetal(w, false));
        }

        drawPetal(ctx, p);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: -1 }}
    />
  );
}
