/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class", 
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        corporate: {
          "primary": "#3B82F6",   // azul principal
          "secondary": "#6366F1", // roxo
          "accent": "#10B981",    // verde
          "neutral": "#111827",   // cinza quase preto
          "base-100": "#F9FAFB",  // fundo
          "info": "#0EA5E9",
          "success": "#22C55E",
          "warning": "#F59E0B",
          "error": "#EF4444",
        },
      },
      "light",
      "dark",
    ],
    darkTheme: "corporate", 
  },
};
