/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#2563eb",
        "primary-hover": "#1d4ed8",
        "background-light": "#f8fafc",
        "background-dark": "#0f172a",
        "surface-light": "#ffffff",
        "surface-dark": "#1e293b",
        "border-light": "#e2e8f0",
        "border-dark": "#334155",
      },
      fontFamily: {
        "display": ["Inter", "sans-serif"]
      },
      borderRadius: { "DEFAULT": "0.375rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px" },
    },
  },
  plugins: [],
}
