/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111C43",
        paper: "#F1F4FA",
        rule: "#E3E8F2",
        muted: "#6B7694",
        side: "#F8F9FE",
        signal: { DEFAULT: "#4E6AE6", dark: "#3A54CC", wash: "#EAEEFD" },
        slip: { DEFAULT: "#9A5B08", wash: "#FBF1DC", edge: "#E8C98A" },
        danger: "#E5484D",
        good: "#1FA38F",
      },
      fontFamily: { sans: ['"Source Sans 3"', "system-ui", "sans-serif"] },
      boxShadow: { card: "0 2px 12px rgba(30,50,120,0.07)" },
    },
  },
  plugins: [],
};
