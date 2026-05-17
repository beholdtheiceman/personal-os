import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./contexts/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Glass / hi-tech palette
        bg: {
          primary:   "#C2CDD6",   // steel-blue canvas (shows behind glass)
          secondary: "#FFFFFF",   // white base for cards / panels
          tertiary:  "#EEF2F5",   // hover / input fill
          border:    "#D0DCE6",   // subtle border
        },
        // Accent — cherry blossom rose
        accent: {
          DEFAULT: "#C4728A",
          hover:   "#B05E78",
          muted:   "#C4728A18",
          text:    "#A05470",
        },
        text: {
          primary:   "#1A0A14",
          secondary: "#4A3040",
          muted:     "#8A6070",
        },
        // Status
        success: "#4E9E77",
        warning: "#C07830",
        danger:  "#C94848",
        info:    "#4A7FC1",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-soft": "pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
