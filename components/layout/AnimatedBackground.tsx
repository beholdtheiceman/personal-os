// Fixed background — photo with soft overlay so glass cards and dark text stay readable
export default function AnimatedBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10"
      style={{
        backgroundImage: `
          linear-gradient(rgba(215, 185, 205, 0.42), rgba(195, 175, 215, 0.42)),
          url('/cherry-blossom-bg.jpg')
        `,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
