/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      colors: {
        cantina: {
          // Backgrounds
          shell:    '#0E1214',
          surface:  '#1A2025',
          elevated: '#222C33',
          // Accents
          teal:     '#33FAD0',
          'teal-dim': '#007F85',
          gold:     '#D4A017',
          // Text
          bone:     '#F0EDE8',
          stone:    '#8A9099',
          // Borders
          rail:     '#2A343C',
          // Status
          sage:     '#3DAA6E',
          ember:    '#E07B35',
          crimson:  '#C23B3B',
        },
      },
      borderRadius: {
        card:   '12px',
        modal:  '16px',
        input:  '8px',
        pill:   '9999px',
      },
    },
  },
  plugins: [],
}
