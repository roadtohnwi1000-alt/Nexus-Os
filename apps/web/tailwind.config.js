/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0f0f0f",
        surface: "#1a1a1a",
        "surface-hover": "#222222",
        "surface-card": "#161616",
        border: "#282828",
        accent: {
          DEFAULT: "#8b5cf6",
          hover: "#7c3aed",
          muted: "rgba(139, 92, 246, 0.15)",
        },
      },
    },
  },
  plugins: [],
};
