/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        paper: "#EDF0F4",
        rule: "#D5DAE2",
        muted: "#5B667A",
        signal: { DEFAULT: "#0E6F68", dark: "#0A5550", wash: "#E3F1EF" },
        slip: { DEFAULT: "#9A5B08", wash: "#FBF1DC", edge: "#E8C98A" },
        danger: "#B42318",
      },
      fontFamily: {
        sans: ['"Public Sans"', "system-ui", "sans-serif"],
        serif: ['"Source Serif 4"', "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
