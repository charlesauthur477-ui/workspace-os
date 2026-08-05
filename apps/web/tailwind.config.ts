import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0b0e14",
        panel: "rgba(255,255,255,0.05)",
        border: "rgba(255,255,255,0.08)",
        accent: "#6366f1",
      },
      backdropBlur: { xs: "2px" },
    },
  },
  plugins: [],
};
export default config;
