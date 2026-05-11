/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./contexts/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0F",
        card: "#15151f",
        border: "#1e1e2e",
        green: "#7EB8A4",
        yellow: "#FFD93D",
        red: "#FF6B6B",
        orange: "#FF8C42",
        purple: "#C8A4FF",
        blue: "#A8B4FF",
        teal: "#4ECDC4",
      },
      fontFamily: {
        serif: ["Georgia", "serif"],
        mono: ["SF Mono", "Monaco", "Consolas", "monospace"],
      },
      borderRadius: {
        card: "18px",
      },
      maxWidth: {
        mobile: "430px",
      },
    },
  },
  plugins: [],
};
