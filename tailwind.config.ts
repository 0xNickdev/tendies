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
        // RobinX neon-lime palette — bright lime accent on warm near-black
        robin: {
          DEFAULT: "#D4FA09",
          50: "#FAFFE5",
          100: "#F0FFC2",
          200: "#E6FF8F",
          300: "#D4FA09",
          400: "#C2EE33",
          500: "#9CC41B",
          600: "#728F12",
        },
        ink: {
          950: "#0A0B05",
          900: "#0F110A",
          850: "#12150C",
          800: "#171A0E",
          700: "#1D2112",
          600: "#2A3016",
        },
        long: "#2FE08C",
        short: "#FF6B8A",
        warn: "#FFD166",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        hand: ["var(--font-hand)", "cursive"],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(217,255,77,0.18), 0 8px 40px -8px rgba(217,255,77,0.35)",
        "glow-sm": "0 0 24px -6px rgba(217,255,77,0.45)",
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -30px rgba(0,0,0,0.8)",
        // brutalist hard offset shadows
        brut: "4px 4px 0 0 rgba(217,255,77,0.9)",
        "brut-sm": "3px 3px 0 0 rgba(217,255,77,0.9)",
        "brut-lg": "6px 6px 0 0 rgba(217,255,77,0.9)",
        "brut-dim": "4px 4px 0 0 rgba(217,255,77,0.22)",
        "brut-deep": "4px 4px 0 0 #728F12",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(rgba(217,255,77,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(217,255,77,0.04) 1px, transparent 1px)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(217,255,77,0.5)" },
          "70%": { boxShadow: "0 0 0 18px rgba(217,255,77,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(217,255,77,0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        // an arrow loosed left → right along the roadmap trajectory
        "arrow-fly": {
          "0%": { left: "0%", opacity: "0", transform: "translateY(6px) rotate(-7deg)" },
          "8%": { opacity: "1" },
          "50%": { transform: "translateY(-16px) rotate(0deg)" },
          "90%": { opacity: "1" },
          "100%": { left: "calc(100% - 4.5rem)", opacity: "0", transform: "translateY(4px) rotate(7deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both",
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.4,0,0.6,1) infinite",
        ticker: "ticker 40s linear infinite",
        "arrow-fly": "arrow-fly 3.2s cubic-bezier(0.35,0,0.65,1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
