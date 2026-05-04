import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-primary": "#080b0f",
        "bg-secondary": "#0d1117",
        "bg-panel": "#111820",
        "bg-hover": "#1a2430",
        border: "#1e2d3d",
        "border-bright": "#2a4060",
        amber: "#f0a500",
        "amber-dim": "#b07a00",
        green: "#00d084",
        "green-dim": "#007a4d",
        red: "#ff4560",
        "red-dim": "#8a0022",
        yellow: "#f5c518",
        cyan: "#00b4d8",
        "text-primary": "#e8edf2",
        "text-secondary": "#7a9ab8",
        "text-dim": "#3d5a73",
        "text-mono": "#c9d6e3",
      },
      fontFamily: {
        mono: ["IBM Plex Mono", "monospace"],
        sans: ["IBM Plex Sans", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"],
      },
      keyframes: {
        blink: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0" } },
        "ticker-scroll": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "pulse-amber": {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(240,165,0,0.4)" },
          "50%": { boxShadow: "0 0 0 6px rgba(240,165,0,0)" },
        },
        "pulse-green": {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(0,208,132,0.4)" },
          "50%": { boxShadow: "0 0 0 6px rgba(0,208,132,0)" },
        },
        spin: { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        blink: "blink 1.4s infinite",
        "ticker-scroll": "ticker-scroll 40s linear infinite",
        "pulse-amber": "pulse-amber 2s infinite",
        "pulse-green": "pulse-green 2s infinite",
        spin: "spin 0.8s linear infinite",
        "fade-up": "fadeUp 0.4s ease forwards",
        shimmer: "shimmer 1.5s infinite linear",
      },
    },
  },
  plugins: [],
};

export default config;
