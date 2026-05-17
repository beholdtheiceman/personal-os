// Animated typing indicator shown while waiting for Claude responses
export default function LoadingDots() {
  return (
    <div className="flex items-center gap-1 px-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full bg-accent animate-pulse-soft"
          style={{ animationDelay: `${i * 200}ms` }}
        />
      ))}
    </div>
  );
}
