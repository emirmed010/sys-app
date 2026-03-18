import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';

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
        "primary": "#0f4b80",
        "primary-light": "#1565a8",
        "background-light": "#f6f7f8",
        "background-dark": "#111921",
      },
      fontFamily: {
        "display": ["IBM Plex Sans Arabic", "Inter", "sans-serif"],
        "sans": ["IBM Plex Sans Arabic", "Inter", "sans-serif"],
      },
      borderRadius: {
        "DEFAULT": "0.375rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "2xl": "1rem",
        "full": "9999px"
      },
      boxShadow: {
        'primary': '0 4px 24px -4px rgba(15, 75, 128, 0.25)',
      },
    },
  },
  plugins: [
    forms,
    containerQueries,
  ],
}
