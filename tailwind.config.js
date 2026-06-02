/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Remapeia yellow para o brand amber — todos os bg-yellow-* e text-yellow-* viram amber
        yellow: {
          50:  '#fdf8f0',
          100: '#f5ead8',
          200: '#e8d4b0',
          300: '#d4b47a',
          400: '#9E7A42',   // brand-amber (era CTA amarelo)
          500: '#8a6a34',   // brand-amber-hover
          600: '#7a5c2c',
          700: '#6a4e24',
          800: '#5a3e1c',
          900: '#4a2e14',
          950: '#3a2010',
        },
        // Sobrescreve gray para o tom terroso (mais quente que o gray padrão)
        gray: {
          50:  '#faf9f7',
          100: '#f5f2ed',
          200: '#e8e0d4',
          300: '#d4c8b8',
          400: '#b0a090',
          500: '#9a8a78',
          600: '#6a5e4e',
          700: '#4a3e2e',
          800: '#3d3528',
          900: '#1e1a14',
          950: '#0f0d0a',
        },
      },
    },
  },
  plugins: [],
}
