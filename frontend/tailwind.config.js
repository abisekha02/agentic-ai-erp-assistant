/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        paper: "#F3F6FA",
        rule: "#DCE3EC",
        muted: "#5F6F86",
        navy: "#0B2545",
        signal: { DEFAULT: "#1565C0", dark: "#0D4E9B", wash: "#E7F0FB" },
        slip: { DEFAULT: "#9A5B08", wash: "#FBF1DC", edge: "#E8C98A" },
        danger: "#B42318",
      },
      fontFamily: { sans: ['"Source Sans 3"', "system-ui", "sans-serif"] },
      boxShadow: { card: "0 1px 2px rgba(11,37,69,0.06), 0 1px 3px rgba(11,37,69,0.08)" },
    },
  },
  plugins: [],
};
