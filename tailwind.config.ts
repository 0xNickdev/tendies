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
        // Palette lifted from stonkfun: steel-blue accent on cold teal-black
        tendie: {
          DEFAULT: "#69AAC1",
          50: "#EDF5F8",
          100: "#D6E9F0",
          150: "#ABC4CE", // light stop of the brand gradient (their mark)
          200: "#A4C5CF", // their muted text
          350: "#78A9BF", // steel stop of the brand gradient
          300: "#89BDCE",
          400: "#69AAC1",
          450: "#5C8394", // deep stop of the brand gradient
          500: "#4E8DA4",
          600: "#3D6672", // their strong border
        },
        ink: {
          950: "#071013", // page ground
          900: "#0B1A1F",
          850: "#102127", // card
          800: "#132429",
          700: "#18262A",
          600: "#1F4451", // active tab / raised
        },
        // cool blue-greys for type — stonkfun's text temperature
        mist: {
          50: "#F3F8F8",
          200: "#C3D8DF",
          300: "#A4C5CF",
          400: "#8EA2A6",
          500: "#7D949B",
          600: "#5F7880",
          700: "#47606A",
        },
        long: "#3CE3AB",
        short: "#F23674",
        warn: "#FFC46B",
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
        glow: "0 0 0 1px rgba(105, 170, 193,0.18), 0 8px 40px -8px rgba(105, 170, 193,0.35)",
        "glow-sm": "0 0 24px -6px rgba(105, 170, 193,0.45)",
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -30px rgba(0,0,0,0.8)",
        // brutalist hard offset shadows
        brut: "4px 4px 0 0 rgba(105, 170, 193,0.9)",
        "brut-sm": "3px 3px 0 0 rgba(105, 170, 193,0.9)",
        "brut-lg": "6px 6px 0 0 rgba(105, 170, 193,0.9)",
        "brut-dim": "4px 4px 0 0 rgba(105, 170, 193,0.22)",
        "brut-deep": "4px 4px 0 0 #3D6672",
      },
      backgroundImage: {
        // The brand gradient, sampled off the stonkfun mark: light #ABC4CE at
        // the top-right falling to steel #78A9BF, deepening to #5C8394.
        brand: "linear-gradient(215deg, #ABC4CE 0%, #78A9BF 58%, #5C8394 100%)",
        "brand-soft":
          "linear-gradient(215deg, rgba(171,196,206,0.18) 0%, rgba(120,169,191,0.10) 60%, rgba(92,131,148,0.06) 100%)",
        "grid-faint":
          "linear-gradient(rgba(105, 170, 193,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(105, 170, 193,0.04) 1px, transparent 1px)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(105, 170, 193,0.5)" },
          "70%": { boxShadow: "0 0 0 18px rgba(105, 170, 193,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(105, 170, 193,0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        // a tender travelling left → right along the roadmap conveyor
        "fly": {
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
        "fly": "fly 3.2s cubic-bezier(0.35,0,0.65,1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
