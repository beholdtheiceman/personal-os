export default function AnimatedBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden"
      style={{ background: "#EEE4E8" }}
    >
      <div className="absolute rounded-full" style={{ width: 700, height: 560, top: "-10%", right: "-8%", background: "radial-gradient(ellipse, rgba(196,114,138,0.35) 0%, transparent 70%)", filter: "blur(40px)", animation: "blob1 38s ease-in-out infinite", willChange: "transform" }} />
      <div className="absolute rounded-full" style={{ width: 600, height: 480, bottom: "-8%", left: "-6%", background: "radial-gradient(ellipse, rgba(100,148,190,0.30) 0%, transparent 70%)", filter: "blur(40px)", animation: "blob2 44s ease-in-out infinite", willChange: "transform" }} />
      <div className="absolute rounded-full" style={{ width: 720, height: 520, top: "25%", left: "28%", background: "radial-gradient(ellipse, rgba(180,164,210,0.22) 0%, transparent 70%)", filter: "blur(48px)", animation: "blob3 52s ease-in-out infinite", willChange: "transform" }} />
      <div className="absolute rounded-full" style={{ width: 480, height: 400, bottom: "5%", right: "8%", background: "radial-gradient(ellipse, rgba(100,180,196,0.22) 0%, transparent 70%)", filter: "blur(36px)", animation: "blob4 34s ease-in-out infinite", willChange: "transform" }} />
    </div>
  );
}
